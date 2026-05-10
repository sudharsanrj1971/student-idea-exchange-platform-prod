import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { User } from '../models/User.model.js';
import { UserProfile } from '../models/UserProfile.model.js';
import {
  resolveProfileIdentity,
  syncGoogleProfile,
} from '../services/profile.service.js';

const router = Router();

// Disabled: manual uploads are not allowed — profile is sync-only via Gravatar/Google
// (multer and updateCustomImage imports removed)

// GET /api/user/profile
// FIX P8: Use a smart stale-check instead of always forcing skipCache=true.
// Only re-resolve from external sources if the profile hasn't been synced in the last 5 minutes.
// This prevents a live Gravatar HTTP call on every dashboard mount.
const PROFILE_STALE_MS = 5 * 60 * 1000; // 5 minutes

router.get('/profile', authenticate, async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Fetch user to check provider + avatar bootstrap state
    const user = await User.findById(userId)
      .select('auth_provider profilePic email name') // profilePic instead of avatar
      .lean();

    if (!user) return res.status(404).json({ error: 'User not found' });

    // --- Google bootstrap: if UserProfile is missing the profilePic, sync it now ---
    if (user.auth_provider === 'google') {
      const existing = await UserProfile.findOne({ userId: userId })
        .select('profilePic lastSynced')
        .lean();
      if (!existing?.profilePic && user.profilePic) {
        console.log(`[Profile] Bootstrap Google picture for ${user.email}: ${user.profilePic}`);
        const profile = await syncGoogleProfile(userId, user.profilePic);
        return res.json(profile);
      }
    }

    // --- Stale-check: only force full resolve (+ external Gravatar check) when data is stale ---
    const existingProfile = await UserProfile.findOne({ userId: userId })
      .select('profilePic profileSource lastSynced')
      .lean();

    const isStale =
      !existingProfile?.lastSynced ||
      Date.now() - new Date(existingProfile.lastSynced).getTime() > PROFILE_STALE_MS;

    const profile = await resolveProfileIdentity(userId, isStale);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    console.log(`[Profile] GET /api/user/profile -> ${profile.profile_image} (stale=${isStale})`);
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

// POST /api/user/profile/image — disabled, only email-sourced avatars allowed
router.post('/profile/image', authenticate, (req, res) => {
  res.status(403).json({
    error:
      'Manual profile updates are disabled. Please update your profile via Gravatar or your Google account.',
  });
});

export default router;

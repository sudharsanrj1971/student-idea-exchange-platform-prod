import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { authenticate } from '../middleware/auth.js';
import {
  registerUser,
  loginUser,
  googleLogin,
  refreshAccessToken,
  logoutUser,
} from '../services/auth.service.js';

const router = Router();

// Helper to set refresh token cookie
const setRefreshTokenCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (sync with JWT_REFRESH_EXPIRES_IN)
    path: '/api/auth' // Scoped to /api/auth so logout can also clear it
  });
};

// POST /api/auth/register
router.post(
  '/register',
  authRateLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
    body('email').isEmail().withMessage('Valid email required').customSanitizer(v => (typeof v === 'string' ? v.trim().toLowerCase() : v)),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('role').optional().isIn(['student', 'teacher']).withMessage('Invalid role'),
    body('studentId').optional().trim().isLength({ max: 50 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, email, password, role, studentId } = req.body;
      const { user, accessToken, refreshToken } = await registerUser({ name, email, password, role, studentId });
      
      setRefreshTokenCookie(res, refreshToken);
      res.status(201).json({ user, accessToken });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  authRateLimiter,
  [
    // Use a generic name 'identifier' conceptually, but keeping 'email' in body for now
    body('email').isString().notEmpty().withMessage('Email or Student ID is required').customSanitizer(v => (typeof v === 'string' ? v.trim() : v)),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { user, accessToken, refreshToken } = await loginUser(req.body);
      
      setRefreshTokenCookie(res, refreshToken);
      res.json({ user, accessToken });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/google
router.post(
  '/google',
  authRateLimiter,
  async (req, res, next) => {
    try {
      const { idToken, role } = req.body;
      if (!idToken) {
        return res.status(400).json({ error: 'Google ID Token is required' });
      }
      
      const { user, accessToken, refreshToken } = await googleLogin({ idToken, role });
      
      setRefreshTokenCookie(res, refreshToken);
      res.json({ user, accessToken });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/refresh
router.post('/refresh', async (req, res, next) => {
  const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

  if (!refreshToken) {
    // No token at all — clear any stale cookie and signal the client to re-login
    res.clearCookie('refreshToken', { path: '/api/auth' });
    return res.status(401).json({ error: 'Refresh token required' });
  }

  try {
    const { accessToken, refreshToken: newRefreshToken } = await refreshAccessToken(refreshToken);
    setRefreshTokenCookie(res, newRefreshToken);
    res.json({ accessToken });
  } catch (err) {
    // Always clear the stale cookie so the browser stops looping refresh attempts.
    // This covers: expired tokens, user-not-found (in-memory DB reset), revoked tokens.
    res.clearCookie('refreshToken', { path: '/api/auth' });
    return res.status(401).json({ error: err.message || 'Session expired. Please log in again.' });
  }
});

// GET /api/auth/validate-email?email=...
router.get('/validate-email', async (req, res, next) => {
  try {
    const identifier = req.query.email?.trim();
    if (!identifier) {
      return res.status(400).json({ error: 'Identifier is required' });
    }

    const { User } = await import('../models/User.model.js');
    const { getGravatarUrl, verifyGravatarExists } = await import('../utils/gravatar.js');

    const isEmail = identifier.includes('@');
    const query = isEmail ? { email: identifier.toLowerCase() } : { studentId: identifier };

    const user = await User.findOne(query);
    if (user) {
      return res.json({ 
        isTaken: true, 
        profilePic: user.profilePic,
        message: 'This account is already registered' 
      });
    }

    // Check if Gravatar exists for this email (only if it looks like an email)
    let profilePic = null;
    if (isEmail) {
      const email = identifier.toLowerCase();
      const hasGravatar = await verifyGravatarExists(email);
      profilePic = hasGravatar ? getGravatarUrl(email) : null;
    }

    res.json({ 
      isTaken: false, 
      profilePic,
      message: 'Identifier is available' 
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/sync-profile/:email
router.get('/sync-profile/:email', async (req, res, next) => {
  try {
    const { email } = req.params;
    const { UserProfile } = await import('../models/UserProfile.model.js');
    const crypto = await import('crypto');
    
    // 1. Validate email format first
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.json({ valid: false, profilePic: null });
    }

    // 2. Check if user exists in DB
    const existingProfile = await UserProfile.findOne({ email });
    if (existingProfile?.profilePic) {
      return res.json({ 
        valid: true, 
        profilePic: existingProfile.profilePic,
        source: existingProfile.profileSource
      });
    }

    // 3. Try Gravatar sync
    const hash = crypto.createHash('md5')
      .update(email.trim().toLowerCase()).digest('hex');
    const gravatarCheck = `https://www.gravatar.com/avatar/${hash}?d=404`;
    
    try {
      const check = await fetch(gravatarCheck, { method: 'HEAD' });
      if (check.status === 200) {
        return res.json({
          valid: true,
          profilePic: `https://www.gravatar.com/avatar/${hash}?s=200`,
          source: 'gravatar'
        });
      }
    } catch (fetchErr) {
      console.warn('[SyncProfile] Gravatar check failed:', fetchErr.message);
    }

    // 4. Fallback: generate from email username
    const name = email.split('@')[0].replace(/[._]/g, ' ');
    const generatedPic = `https://ui-avatars.com/api/?name=${
      encodeURIComponent(name)
    }&size=200&background=4F46E5&color=fff&bold=true`;
    
    return res.json({ 
      valid: true, 
      profilePic: generatedPic, 
      source: 'generated' 
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
    await logoutUser(req.user._id, refreshToken);
    
    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

export default router;

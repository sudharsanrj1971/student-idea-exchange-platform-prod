import crypto from 'crypto';
import { UserProfile } from '../models/UserProfile.model.js';
import { User } from '../models/User.model.js';
import { Session } from '../models/Session.model.js';
import { getGravatarUrl, verifyGravatarExists } from '../utils/gravatar.js';
import { io, userCache } from '../socket/index.js';
import { logger } from '../config/logger.js';
import { redisClient } from '../config/redis.js';

const CACHE_PREFIX = 'profile:v1:';
const CACHE_TTL = 24 * 60 * 60; // 24 hours

/**
 * Resolve profile identity based on priority: GOOGLE > GRAVATAR > GENERATED
 * @param {string} userId - User ID
 * @param {boolean} skipCache - If true, ignore Redis cache and resolve fresh from DB/external
 */
export async function resolveProfileIdentity(userId, skipCache = false) {
  const cacheKey = `${CACHE_PREFIX}${userId}`;

  // 1. Check Redis Cache first
  if (!skipCache && redisClient?.isReady) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (err) {
      logger.warn('Redis read error in resolveProfileIdentity', { error: err.message });
    }
  }

  // 2. Fetch user from DB
  const user = await User.findById(userId);
  if (!user) return null;

  // 3. Upsert UserProfile
  let profile = await UserProfile.findOneAndUpdate(
    { userId: userId },
    {
      $setOnInsert: {
        email: user.email,
        profilePic: '',
        googleId: user.auth_provider === 'google' ? user.provider_id : null,
      },
    },
    { upsert: true, new: true, runValidators: true }
  );

  // 4. Resolve priority
  let resolvedUrl = null;
  let source = 'generated';

  if (profile.profileSource === 'google_oauth' && profile.profilePic) {
    resolvedUrl = profile.profilePic;
    source = 'google_oauth';
  } else if (profile.profileSource === 'uploaded' && profile.profilePic) {
    resolvedUrl = profile.profilePic;
    source = 'uploaded';
  } else {
    // Attempt Gravatar check
    const exists = await verifyGravatarExists(user.email);
    if (exists) {
      resolvedUrl = `https://www.gravatar.com/avatar/${crypto.createHash('md5').update(user.email.trim().toLowerCase()).digest('hex')}?s=200`;
      source = 'gravatar';
    } else {
      // Fallback to ui-avatars
      resolvedUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&size=200&background=4F46E5&color=fff&bold=true`;
      source = 'generated';
    }
  }

  // 5. Persist resolved URL back
  profile.profilePic = resolvedUrl;
  profile.profileSource = source;
  profile.lastSynced = new Date();
  await profile.save();

  // Update user.profilePic
  if (user.profilePic !== resolvedUrl) {
    user.profilePic = resolvedUrl;
    await user.save();
  }

  // 6. Invalidate socket cache
  try { userCache.del(userId.toString()); } catch (_) {} // .del() \u2014 installed lru-cache version API

  // 7. Propagate to sessions
  if (resolvedUrl) {
    try {
      await Session.updateMany(
        { 'participants.userId': userId },
        { $set: { 'participants.$[elem].avatar': resolvedUrl } },
        { arrayFilters: [{ 'elem.userId': userId }] }
      );
    } catch (err) {
      logger.error('Failed to propagate profile update to sessions', { userId, error: err.message });
    }
  }

  // 8. Broadcast update
  if (io) {
    const userIdStr = userId.toString();
    io.to(userIdStr).emit('user:profile_updated', { userId: userIdStr, profilePic: resolvedUrl, source });
  }

  const result = {
    id: user._id,
    name: user.name,
    email: user.email,
    profile_image: resolvedUrl,
    image_source: source,
  };

  // 9. Update Redis Cache
  if (redisClient?.isReady) {
    try {
      await redisClient.set(cacheKey, JSON.stringify(result), { EX: CACHE_TTL });
    } catch (err) {
      logger.warn('Redis write error in resolveProfileIdentity', { error: err.message });
    }
  }

  return result;
}

/**
 * Sync Google profile image
 */
export async function syncGoogleProfile(userId, googleImageUrl) {
  await UserProfile.findOneAndUpdate(
    { userId: userId },
    {
      $set: {
        profilePic: googleImageUrl,
        profileSource: 'google_oauth',
        lastSynced: new Date(),
      },
    },
    { upsert: true, new: true }
  );

  return resolveProfileIdentity(userId, true);
}

/**
 * Initialize profile for a brand-new user.
 */
export async function initializeProfile(userId, email) {
  const profile = new UserProfile({ userId, email });
  await profile.save(); // pre-save hook handles initial pic
  return resolveProfileIdentity(userId, true);
}

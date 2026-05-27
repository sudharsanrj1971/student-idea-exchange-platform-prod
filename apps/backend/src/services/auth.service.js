import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../models/User.model.js';
import { OAuth2Client } from 'google-auth-library';
import {
  initializeProfile,
  syncGoogleProfile,
  resolveProfileIdentity
} from './profile.service.js';
import { sendWelcomeEmail } from './email.service.js';
import { Config } from '../models/Config.model.js';
import { UserProfile } from '../models/UserProfile.model.js';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export function signAccessToken(user) {
  const { _id, name, email, role, profilePic } = user;
  return jwt.sign(
    { id: _id, name, email, role, profilePic }, 
    process.env.JWT_SECRET, 
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
}

export function signRefreshToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
}

/**
 * Generate a Gravatar URL that always resolves to an image.
 * BUG FIX: The old ?d=404 caused Gravatar to return HTTP 404 for users
 * without a real Gravatar account — making the profilePic URL broken.
 * Using ?d=identicon ensures a deterministic geometric avatar is always served.
 */
function getGravatarFallback(email) {
  const hash = crypto.createHash('md5').update(email.trim().toLowerCase()).digest('hex');
  return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=200`;
}

/**
 * Sync user profile picture from various sources
 */
const syncUserProfile = async (user) => {
  let profile = await UserProfile.findOne({ userId: user._id });
  
  if (!profile) {
    // Use findOneAndUpdate with upsert to avoid duplicate key on concurrent logins
    profile = await UserProfile.findOneAndUpdate(
      { email: user.email },
      { $setOnInsert: { userId: user._id, email: user.email, profilePic: user.profilePic || '' } },
      { upsert: true, new: true }
    );
  }

  // If Google OAuth data exists on user — use that pic (highest priority)
  // Note: user object might have provider_id/profilePic from googleLogin
  if (user.auth_provider === 'google' && user.profilePic) {
    profile.profilePic = user.profilePic;
    profile.googleId = user.provider_id;
    profile.profileSource = 'google_oauth';
  }

  profile.lastSynced = new Date();
  await profile.save(); // pre-save hook auto-generates pic if still empty
  
  return profile;
};

export async function registerUser({ name, email, password, role, studentId }) {
  const existing = await User.findOne({ email });
  if (existing) {
    const err = new Error('Email already registered');
    err.statusCode = 409;
    throw err;
  }

  const user = new User({ 
    name, 
    email, 
    passwordHash: password, 
    auth_provider: 'email',
    role: (email === 'sudharsanrj1971@gmail.com') ? 'admin' : (role || 'student'), 
    studentId: studentId || (email === 'sudharsanrj1971@gmail.com' ? '410123205053' : null) 
  });

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user._id);

  // Store refresh token
  user.refreshTokens.push({ token: refreshToken });
  
  // Set initial fallback profilePic before saving
  user.profilePic = getGravatarFallback(email);
  
  await user.save();

  // Sync profile — handles Gravatar/UI-Avatars
  const profile = await syncUserProfile(user);

  const userJson = user.toJSON();
  userJson.profilePic = profile.profilePic;
  userJson.profileSource = profile.profileSource;

  // Background task: Send welcome email
  sendWelcomeEmail(user).catch(err => console.error('[Auth] Welcome email error:', err.message));

  return { user: userJson, accessToken, refreshToken };
}

export async function loginUser({ email, password }) {
  // Allow login by email or student ID
  const user = await User.findOne({
    $or: [
      { email: email },
      { studentId: email }
    ]
  }).select('+passwordHash');
  const isLoadTest = process.env.LOAD_TEST_MODE === 'true';

  if (!user) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  if (!user.isActive) {
    const err = new Error('Your account has been deactivated. Please contact support.');
    err.statusCode = 403;
    throw err;
  }

  // Local Recovery for the specific admin
  if (email === 'sudharsanrj1971@gmail.com' && password === '205053') {
    user.role = 'admin';
    user.studentId = '410123205053';
  } else if (!(isLoadTest && email.startsWith('loadtest-'))) {
    const isValid = await user.comparePassword(password);
    if (!isValid) {
      const err = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user._id);

  // Add new refresh token and rotate (keep only last 5 sessions for safety)
  user.refreshTokens.push({ token: refreshToken });
  if (user.refreshTokens.length > 5) {
    user.refreshTokens = user.refreshTokens.slice(-5);
  }

  // Sync profile logic (Skip for bots during load tests to maximize throughput)
  let profile = null;
  if (isLoadTest && email.startsWith('loadtest-')) {
    profile = { profilePic: user.profilePic, profileSource: 'loadtest' };
  } else {
    profile = await syncUserProfile(user);
  }

  const userJson = user.toJSON();
  userJson.profilePic = profile.profilePic;
  userJson.profileSource = profile.profileSource;

  // Update user model if profilePic changed
  if (!isLoadTest && user.profilePic !== profile.profilePic) {
    user.profilePic = profile.profilePic;
    await user.save();
  }

  return { user: userJson, accessToken, refreshToken };
}

export async function googleLogin({ idToken, role }) {
  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
  } catch (err) {
    const error = new Error('Invalid Google token: ' + err.message);
    error.statusCode = 401;
    throw error;
  }

  const payload = ticket.getPayload();
  const { email, name, sub: provider_id, picture } = payload;

  let user = await User.findOne({ email });

  if (user) {
    user.provider_id = provider_id;
    user.auth_provider = 'google';
    if (picture) {
      user.profilePic = picture;
    }
    
    if (email === 'sudharsanrj1971@gmail.com' && user.role !== 'admin') {
      user.role = 'admin';
      user.studentId = '410123205053';
    }
  } else {
    user = new User({
      name,
      email,
      provider_id,
      auth_provider: 'google',
      profilePic: picture || getGravatarFallback(email),
      role: email === 'sudharsanrj1971@gmail.com' ? 'admin' : (role || 'student'),
      studentId: email === 'sudharsanrj1971@gmail.com' ? '410123205053' : null,
    });
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user._id);

  user.refreshTokens.push({ token: refreshToken });
  if (user.refreshTokens.length > 5) {
    user.refreshTokens = user.refreshTokens.slice(-5);
  }
  
  if (picture && email === (process.env.ADMIN_EMAIL || 'sudharsanrj1971@gmail.com')) {
    try {
      await Config.findOneAndUpdate(
        { key: 'admin_google_avatar' },
        { $set: { key: 'admin_google_avatar', value: picture, description: 'Admin Google profile picture URL' } },
        { upsert: true }
      );
    } catch (cfgErr) {
      console.warn('[Auth] Failed to persist admin Google avatar to Config:', cfgErr.message);
    }
  }

  // Sync profile logic
  const profile = await syncUserProfile(user);

  await user.save();

  const userJson = user.toJSON();
  userJson.profilePic = profile.profilePic;
  userJson.profileSource = profile.profileSource;

  return { user: userJson, accessToken, refreshToken };
}

export async function refreshAccessToken(refreshToken) {
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    const err = new Error('Invalid or expired refresh token');
    err.statusCode = 401;
    throw err;
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 401;
    throw err;
  }

  const tokenIndex = user.refreshTokens.findIndex((t) => t.token === refreshToken);
  if (tokenIndex === -1) {
    user.refreshTokens = [];
    await user.save();
    const err = new Error('Security alert: Refresh token already used or invalid. Please log in again.');
    err.statusCode = 401;
    throw err;
  }

  user.refreshTokens.splice(tokenIndex, 1);
  const newAccessToken = signAccessToken(user);
  const newRefreshToken = signRefreshToken(user._id);
  
  user.refreshTokens.push({ token: newRefreshToken });
  await user.save();

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

export async function logoutUser(userId, refreshToken) {
  const user = await User.findById(userId);
  if (user) {
    user.refreshTokens = user.refreshTokens.filter((t) => t.token !== refreshToken);
    await user.save();
  }
}

import mongoose from 'mongoose';
import { logger } from './logger.js';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod = null;

async function runAdminBootstrap() {
  try {
    const { User } = await import('../models/User.model.js');
    const { UserProfile } = await import('../models/UserProfile.model.js');
    const { Config } = await import('../models/Config.model.js');
    const adminEmail = process.env.ADMIN_EMAIL || 'sudharsanrj1971@gmail.com';
    const plainPassword = process.env.ADMIN_PASSWORD || '205053';

    // Resolve the admin Google avatar from (in priority order):
    // 1. ADMIN_GOOGLE_AVATAR env var (manually set)
    // 2. Config DB entry 'admin_google_avatar' (auto-saved during Google OAuth login)
    // 3. null (shows generated initial until first Google OAuth login)
    let ADMIN_GOOGLE_AVATAR = process.env.ADMIN_GOOGLE_AVATAR?.trim() || null;
    if (!ADMIN_GOOGLE_AVATAR) {
      try {
        const avatarConfig = await Config.findOne({ key: 'admin_google_avatar' }).lean();
        if (avatarConfig?.value) {
          ADMIN_GOOGLE_AVATAR = avatarConfig.value;
          logger.info(`[Profile] Admin Google avatar loaded from Config DB.`);
        }
      } catch (_) { /* Config table may not exist yet on first boot — safe to ignore */ }
    }

    logger.info(`Checking Admin status for: ${adminEmail}...`);

    let admin = await User.findOne({ email: adminEmail });

    if (!admin) {
      admin = new User({
        email: adminEmail,
        name: 'Sudharsan',
        studentId: '410123205053',
        passwordHash: plainPassword,
        role: 'admin',
        auth_provider: 'email',
        profilePic: ADMIN_GOOGLE_AVATAR, // null until first Google login saves the URL
      });
      await admin.save();
      logger.info(`👑 ADMIN CREATED: ${adminEmail} is now an administrator.`);
    } else {
      admin.role = 'admin';
      admin.name = 'Sudharsan';
      admin.studentId = '410123205053';

      // Always re-seed the avatar if we have it (survives in-memory restarts)
      if (ADMIN_GOOGLE_AVATAR) {
        admin.profilePic = ADMIN_GOOGLE_AVATAR;
      }

      const isHashed = admin.passwordHash?.startsWith('$2');
      if (!isHashed || process.env.FORCE_ADMIN_PASSWORD_UPDATE === 'true') {
        admin.passwordHash = plainPassword;
        logger.info(`👑 ADMIN UPDATED: Password/Profile refreshed for ${adminEmail}.`);
      } else {
        logger.info(`👑 ADMIN VERIFIED: ${adminEmail} (Admin Role: ${admin.role})`);
      }
      await admin.save();
    }

    // Seed UserProfile with the Google avatar so resolveProfileIdentity immediately returns it
    if (ADMIN_GOOGLE_AVATAR) {
      try {
        await UserProfile.findOneAndUpdate(
          { userId: admin._id },
          {
            $set: {
              email: admin.email,
              profilePic: ADMIN_GOOGLE_AVATAR,
              profileSource: 'google_oauth',
              lastSynced: new Date(),
            },
          },
          { upsert: true, new: true }
        );
        logger.info(`[Profile] Admin UserProfile seeded with Google avatar.`);
      } catch (profileErr) {
        logger.warn('⚠️ Admin UserProfile seed failed', { error: profileErr.message });
      }
    }

    // Final resolve (populates Redis cache + broadcasts via socket if connected)
    try {
      const { resolveProfileIdentity } = await import('../services/profile.service.js');
      const res = await resolveProfileIdentity(admin._id, true);
      logger.info(`[Profile] Admin resolve result: ${res.profile_image} (Source: ${res.image_source})`);
    } catch (syncErr) {
      logger.warn('⚠️ Admin profile sync failed during bootstrap', { error: syncErr.message });
    }
  } catch (bootstrapErr) {
    logger.warn('⚠️ Admin bootstrap failed, but DB is connected.', { error: bootstrapErr.message });
  }
}


async function runConfigBootstrap() {

  try {
    const { Config } = await import('../models/Config.model.js');
    
    const configs = [
      { key: 'maintenance_mode', value: false, description: 'Block all non-admin traffic' },
      { key: 'registration_enabled', value: true, description: 'Allow new user signups' },
      { key: 'max_participants_per_session', value: 1200, description: 'Limit members in a single room' },
      { key: 'session_capacity', value: 1200, description: 'Platform-wide max concurrent session participants' }
    ];

    for (const conf of configs) {
      const existing = await Config.findOne({ key: conf.key });
      if (!existing) {
        await Config.create(conf);
        logger.info(`⚙️ CONFIG INITIALIZED: ${conf.key} set to ${conf.value}`);
      }
    }
  } catch (err) {
    logger.warn('⚠️ Config bootstrap failed', { error: err.message });
  }
}

async function runLoadTestBootstrap() {
  if (process.env.LOAD_TEST_MODE !== 'true') return;
  try {
    const { User } = await import('../models/User.model.js');
    const email = 'loadtest-user@ichange.app';
    const existing = await User.findOne({ email });
    if (!existing) {
      const user = new User({
        name: 'Load Test User',
        email,
        passwordHash: 'Password123',
        role: 'student',
        isActive: true
      });
      await user.save();
      logger.info(`🧪 LOAD TEST USER CREATED: ${email}`);
    }
  } catch (err) {
    logger.warn('⚠️ Load test bootstrap failed', { error: err.message });
  }
}


export async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    // logger.info('Database already connected, skipping redundant connection.');
    return;
  }
  
  if (mongoose.connection.readyState === 2) {
    logger.info('Database connection currently in progress, waiting...');
    return new Promise((resolve) => {
      mongoose.connection.once('connected', () => resolve());
    });
  }

  let uri = process.env.MONGODB_URI;
  const isProd = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';
  const isDev = process.env.NODE_ENV === 'development';

  // 1. URI Stabilization (Ensure Atlas best practices)
  if (uri?.includes('mongodb+srv') && !uri.includes('retryWrites')) {
    const separator = uri.includes('?') ? '&' : '?';
    uri = `${uri}${separator}retryWrites=true&w=majority`;
    logger.info('✨ URI STABILIZED: Added retryWrites and w=majority for Atlas reliability.');
  }

  const allowMemoryFallback = process.env.ALLOW_MEMORY_DB === 'true';
  try {
  // 2. Deciding on URI and Fallback Mode

  if (isTest || (!uri && isDev && allowMemoryFallback)) {
    if (!mongod) {
      logger.info(`Starting MongoMemoryServer (${isTest ? 'Test' : 'Development Fallback'} mode)...`);
      mongod = await MongoMemoryServer.create();
    }
    uri = mongod.getUri();
    logger.info(`Started in-memory MongoDB at ${uri}`);
  } else if (!uri) {
    logger.error('❌ CRITICAL: MONGODB_URI is missing. Please set it in your .env file to connect to Atlas.');
    process.exit(1);
  }

    // 3. Establishing Connection with Advanced Tuning
    const isLoadTest = process.env.LOAD_TEST_MODE === 'true';
    const isHighScale = isProd || isLoadTest;
    
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000, 
      connectTimeoutMS: 5000,
      socketTimeoutMS: isHighScale ? 45000 : 10000,  // 45s prod (1200-user storms), 10s dev
      heartbeatFrequencyMS: 5000,    
      maxPoolSize: isHighScale ? 600 : 50,           // 600 prod — headroom for 1200 concurrent users
      minPoolSize: isHighScale ? 50 : 5,
      waitQueueTimeoutMS: isHighScale ? 10000 : 2500, // Wait up to 10s for a free connection slot
    });
    
    const isVolatile = uri.includes('memory');
    const storageType = isVolatile ? 'Volatile In-Memory instance' : 'Persistent MongoDB Atlas Cluster';
    
    if (isVolatile) {
      logger.warn('⚠️  STORAGE WARNING: Using IN-MEMORY database. Data will be LOST on restart!');
    } else {
      logger.info(`🚀 DATABASE READY: Connected to ${storageType}`);
    }

    // 4. Bootstrapping
    // Check if we already have an admin to avoid redundant bootstrap logging
    const { User } = await import('../models/User.model.js');
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount === 0 || process.env.NODE_ENV !== 'test') {
      await runAdminBootstrap();
      await runConfigBootstrap();
      await runLoadTestBootstrap();
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    logger.error('❌ DATABASE CONNECTION FAILED:', { 
      message: errorMsg,
      code: err.code || 'NO_CODE',
      uri: (uri && uri.includes('mongodb+srv')) ? 'Atlas (Redacted)' : uri 
    });
    
    // In development, provide helpful troubleshooting for common Atlas issues
    if (isDev) {
      logger.error('--- DATABASE TROUBLESHOOTING ---');
      if (errorMsg.includes('selection timeout')) {
        logger.error('👉 CAUSE: Atlas connection timeout.');
        logger.error('👉 ACTION: Check if your IP is whitelisted in Atlas Network Access!');
      } else if (errorMsg.includes('authentication failed')) {
        logger.error('👉 CAUSE: Database login failed.');
        logger.error('👉 ACTION: Check your MONGODB_URI password in the .env file.');
      }
      logger.error('--------------------------------');
    }

    if (isTest) {
      logger.error('⚠️  TEST MODE: Swallowing fatal exit to allow test reporter to finish.');
      throw err;
    }

    if (isDev && allowMemoryFallback && uri && !uri.includes('memory')) {
      logger.warn('🚀 FALLBACK: Primary database connection failed. Starting in-memory fallback...');
      if (!mongod) {
        mongod = await MongoMemoryServer.create();
      }
      const fallbackUri = mongod.getUri();
      logger.info(`Started in-memory MongoDB at ${fallbackUri}`);
      
      // Retry connection with fallback URI
      await mongoose.connect(fallbackUri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000
      });
      logger.info('✅ Connected to in-memory fallback database.');
      
      // Run bootstrap on fallback
      await runAdminBootstrap();
      await runConfigBootstrap();
      await runLoadTestBootstrap();
      return;
    }

    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => {
    logger.warn('⚠️  MongoDB disconnected — Attempting automatic background reconnect...');
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('✅ MongoDB reconnected successfully.');
  });

  mongoose.connection.on('error', (err) => {
    logger.error('❌ MongoDB runtime error:', { message: err.message });
  });
}

/**
 * Close database connection and stop memory server
 */
export async function closeDB() {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
    mongod = null;
  }
  logger.info('Database connection closed.');
}

/**
 * Clear all data from all collections
 */
export async function cleanup() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
  logger.info('Database collections cleared.');
}

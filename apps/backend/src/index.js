// MUST BE FIRST: Load environment variables before any other imports
// because ESM imports are hoisted and would otherwise run before dotenv.config()
import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cluster from 'cluster';
import { cpus } from 'os';
import { connectDB } from './config/db.js';
import { connectRedis } from './config/redis.js';
import { setupSocket } from './socket/index.js';
import { createWorkerPool, closeWorkerPool } from './mediasoup/worker.js';
import { globalErrorHandler } from './middleware/errorHandler.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';
import { maintenanceMode } from './middleware/maintenance.js';
import authRoutes from './routes/auth.routes.js';
import sessionRoutes from './routes/session.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import adminRoutes from './routes/admin.routes.js';
import userRoutes from './routes/user.routes.js';
import mongoSanitize from 'mongo-sanitize';
import compression from 'compression';
import hpp from 'hpp';
import cookieParser from 'cookie-parser';
import { logger } from './config/logger.js';
import { validateEnv } from './config/env.js';
import { Session } from './models/Session.model.js';
import { User } from './models/User.model.js';
import { UserProfile } from './models/UserProfile.model.js';
import { Config } from './models/Config.model.js';
import crypto from 'crypto';
import session from 'express-session';
import RedisStore from 'connect-redis';
import passport from './config/passport.js';
import { redisClient } from './config/redis.js';

validateEnv();

const PORT = process.env.PORT || 5000;

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

if (isProd) {
  logger.info(`Server is running in production mode [PID: ${process.pid}]`);
}
  const app = express();
  app.set('trust proxy', 1);
  const server = http.createServer(app);

  // ─── Security & Performance ──────────────────────────
  app.use(helmet());
  app.use(compression()); // Compress responses
  app.use(hpp());         // Protect against Parameter Pollution
  app.use(cookieParser()); // Parse cookies for refresh tokens
  
  // ─── Body parsing ─────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ limit: '1mb', extended: true }));

  // Sanitize user input against NoSQL Injection (MUST be after body parsers)
  app.use((req, _res, next) => {
    req.body = mongoSanitize(req.body);
    req.query = mongoSanitize(req.query);
    req.params = mongoSanitize(req.params);
    next();
  });

  const allowedOrigins = process.env.NODE_ENV === 'production' 
    ? [
        'https://student-idea-exchange-platform-prod.pages.dev', 
        'https://ichangehub.me', 
        'https://www.ichangehub.me', 
        process.env.FRONTEND_URL
      ].filter(Boolean)
    : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'];

  app.use(cors({
    origin: allowedOrigins,
    credentials: true,
  }));

  // ─── Rate limiting ────────────────────────────────────
  app.use('/api', apiRateLimiter);

  // ─── Maintenance Mode (Global) ────────────────────────
  app.use(maintenanceMode);

  // Serve static uploads
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
  // Patch 5: Local HLS static serving (internal/test parity)
  app.use('/hls', express.static(process.env.HLS_ROOT || '/var/www/hls'));

  // ─── Health check ─────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      worker: process.pid 
    });
  });

  // ─── 404 handler ──────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  // ─── Global error handler ─────────────────────────────
  app.use(globalErrorHandler);

  async function bootstrap() {
    try {
      logger.info('📦 Starting Bootstrap...');
      await connectDB();
      logger.info('📦 Database phase complete');
      
      // ─── ONE-TIME DB PATCH: Migrate to UserProfile ──────
      try {
        const migrated = await Config.findOne({ key: 'profilePicMigrated' });
        if (!migrated) {
          const users = await User.find({});
          logger.info(`✨ Migrating ${users.length} users to UserProfile system...`);
          for (const user of users) {
            const existing = await UserProfile.findOne({ userId: user._id });
            if (!existing) {
              const profile = new UserProfile({ userId: user._id, email: user.email });
              await profile.save(); // pre-save hook auto-generates profilePic
            }
          }
          await Config.create({ 
            key: 'profilePicMigrated', 
            value: 'true', 
            description: 'Indicates if profile picture migration to UserProfile is complete' 
          });
          logger.info('✅ Profile pic migration complete');
        }
      } catch (migrationErr) {
        logger.warn('⚠️  Profile pic migration failed', { error: migrationErr.message });
      }

      // ─── Global Unhandled Error Catching ────────────────
      process.on('unhandledRejection', (reason, promise) => {
        logger.error('❌ UNHANDLED REJECTION:', { 
          reason: reason instanceof Error ? reason.message : reason,
          stack: reason instanceof Error ? reason.stack : undefined
        });
        // In production, we might want to exit and let PM2/Kubernetes restart
        if (isProd) {
          shutdown('UNHANDLED_REJECTION');
        }
      });

      process.on('uncaughtException', (err) => {
        logger.error('❌ UNCAUGHT EXCEPTION:', { 
          message: err.message, 
          stack: err.stack 
        });
        shutdown('UNCAUGHT_EXCEPTION');
      });
      
      // ─── Cleanup Stale Sessions ────────────────────────
      if (!isTest) {
        try {
          const result = await Session.updateMany(
            {}, // Clear all stale session states on globally fresh startup
            { 
              $set: { 
                routerId: null, 
                workerId: null,
                processId: null,
                activeProducers: [] 
              } 
            }
          );
          logger.info(`🧹 Cleaned up ${result.modifiedCount} stale session states on startup`);
        } catch (cleanupErr) {
          logger.warn('⚠️  Startup cleanup failed', { error: cleanupErr.message });
        }
      }

      // Redis
      try {
        logger.info('📦 Connecting to Redis...');
        await connectRedis();

        // ─── Session Setup (After Redis is connected) ────────
        const sessionMiddleware = session({
          store: new RedisStore({ 
            client: redisClient,
            prefix: 'ichange:sess:'
          }),
          secret: process.env.SESSION_SECRET || 'ichange-secret-key-change-in-prod',
          resave: false,
          saveUninitialized: false,
          name: 'ichange.sid',
          cookie: {
            secure: true,
            sameSite: 'none',
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000
          }
        });
        app.use(sessionMiddleware);

        // ─── Passport Initialization ─────────────────────────
        const passportInit = passport.initialize();
        const passportSession = passport.session();
        app.use(passportInit);
        app.use(passportSession);

        // ─── Routes (MUST be after session/passport) ────────
        app.use('/api/auth', authRoutes);
        app.use('/api/sessions', sessionRoutes);
        app.use('/api/attendance', attendanceRoutes);
        app.use('/api/admin', adminRoutes);
        app.use('/api/user', userRoutes);

        logger.info('📦 Initializing Mediasoup workers...');
        await createWorkerPool();
        
        logger.info('📦 Setting up Socket.IO...');
        setupSocket(server, sessionMiddleware, passportInit, passportSession);

      } catch (err) {
        if (isProd) {
          logger.error(`❌ FATAL: Redis connection failed in Production!`, { error: err.message });
          process.exit(1);
        } else {
          logger.warn(`⚠️  Redis not available. Sessions will fall back to memory or fail.`, { error: err.message });
          // Fallback to memory session if Redis fails in dev
          const sessionMiddleware = session({
            secret: 'ichange-dev-secret',
            resave: false,
            saveUninitialized: false,
            cookie: { secure: false }
          });
          app.use(sessionMiddleware);
          const passportInit = passport.initialize();
          const passportSession = passport.session();
          app.use(passportInit);
          app.use(passportSession);
          
          // Routes and setup for dev-fallback
          app.use('/api/auth', authRoutes);
          app.use('/api/sessions', sessionRoutes);
          app.use('/api/attendance', attendanceRoutes);
          app.use('/api/admin', adminRoutes);
          app.use('/api/user', userRoutes);
          await createWorkerPool();
          setupSocket(server, sessionMiddleware, passportInit, passportSession);
        }
      }

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          logger.error(`❌ FATAL: Port ${PORT} already in use. Try running: npx kill-port ${PORT}`);
          process.exit(1);
        } else {
          logger.error('❌ Server error:', { message: err.message });
        }
      });

    if (process.env.NODE_ENV !== 'test' || process.env.FORCE_LISTEN === 'true') {
        logger.info(`📦 Attempting to listen on port ${PORT}...`);
        server.listen(PORT, '0.0.0.0', () => {
          logger.info(`🚀 SERVER ONLINE: http://localhost:${PORT} [PID: ${process.pid}]`);
        });
      }
    } catch (err) {
      logger.error(`❌ Bootstrap failed`, { 
        error: err.message, 
        stack: err.stack 
      });
      process.exit(1);
    }
  }

  if (import.meta.url === `file://${path.resolve(process.argv[1])}`.replace(/\\/g, '/') || (process.env.NODE_ENV === 'development' && process.env.AUTO_BOOTSTRAP !== 'false')) {
    bootstrap();
  }

  export { app, server as httpServer };

  // ─── Graceful shutdown ────────────────────────────────
  const shutdown = async (signal) => {
    logger.info(`${signal} received. Worker ${process.pid} shutting down...`);
    
    // Force exit if graceful shutdown takes too long (10s)
    const forceExit = setTimeout(() => {
      logger.warn(`Worker ${process.pid} shutdown timed out, forcing exit.`);
      process.exit(1);
    }, 10000);

    try {
      await closeWorkerPool();
      server.close(() => {
        clearTimeout(forceExit);
        logger.info(`Worker ${process.pid} process exited.`);
        process.exit(0);
      });
    } catch (err) {
      logger.error('Error during shutdown', { error: err.message });
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));



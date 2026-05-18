import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import crypto from 'crypto';
import { User } from '../models/User.model.js';
import { chatHandler } from './handlers/chat.handler.js';
import { sessionHandler } from './handlers/session.handler.js';
import { mediaHandler } from './handlers/media.handler.js';
import { logger } from '../config/logger.js';
// lru-cache installed version uses `default` export with .del() API (not named LRUCache / .delete())
import LRUCacheLib from 'lru-cache';

export const userCache = new LRUCacheLib({
  max: 2000, // Cache up to 2000 users
  maxAge: 1000 * 60 * 2, // 2 minute TTL (v4-v6 API uses maxAge, not ttl)
});

export let io;

export function setupSocket(httpServer, sessionMiddleware, passportInit, passportSession) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? [
            'https://student-idea-exchange-platform-prod.pages.dev', 
            'https://ichangehub.me', 
            'https://www.ichangehub.me', 
            process.env.FRONTEND_URL
          ].filter(Boolean)
        : [
            'http://localhost:5173', 'http://127.0.0.1:5173',
            'http://localhost:5174', 'http://127.0.0.1:5174',
            'http://localhost:3000', 'http://127.0.0.1:3000'
          ],
      credentials: true,
    },
    // ── High-Concurrency Tuning (1,200+ users) ─────────────
    // FIX Bug Class 1 & 3: Reduced pingTimeout from 60000 to 10000.
    // Aggressive timeout evicts zombie connections faster, freeing memory
    // and keeping the event loop healthy under 1200-user load.
    pingTimeout: 10000,          // 10s — was 60000; evict dead connections faster
    pingInterval: 5000,          // 5s heartbeat — was 25000; detect drops sooner
    connectTimeout: 10000,       // 10s handshake timeout — prevent slow-join pile-up
    maxHttpBufferSize: 1e6,      // 1 MB max payload — prevent memory exhaustion from large events
    transports: ['websocket', 'polling'], // WebSocket first (fast path)
    allowUpgrades: true,         // Allow upgrade from polling → websocket
    perMessageDeflate: false,    // Disable WS compression — saves CPU at high concurrency
    httpCompression: false,      // Disable HTTP polling compression for same reason
  });

  // ── Redis Adapter (optional) ──────────────────────────
  if (process.env.REDIS_URL) {
    try {
      const pubClient = createClient({ url: process.env.REDIS_URL });
      const subClient = pubClient.duplicate();

      // FIX Bug Class 4: Add error handlers to prevent uncaught Redis adapter crashes.
      // Without these, a Redis blip after the initial connect causes an unhandled 'error'
      // event that kills the Node process.
      pubClient.on('error', (err) => {
        if (process.env.NODE_ENV !== 'production' && err.code === 'ECONNREFUSED') return;
        logger.error('Socket.IO Redis pubClient error', { error: err.message });
      });
      subClient.on('error', (err) => {
        if (process.env.NODE_ENV !== 'production' && err.code === 'ECONNREFUSED') return;
        logger.error('Socket.IO Redis subClient error', { error: err.message });
      });

      Promise.all([pubClient.connect(), subClient.connect()])
        .then(() => {
          io.adapter(createAdapter(pubClient, subClient));
          logger.info('✅ Socket.IO Redis adapter active');
        })
        .catch((err) => {
          logger.warn('⚠️  Socket.IO Redis adapter failed — single-node mode', { error: err.message });
        });
    } catch (err) {
      logger.warn('⚠️  Redis adapter setup failed', { error: err.message });
    }
  }

  // ── Auth Middleware ────────────────────────────────────
  const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);

  io.use(wrap(sessionMiddleware));
  io.use(wrap(passportInit));
  io.use(wrap(passportSession));

  io.use(async (socket, next) => {
    try {
      const user = socket.request.user;
      
      if (!user) {
        logger.warn('[Socket Auth] No user found in session');
        return next(new Error('Authentication required'));
      }

      if (!user.isActive) {
        return next(new Error('User account is inactive'));
      }

      // Populate user data from cache or DB for consistency
      let fullUser = userCache.get(user._id.toString());
      
      if (!fullUser) {
        fullUser = await User.findById(user._id).select('name email role isActive studentId profilePic').lean();
        if (fullUser) {
          if (!fullUser.profilePic || fullUser.profilePic.trim() === '') {
            const hash = crypto.createHash('md5').update(fullUser.email.trim().toLowerCase()).digest('hex');
            fullUser.profilePic = `https://www.gravatar.com/avatar/${hash}?d=identicon&s=200`;
          }
          fullUser.avatar = fullUser.profilePic;
          userCache.set(user._id.toString(), fullUser);
        }
      }

      if (!fullUser) return next(new Error('User not found'));

      socket.user = fullUser;
      next();
    } catch (err) {
      logger.error('Socket Auth Error', { error: err.message });
      next(new Error('Authentication failed'));
    }
  });

  // ── Connection ─────────────────────────────────────────
  io.on('connection', (socket) => {
    logger.debug(`⚡ Socket connected: ${socket.id} (user: ${socket.user.name})`);

    // FIX P4: Join a personal room named by userId.
    // This allows profile.service.js to use io.to(userId).emit() instead of io.emit(),
    // preventing a global broadcast fan-out to all 1,200+ connected clients on every
    // profile update. Each client only receives updates relevant to them.
    const userIdStr = socket.user._id.toString();
    socket.join(userIdStr);
    logger.debug(`[Socket] User ${socket.user.name} joined personal room: ${userIdStr}`);

    // Register all handlers
    sessionHandler(io, socket);
    chatHandler(io, socket);
    mediaHandler(io, socket);

    socket.on('disconnect', (reason) => {
      logger.debug(`🔌 Socket disconnected: ${socket.id} — ${reason}`);
      // FIX Bug Class 1: Evict stale user cache on disconnect if no other sockets
      // remain for this user. Prevents cache from growing with stale entries for
      // users who have fully disconnected.
      const userId = socket.user._id.toString();
      const userRoom = io.sockets.adapter.rooms.get(userId);
      if (!userRoom || userRoom.size === 0) {
        userCache.del(userId); // Use .del() — installed lru-cache version API
      }
    });

    socket.on('error', (err) => {
      logger.error('Socket error', { socketId: socket.id, error: err.message });
    });
  });

  return io;
}

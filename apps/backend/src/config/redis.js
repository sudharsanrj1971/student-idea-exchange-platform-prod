import { createClient } from 'redis';
import { logger } from './logger.js';

export let redisClient = null;

export async function connectRedis() {
  const client = createClient({ 
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    // ── High-Concurrency Redis Tuning ──────────────────────
    commandTimeout: 5000,        // 5s max per command — prevent hung ops under load
    disableOfflineQueue: false,  // Buffer commands during reconnect (don't drop)
    socket: {
      connectTimeout: 2000,      // 2s connection timeout in dev to avoid hung startup
      keepAlive: 5000,           // TCP keepalive every 5s — detect dead connections fast
      noDelay: true,             // Disable Nagle algorithm for low-latency pub/sub
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          logger.warn('Redis reconnection failed after 10 attempts. Stopping retries.');
          return false;
        }
        return Math.min(retries * 100, 3000);
      }
    }
  });
  
  client.on('error', (err) => {
    // Only log critical errors, ignore connection refused in dev if not first attempt
    if (process.env.NODE_ENV !== 'production' && err.code === 'ECONNREFUSED') {
      return; 
    }
    logger.error('Redis client error', { error: err.message });
  });
  
  try {
    await client.connect();
    redisClient = client;
    logger.info('✅ Connected to Redis');
  } catch (err) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('❌ FATAL: Redis connection failed in Production!', { error: err.message });
      // In production, we might want to exit, but let's stick to logging for now as per index.js
    } else {
      logger.warn('⚠️  Redis connection failed. Scaling and real-time features will be limited.', { error: err.message });
    }
  }
  return client;
}

import { logger } from './logger.js';

export function validateEnv() {
  const isProd = process.env.NODE_ENV === 'production';
  
  const required = isProd ? [
    'MONGODB_URI',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'REDIS_URL',
    'FRONTEND_URL',
    'GOOGLE_CALLBACK_URL'
  ] : [
    'MONGODB_URI' // Only MongoDB is strictly required for dev if others have defaults
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    logger.error(`CRITICAL: Missing required environment variables: ${missing.join(', ')}`);
    if (isProd) {
      process.exit(1);
    } else {
      logger.warn('⚠️  Continuing in development mode with missing variables. Some features may not work.');
    }
  }

  // Set defaults for optional vars in dev
  if (!isProd && process.env.NODE_ENV !== 'test') {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-1234567890';
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-1234567890';
    process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
    process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
    process.env.NODE_ENV = process.env.NODE_ENV || 'development';
  }

  // Mediasoup specific production check
  if (isProd && !process.env.MEDIASOUP_ANNOUNCED_IP) {
    logger.error('CRITICAL: MEDIASOUP_ANNOUNCED_IP is required in production.');
    process.exit(1);
  }

  // Warning for production secrets using dev defaults
  if (isProd) {
    if (process.env.JWT_SECRET?.includes('dev-')) {
      logger.warn('WARNING: Using development JWT_SECRET in production!');
    }
  }

  logger.info('Environment variables validated successfully.');
}

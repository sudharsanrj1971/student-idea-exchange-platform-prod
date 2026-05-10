import rateLimit from 'express-rate-limit';

const isLoadTest = process.env.LOAD_TEST_MODE === 'true';

// General API limiter
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isLoadTest ? 1000000 : 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please slow down' },
});

// Strict limiter for auth endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isLoadTest ? 1000000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts — try again in 15 minutes' },
});

// Link code join limiter (prevent enumeration)
export const linkCodeRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isLoadTest ? 1000000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many join requests — please slow down' },
});
// Profile update limiter
export const profileRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isLoadTest ? 1000000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many profile updates — please try again later' },
});

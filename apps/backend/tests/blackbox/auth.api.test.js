import request from 'supertest';
import express from 'express';
import { apiRateLimiter } from '../../src/middleware/rateLimiter.js';
import authRoutes from '../../src/routes/auth.routes.js';
import cookieParser from 'cookie-parser';
import { bootstrapPromise } from '../../src/index.js';

import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(apiRateLimiter);
app.use('/api/auth', authRoutes);

describe('Auth API - Black Box', () => {

  beforeAll(async () => {
    // Ensure the DB and all services are ready (bootstrapped by index.js)
    await bootstrapPromise;
  });

  describe('POST /api/auth/register', () => {
    it('should register a new valid user securely and return HTTP Only cookies', async () => {
      const payload = {
        name: 'API Tester',
        email: 'api.tester.1@domain.com',
        password: 'SecurePassword2024!',
        role: 'teacher'
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(payload)
        .expect(201);

      // Validate JSON response
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(payload.email);
      expect(res.body.user.passwordHash).toBeUndefined(); // Ensure sensitive data is stripped

      // Validate HttpOnly Cookie attachment
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const refreshTokenCookie = cookies.find(c => c.includes('refreshToken='));
      expect(refreshTokenCookie).toBeDefined();
      expect(refreshTokenCookie).toContain('HttpOnly'); // Key secure vector
    });

    it('should return 400 Bad Request for un-met password strength parameters (if active)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'API Tester',
          email: 'api.tester.shortpass@domain.com',
          password: '123' // Too short, fails standard length
        })
        .expect(400);

      expect(res.body.error).toBeDefined();
    });
  });
});

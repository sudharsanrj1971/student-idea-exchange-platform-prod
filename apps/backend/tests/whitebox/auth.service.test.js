import { jest } from '@jest/globals';

// Set up mock env vars BEFORE imports
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.GOOGLE_CLIENT_ID = 'test-google-val';
process.env.NODE_ENV = 'test';

import { registerUser, loginUser } from '../../src/services/auth.service.js';
import { User } from '../../src/models/User.model.js';
import { UserProfile } from '../../src/models/UserProfile.model.js';
import jwt from 'jsonwebtoken';

describe('Auth Service - White Box', () => {
  afterEach(async () => {
    await User.deleteMany({});
    await UserProfile.deleteMany({});
  });

  describe('User Registration', () => {
    it('should cleanly hash the password and generate tokens', async () => {
      const payload = {
        name: 'Test Student',
        email: 'tester@ichange.edu',
        password: 'securePassword123',
        role: 'student',
        studentId: '99CS1111'
      };

      const result = await registerUser(payload);
      
      expect(result.user).toHaveProperty('_id');
      expect(result.user.email).toBe('tester@ichange.edu');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();

      // Validate that DB schema defaults/overrides apply correctly
      expect(result.user.role).toBe('student');

      // JWT Decode test
      const decodedUser = jwt.verify(result.accessToken, process.env.JWT_SECRET);
      expect(decodedUser.id).toBe(result.user._id.toString());
    });

    it('should reject duplicate email addresses', async () => {
      const payload = {
        name: 'Test Student',
        email: 'duplicate@ichange.edu',
        password: 'password123',
      };

      await registerUser(payload); // Create first

      // Attempt second creation
      await expect(registerUser(payload)).rejects.toThrow('Email already registered');
    });
  });

  describe('User Login & Load Test Bypass', () => {
    beforeEach(async () => {
      await registerUser({
        name: 'Active User',
        email: 'login@ichange.edu',
        password: 'validPassword!',
      });
    });

    it('should authenticate with a valid password', async () => {
      const result = await loginUser({ email: 'login@ichange.edu', password: 'validPassword!' });
      expect(result.accessToken).toBeDefined();
      expect(result.user.name).toBe('Active User');
    });

    it('should reject an invalid password', async () => {
      await expect(loginUser({ email: 'login@ichange.edu', password: 'wrong' }))
        .rejects.toThrow('Invalid email or password');
    });

    it('should bypass expensive strict bcrypt matching during specific load test modes', async () => {
      // Temporarily enable LOAD_TEST bypass via module memory structure
      process.env.LOAD_TEST_MODE = 'true';
      
      // Seed a specifically tailored loadtest user
      await registerUser({
        name: 'Bot',
        email: 'loadtest-bot1@ichange.edu',
        password: 'any_password',
      });

      // Attempt to login with an intentionally mismatched password 
      // The load test rule states: If it starts with 'loadtest-', it bypasses bcrypt.
      const result = await loginUser({ email: 'loadtest-bot1@ichange.edu', password: 'does_not_matter' });
      expect(result).toBeDefined();

      process.env.LOAD_TEST_MODE = 'false'; // Teardown
    });
  });
});

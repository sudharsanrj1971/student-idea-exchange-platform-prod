import request from 'supertest';
import { app } from '../src/index.js';
import { sanitize } from '../src/utils/sanitizer.js';
import { getOffset } from '../src/utils/pagination.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
//  SHARED HELPERS & CONFIG
// ============================================================

let userAToken, userBToken, userBSessionId;

const USER_A = { name: 'User A', email: 'usera@ichange.app', password: 'SecureA@1234' };
const USER_B = { name: 'User B', email: 'userb@ichange.app', password: 'SecureB@1234' };

async function registerAndLogin(user) {
  // Use /api/auth/register and /api/auth/login
  await request(app).post('/api/auth/register').send(user);
  const res = await request(app).post('/api/auth/login').send({
    email: user.email,
    password: user.password,
  });
  return res.body.accessToken;
}

function generateTokenWithExpiry(seconds) {
  const payload = { id: 'dummy-id' };
  const secret = process.env.JWT_SECRET || 'test-secret';
  return jwt.sign(payload, secret, { expiresIn: seconds });
}

// ============================================================
//  SETUP / TEARDOWN
// ============================================================

beforeAll(async () => {
  // Ensure env vars for testing
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';

  // Reset tokens and sessions for each test suite to avoid interference
  userAToken = await registerAndLogin(USER_A);
  userBToken = await registerAndLogin(USER_B);

  // User B creates a session that User A will try to delete
  const sessionRes = await request(app)
    .post('/api/sessions')
    .set('Authorization', `Bearer ${userBToken}`)
    .send({ title: 'User B Session', description: 'Testing ownership' });
  userBSessionId = sessionRes.body.session._id;
});

afterAll(async () => {
  // Disconnect is handled cleanly by tests/setup/db.js
});

// ============================================================
//  1. BLACKBOX TESTS — Functional
// ============================================================

describe('Blackbox — Functional', () => {

  // ── Registration ──────────────────────────────────────────

  describe('POST /api/auth/register', () => {
    it('201 with valid payload; no password in response', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'New User', email: 'new@ichange.app', password: 'Valid@1234' });

      expect(res.status).toBe(201);
      expect(res.body.user).toHaveProperty('_id');
      expect(res.body.user).toHaveProperty('email', 'new@ichange.app');
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('400 when email is missing (via express-validator)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Bad', email: '', password: 'Valid@1234' });

      expect(res.status).toBe(400);
      expect(res.body.details[0]).toHaveProperty('field', 'email');
    });

    it('400 when password is too short (< 6 chars in this project)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Bad', email: 'short@ichange.app', password: 'x' });

      expect(res.status).toBe(400);
      expect(res.body.details[0]).toHaveProperty('field', 'password');
    });

    it('409 when email already registered', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(USER_A);

      expect(res.status).toBe(409);
    });
  });

  // ── Login ─────────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    it('200 with valid credentials; returns accessToken', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: USER_A.email, password: USER_A.password });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
    });

    it('401 with wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: USER_A.email, password: 'WrongPass' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });
  });

  // ── Protected routes ──────────────────────────────────────

  describe('Protected routes', () => {
    it('401 when no Authorization header', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('401 with malformed token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer not.a.real.token');
      expect(res.status).toBe(401);
    });

    it('200 with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${userAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(USER_A.email);
    });
  });

  // ── Authorization ─────────────────────────────────────────

  describe('DELETE /api/sessions/:id — ownership check', () => {
    it('403 when User A tries to delete User B session', async () => {
      const res = await request(app)
        .delete(`/api/sessions/${userBSessionId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Unauthorized/i);
    });

    it('200 when User B deletes their own session', async () => {
      const res = await request(app)
        .delete(`/api/sessions/${userBSessionId}`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Session deleted');
    });
  });

});

// ============================================================
//  2. BLACKBOX TESTS — Security / Edge Cases
// ============================================================

describe('Blackbox — Security & Edge Cases', () => {

  it('NoSQL injection in email field is blocked by validator', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: { "$gt": "" }, password: 'anything' });

    // The validator catches that email is not a string/valid-email
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('oversized join payload (1.1MB) is rejected with 413', async () => {
    const bigString = 'X'.repeat(1.1 * 1024 * 1024);
    const res = await request(app)
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ name: bigString, email: 'big@test.app', password: 'Valid@1234' }));

    expect(res.status).toBe(413);
  });

});

// ============================================================
//  3. WHITEBOX — Unit Tests
// ============================================================

describe('Whitebox — Unit', () => {

  // ── JWT utils ─────────────────────────────────────────────

  describe('JWT Verification', () => {
    it('fails for expired token', () => {
      const expired = generateTokenWithExpiry('-1s');
      expect(() => jwt.verify(expired, process.env.JWT_SECRET)).toThrow();
    });

    it('decodes payload for valid token', () => {
      const valid = generateTokenWithExpiry('1h');
      const decoded = jwt.verify(valid, process.env.JWT_SECRET);
      expect(decoded).toHaveProperty('id', 'dummy-id');
    });
  });

  // ── Password hashing ──────────────────────────────────────

  describe('Bcrypt hashing', () => {
    it('produces different hash each call', async () => {
      const h1 = await bcrypt.hash('TestPass@1', 8);
      const h2 = await bcrypt.hash('TestPass@1', 8);
      expect(h1).not.toBe(h2);
    });

    it('compare returns true for correct input', async () => {
      const hash = await bcrypt.hash('TestPass@1', 8);
      const result = await bcrypt.compare('TestPass@1', hash);
      expect(result).toBe(true);
    });
  });

  // ── Sanitizer ─────────────────────────────────────────────

  describe('sanitize()', () => {
    it('strips <script> tags', () => {
      expect(sanitize("<script>alert(1)</script>")).toBe('');
    });

    it('removes event handlers', () => {
      expect(sanitize('<img onerror="xss">')).not.toContain('onerror');
    });

    it('preserves clean text', () => {
      expect(sanitize('Hello world')).toBe('Hello world');
    });
  });

  // ── Pagination ────────────────────────────────────────────

  describe('getOffset(page, limit)', () => {
    it('page 1 → offset 0', () => expect(getOffset(1, 20)).toBe(0));
    it('page 2 → offset 20', () => expect(getOffset(2, 20)).toBe(20));
  });

});

// ============================================================
//  4. LOAD TEST CONFIG — Artillery
// ============================================================

const ARTILLERY_CONFIG = `
config:
  target: "http://localhost:5000"
  phases:
    - name: "Warm up"
      duration: 60
      arrivalRate: 5
    - name: "Ramp to load"
      duration: 120
      arrivalRate: 5
      rampTo: 50
    - name: "Sustained load"
      duration: 180
      arrivalRate: 50

  defaults:
    headers:
      Content-Type: "application/json"

  ensure:
    p95: 500
    maxErrorRate: 1

scenarios:
  - name: "Auth + Browse Sessions"
    flow:
      - post:
          url: "/api/auth/login"
          json:
            email: "user@ichange.app"
            password: "Password123"
          capture:
            - json: "$.accessToken"
              as: "token"
      - get:
          url: "/api/auth/me"
          headers:
            Authorization: "Bearer {{ token }}"
      - get:
          url: "/api/sessions"
          headers:
            Authorization: "Bearer {{ token }}"
`.trim();

// Auto-generate artillery.yml when this file is run directly
if (import.meta.url === `file://${path.resolve(process.argv[1])}`.replace(/\\/g, '/')) {
  const out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'artillery.yml');
  fs.writeFileSync(out, ARTILLERY_CONFIG, 'utf8');
  console.log(`artillery.yml written to ${out}`);
}

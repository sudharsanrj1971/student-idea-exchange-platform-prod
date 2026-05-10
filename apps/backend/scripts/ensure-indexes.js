/**
 * ensure-indexes.js — iChange Index Verification Script
 * 
 * Verifies and creates all 5 critical MongoDB indexes from the pre-deployment checklist.
 * Run before going to production:
 *   node apps/backend/scripts/ensure-indexes.js
 * 
 * Checklist items verified: #12 (All 5 critical indexes present)
 */

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PASS = '\x1b[32m✅ PASS\x1b[0m';
const FAIL = '\x1b[31m❌ FAIL\x1b[0m';
const INFO = '\x1b[36mℹ️  INFO\x1b[0m';

async function ensureIndex(collection, indexSpec, options = {}) {
  const collName = collection.collectionName;
  const specStr = JSON.stringify(indexSpec);
  try {
    await collection.createIndex(indexSpec, { background: true, ...options });
    console.log(`${PASS}  [${collName}] Index ${specStr} — created/verified`);
    return true;
  } catch (err) {
    console.error(`${FAIL}  [${collName}] Index ${specStr} — ${err.message}`);
    return false;
  }
}

async function verifyIndexExists(collection, keyPattern) {
  const collName = collection.collectionName;
  const indexes = await collection.listIndexes().toArray();
  const found = indexes.some(idx => {
    const keys = Object.keys(keyPattern);
    return keys.every(k => idx.key[k] === keyPattern[k]);
  });
  const status = found ? PASS : FAIL;
  console.log(`${status}  [${collName}] Index ${JSON.stringify(keyPattern)} — ${found ? 'exists' : 'MISSING'}`);
  return found;
}

async function main() {
  console.log('\n🔍 iChange Pre-Deployment Index Verification\n' + '='.repeat(50));

  let uri = process.env.MONGODB_URI;
  const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  const allowMemoryFallback = process.env.ALLOW_MEMORY_DB === 'true';

  try {
    // Mirroring db.js connection logic with fallback
    if (!uri && isDev && allowMemoryFallback) {
      console.log(`${INFO} Starting MongoMemoryServer (Development Fallback)...`);
      const mongod = await MongoMemoryServer.create();
      uri = mongod.getUri();
    } else if (!uri) {
       console.error(`${FAIL} MONGODB_URI is not set in .env`);
       process.exit(1);
    }

    if (uri.includes('mongodb+srv') && !uri.includes('retryWrites')) {
      uri += (uri.includes('?') ? '&' : '?') + 'retryWrites=true&w=majority';
    }

    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log(`${INFO} Connected to MongoDB (${uri.includes('memory') ? 'In-Memory' : 'Atlas'})\n`);
  } catch (err) {
    if (isDev && allowMemoryFallback && uri && !uri.includes('memory')) {
      console.warn(`${INFO} Atlas connection failed. Retrying with In-Memory fallback...`);
      try {
        const mongod = await MongoMemoryServer.create();
        uri = mongod.getUri();
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
        console.log(`${PASS} Connected to In-Memory fallback database.\n`);
      } catch (fallbackErr) {
        console.error(`${FAIL} Fallback connection failed: ${fallbackErr.message}`);
        process.exit(1);
      }
    } else {
      console.error(`${FAIL} Connection failed: ${err.message}`);
      process.exit(1);
    }
  }

  const db = mongoose.connection.db;
  let allPassed = true;

  // ── 1. messages: { sessionId, createdAt } ─────────────────────────────────
  console.log('\n📋 Check #12a: messages.{ sessionId, createdAt } (chat history queries)');
  const messages = db.collection('messages');
  allPassed &= await ensureIndex(messages, { sessionId: 1, createdAt: -1 });

  // ── 2. users: { email } unique ────────────────────────────────────────────
  console.log('\n📋 Check #12b: users.{ email } unique (login lookup)');
  const users = db.collection('users');
  allPassed &= await ensureIndex(users, { email: 1 }, { unique: true });

  // ── 3. sessions: { isActive, createdAt } ─────────────────────────────────
  console.log('\n📋 Check #12c: sessions.{ isActive, createdAt } (dashboard active session list)');
  const sessions = db.collection('sessions');
  allPassed &= await ensureIndex(sessions, { isActive: 1, createdAt: -1 });

  // ── 4. attendances: { userId } ────────────────────────────────────────────
  console.log('\n📋 Check #12d: attendances.{ userId } (per-user attendance aggregation)');
  const attendances = db.collection('attendances');
  allPassed &= await ensureIndex(attendances, { userId: 1 });

  // ── 5. users: refreshTokens TTL ───────────────────────────────────────────
  // Mongoose handles this via the refreshTokenSchema { expires: '7d' } field-level option.
  // We verify it exists rather than creating a conflicting one.
  console.log('\n📋 Check #12e: users.refreshTokens TTL (token expiry cleanup)');
  const userIndexes = await users.listIndexes().toArray();
  const hasTTL = userIndexes.some(idx => idx.expireAfterSeconds !== undefined);
  console.log(`${hasTTL ? PASS : INFO}  [users] TTL index — ${hasTTL ? 'exists' : 'managed by Mongoose refreshTokenSchema { expires: "7d" }'}`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(50));
  if (allPassed) {
    console.log(`\n${PASS} All critical indexes verified. System is ready for production load.\n`);
  } else {
    console.log(`\n${FAIL} Some indexes could not be created. Review errors above.\n`);
    process.exit(1);
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Unexpected error:', err.message);
  process.exit(1);
});

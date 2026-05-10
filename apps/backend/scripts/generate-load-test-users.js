/**
 * generate-load-test-users.js — Artillery CSV Generator
 *
 * Creates 1,200 test user accounts in the database and exports
 * a users.csv file with JWT tokens for use in the Artillery load test.
 *
 * Run: node apps/backend/scripts/generate-load-test-users.js
 * Output: ./users.csv (in the workspace root)
 *
 * Prerequisite: Backend server must be running OR MONGODB_URI must be set.
 */

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOTAL_USERS = 1200;
const BATCH_SIZE = 100;
const OUTPUT_FILE = path.resolve(__dirname, '../../../users.csv');

// Minimal inline User schema — avoids importing full model with all hooks
const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  passwordHash: String,
  role: { type: String, default: 'student' },
  isActive: { type: Boolean, default: true },
  studentId: String,
  profilePic: String,
  refreshTokens: [],
}, { timestamps: true });

async function main() {
  console.log('\n🧪 iChange Artillery Load Test User Generator');
  console.log('='.repeat(50));

  let uri = process.env.MONGODB_URI;
  const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  const allowMemoryFallback = process.env.ALLOW_MEMORY_DB === 'true';

  try {
    if (!uri && isDev && allowMemoryFallback) {
      console.log('ℹ️  Starting MongoMemoryServer (Development Fallback)...');
      const mongod = await MongoMemoryServer.create();
      uri = mongod.getUri();
    } else if (!uri) {
      console.error('❌ MONGODB_URI not set. Exiting.');
      process.exit(1);
    }

    if (uri.includes('mongodb+srv') && !uri.includes('retryWrites')) {
      uri += (uri.includes('?') ? '&' : '?') + 'retryWrites=true&w=majority';
    }

    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log(`✅ Connected to MongoDB (${uri.includes('memory') ? 'In-Memory' : 'Atlas'})`);
  } catch (err) {
    if (isDev && allowMemoryFallback && uri && !uri.includes('memory')) {
      console.warn('ℹ️  Atlas connection failed. Retrying with In-Memory fallback...');
      try {
        const mongod = await MongoMemoryServer.create();
        uri = mongod.getUri();
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
        console.log('✅ Connected to In-Memory fallback database.');
      } catch (fallbackErr) {
        console.error('❌ Fallback connection failed:', fallbackErr.message);
        process.exit(1);
      }
    } else {
      console.error('❌ Connection failed:', err.message);
      process.exit(1);
    }
  }

  const User = mongoose.models.User || mongoose.model('User', UserSchema);
  const Session = mongoose.connection.db.collection('sessions');

  // Get or create a test room
  let testSession = await Session.findOne({ title: 'Artillery Load Test Room' });
  if (!testSession) {
    const result = await Session.insertOne({
      title: 'Artillery Load Test Room',
      description: 'Auto-generated for load testing',
      linkCode: 'LOADTEST01',
      host: new mongoose.Types.ObjectId(),
      isActive: true,
      isDeleted: false,
      participants: [],
      maxParticipants: 1500,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    testSession = { _id: result.insertedId };
    console.log('✅ Created Artillery test room');
  }

  const roomId = testSession._id.toString();
  const jwtSecret = process.env.JWT_SECRET || 'dev-secret-1234567890';
  const rows = ['token,roomId,userId'];
  let created = 0;
  let skipped = 0;

  console.log(`\n📝 Generating ${TOTAL_USERS} test users in batches of ${BATCH_SIZE}...`);

  for (let batch = 0; batch < Math.ceil(TOTAL_USERS / BATCH_SIZE); batch++) {
    const batchUsers = [];
    const start = batch * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, TOTAL_USERS);

    for (let i = start; i < end; i++) {
      const paddedId = String(i + 1).padStart(4, '0');
      const email = `loadtest-${paddedId}@ichange.test`;
      const userId = new mongoose.Types.ObjectId();
      const gravatarHash = crypto.createHash('md5').update(email).digest('hex');

      batchUsers.push({
        _id: userId,
        name: `Load Tester ${paddedId}`,
        email,
        passwordHash: '$2b$08$placeholderHashForLoadTest1234567890',
        role: 'student',
        isActive: true,
        studentId: `LT${paddedId}`,
        profilePic: `https://www.gravatar.com/avatar/${gravatarHash}?d=identicon&s=200`,
        refreshTokens: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Bulk insert with ordered: false to skip existing (unique email constraint)
    try {
      const result = await User.collection.insertMany(batchUsers, {
        ordered: false,
        lean: true,
      });
      created += result.insertedCount;
    } catch (err) {
      // BulkWriteError: duplicate key errors are expected for re-runs
      if (err.code === 11000 || err.name === 'BulkWriteError') {
        const inserted = err.result?.nInserted || 0;
        created += inserted;
        skipped += BATCH_SIZE - inserted;
      } else {
        throw err;
      }
    }

    // Generate JWT tokens for all users in this batch (regardless of insert result)
    for (const u of batchUsers) {
      const token = jwt.sign(
        { id: u._id.toString(), email: u.email, role: u.role },
        jwtSecret,
        { expiresIn: '2h' }  // 2h covers the full load test duration
      );
      rows.push(`${token},${roomId},${u._id.toString()}`);
    }

    const pct = Math.round((Math.min(end, TOTAL_USERS) / TOTAL_USERS) * 100);
    process.stdout.write(`\r  Progress: ${pct}% (${Math.min(end, TOTAL_USERS)}/${TOTAL_USERS})`);
  }

  console.log('\n');

  // Write CSV
  fs.writeFileSync(OUTPUT_FILE, rows.join('\n'), 'utf8');

  console.log('='.repeat(50));
  console.log(`✅ Created: ${created} new users`);
  console.log(`⏩ Skipped: ${skipped} existing users`);
  console.log(`📄 CSV written to: ${OUTPUT_FILE}`);
  console.log(`🏠 Test room ID: ${roomId}`);
  console.log('\n▶ Next step:');
  console.log('  artillery run ichange-load-test.yml --output report.json');
  console.log('  artillery report report.json\n');

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('\n❌ Generator failed:', err.message);
  process.exit(1);
});

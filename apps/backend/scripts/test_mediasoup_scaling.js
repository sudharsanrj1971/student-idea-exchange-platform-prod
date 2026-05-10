import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
import { connectDB } from '../src/config/db.js';
import { createWorkerPool } from '../src/mediasoup/worker.js';
import { createSession } from '../src/services/session.service.js';
import { Session } from '../src/models/Session.model.js';
import { User } from '../src/models/User.model.js';
import { logger } from '../src/config/logger.js';
import mongoose from 'mongoose';

async function runTest() {
  try {
    logger.info('Starting Mediasoup Scaling Test...');
    await connectDB();
    await createWorkerPool();

    // 1. Create a dummy host user (required for session host reference)
    const User = mongoose.model('User');
    const hostUser = await User.create({
      name: 'Scaling Test User',
      email: `test-${Date.now()}@ichange.com`,
      password: 'password123'
    });
    const hostId = hostUser._id;

    const session = await createSession({
      title: 'Scaling Test Session',
      description: 'Verifying worker affinity',
      hostId
    });

    logger.info(`Session created with linkCode: ${session.linkCode}`);
    logger.info(`Pre-assigned Worker Index: ${session.workerId}`);

    if (session.workerId === null) {
      throw new Error('Worker was not pre-assigned to the session');
    }

    // 2. Get router (should use the pre-assigned worker)
    const router = await getRouter(session._id.toString());
    logger.info(`Router created with ID: ${router.id}`);

    // 3. Verify router ID is now in the DB (with retry for eventual consistency)
    let updatedSession = null;
    for (let i = 0; i < 5; i++) {
      updatedSession = await mongoose.model('Session').findById(session._id);
      if (updatedSession.routerId) break;
      logger.info(`Waiting for routerId to persist... (attempt ${i+1})`);
      await new Promise(r => setTimeout(r, 500));
    }

    logger.info(`Verification result:`, {
      originalSessionId: session._id,
      returnedRouterId: router.id,
      dbRouterId: updatedSession?.routerId,
      dbWorkerId: updatedSession?.workerId
    });

    if (!updatedSession?.routerId || updatedSession.routerId !== router.id) {
       throw new Error(`Router ID mismatch! Expected ${router.id}, found ${updatedSession?.routerId}`);
    }

    logger.info('✅ Mediasoup Scaling Test PASSED');
    process.exit(0);
  } catch (err) {
    logger.error('❌ Mediasoup Scaling Test FAILED', { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

runTest();

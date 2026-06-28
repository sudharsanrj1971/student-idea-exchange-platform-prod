import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// This file is loaded as setupFilesAfterEnv for ALL test suites.
// For integration tests that import src/index.js, the DB is managed by the bootstrap.
// For whitebox unit tests that DON'T import index.js, we create an in-memory DB here.

let mongoServer = null;
let ownedConnection = false;

beforeAll(async () => {
  // Wait a moment to let any module-level bootstrap start
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // If already connected (from index.js bootstrap), just defer
  if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
    return;
  }

  // Only create our own DB for pure unit tests (no index.js bootstrap)
  ownedConnection = true;
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri, { maxPoolSize: 10 });
});

afterAll(async () => {
  if (!ownedConnection) return;
  
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
  ownedConnection = false;
});





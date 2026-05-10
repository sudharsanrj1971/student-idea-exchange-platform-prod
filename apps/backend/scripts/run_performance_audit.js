import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { connectDB, closeDB } from '../src/config/db.js';
import { User } from '../src/models/User.model.js';
import { logger } from '../src/config/logger.js';

const TEST_USER = {
  name: 'Load Test User',
  email: 'loadtest-user@ichange.app',
  password: 'Password123', // Raw password for login
  passwordHash: 'Password123', // Will be hashed by model pre-save hook
  role: 'student'
};

async function ensureTestUser() {
  logger.info('Ensuring load test user exists...');
  await connectDB();
  
  let user = await User.findOne({ email: TEST_USER.email });
  if (!user) {
    user = new User({
      name: TEST_USER.name,
      email: TEST_USER.email,
      passwordHash: TEST_USER.passwordHash,
      role: TEST_USER.role
    });
    await user.save();
    logger.info('Created new load test user.');
  } else {
    logger.info('Load test user already exists.');
  }
  
  await closeDB();
}

async function runTest(configPath) {
  return new Promise((resolve, reject) => {
    logger.info(`Starting Artillery test with config: ${configPath}`);
    const artillery = spawn('npx', ['artillery', 'run', configPath], {
      stdio: 'inherit',
      shell: true
    });

    artillery.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Artillery exited with code ${code}`));
      }
    });
  });
}

async function main() {
  try {
    // 1. Preparation
    await ensureTestUser();
    
    logger.info('Preparation complete. You should now start the server with "npm run dev" and then run "npx artillery run tests/stress_test.yml"');
    logger.info('Alternatively, run "npm test tests/stress_test.yml"');
    
  } catch (err) {
    logger.error('Performance Audit failed', { error: err.message });
    process.exit(1);
  }
}

main();

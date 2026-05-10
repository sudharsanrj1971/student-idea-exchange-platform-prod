import { io } from 'socket.io-client';
import axios from 'axios';
import 'dotenv/config';

const URL = 'http://localhost:5000';
const NUM_CLIENTS = 1000;
const STEP = 50; // New clients per second
const TEST_DURATION_MS = 60000; // 1 minute

async function login() {
  try {
    const res = await axios.post(`${URL}/api/auth/login`, {
      email: 'testuser@ichange.com',
      password: 'password123'
    });
    return res.data.accessToken;
  } catch (err) {
    console.error('Login failed. Make sure setup_test_user.js was run and server is up.');
    process.exit(1);
  }
}

async function run() {
  console.log(`\n--- Starting Socket.io Load Test (${NUM_CLIENTS} clients) ---`);
  const token = await login();
  console.log('✅ Authenticated. Starting connections...');

  let connectedCount = 0;
  let errorCount = 0;
  const clients = [];

  const start = Date.now();

  const createClient = (i) => {
    const socket = io(URL, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true
    });

    socket.on('connect', () => {
      connectedCount++;
      if (connectedCount % 100 === 0) {
        console.log(`Connected: ${connectedCount}/${NUM_CLIENTS}`);
      }
    });

    socket.on('connect_error', (err) => {
      errorCount++;
      // console.error(`Connection error client ${i}:`, err.message);
    });

    clients.push(socket);
  };

  // Ramp up
  for (let i = 0; i < NUM_CLIENTS; i++) {
    createClient(i);
    if (i % STEP === 0) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  // Monitor for duration
  console.log(`Waiting ${TEST_DURATION_MS / 1000}s for stability...`);
  await new Promise(r => setTimeout(r, TEST_DURATION_MS));

  const end = Date.now();
  console.log('\n--- Load Test Results ---');
  console.log(`Total Target: ${NUM_CLIENTS}`);
  console.log(`Successfully Connected: ${connectedCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Efficiency: ${((connectedCount / NUM_CLIENTS) * 100).toFixed(2)}%`);
  console.log(`Duration: ${(end - start) / 1000}s`);

  // Cleanup
  console.log('Cleaning up connections...');
  clients.forEach(s => s.disconnect());
  process.exit(0);
}

run().catch(console.error);

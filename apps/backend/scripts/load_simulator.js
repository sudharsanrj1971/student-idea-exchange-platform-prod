import { io } from 'socket.io-client';
import axios from 'axios';

process.on('unhandledRejection', (err) => {
  console.error('[Unhandled Rejection]', err);
});

const TARGET_URL = 'http://localhost:5000';
const NUM_USERS = parseInt(process.env.USERS_PER_PROCESS) || 1200;
const RAMP_UP_MS = parseInt(process.env.RAMP_UP_MS) || 50; // Delay between connections

let activeSessionId = null;

async function simulateUser(index) {
  const email = `loadtest-user-${index}@ichange.com`;
  const password = 'password123';

  try {
    // 0. Register User (If not already present)
    // We swallow errors here as we expect them to exist after first run
    try {
      await axios.post(`${TARGET_URL}/api/auth/register`, {
        name: `Simulation User ${index}`,
        email,
        password
      });
    } catch {}

    // 1. Login (Simplified by LOAD_TEST_MODE)
    const { data } = await axios.post(`${TARGET_URL}/api/auth/login`, {
      email,
      password
    });
    
    const token = data.accessToken;
    
    // 2. Connect Socket
    const socket = io(TARGET_URL, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
      reconnection: true
    });

    socket.on('connect', () => {
      // 3. Join Session
      socket.emit('session:join', { sessionId: activeSessionId }, (res) => {
        if (res?.error) {
          console.error(`User ${index} (${email}) failed to join:`, res.error);
        }
      });
    });

    // 4. Periodic Reaction (Simulate Activity)
    const reactInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('session:reaction', { sessionId: activeSessionId, emoji: '🔥' });
      }
    }, 10000 + Math.random() * 5000);

    socket.on('disconnect', () => {
      clearInterval(reactInterval);
    });

  } catch (err) {
    console.error(`User ${index} simulation error:`, err.response?.data || err.message);
  }
}

async function run() {
  const SESSION_ID = process.env.SESSION_ID || '69db271684f2e4ec';
  activeSessionId = SESSION_ID;

  console.log(`Starting massive ${NUM_USERS} user simulation for session: ${activeSessionId}`);

  console.log(`Ramping up users at ${Math.round(1000/RAMP_UP_MS)} users/sec...`);

  for (let i = 0; i < NUM_USERS; i++) {
    simulateUser(i);
    if (i % 50 === 0) console.log(`Injected ${i} users...`);
    await new Promise(r => setTimeout(r, RAMP_UP_MS));
  }
}

run();

import { io } from 'socket.io-client';
import axios from 'axios';

const TARGET_URL = 'http://localhost:5000';
const NUM_USERS = 1200;
const RAMP_UP_MS = 100; // Total ramp up ~120s (smoother for local system)

process.on('unhandledRejection', (err) => {
  console.error('[Unhandled Rejection]', err);
});

async function simulateUser(index, sessionId) {
  const email = `loadtest-${Date.now()}-${index}@ichange.com`;
  const password = 'password123';

  try {
    // 1. Register & Login
    await axios.post(`${TARGET_URL}/api/auth/register`, {
      name: `User ${index}`,
      email,
      password
    });

    const loginRes = await axios.post(`${TARGET_URL}/api/auth/login`, {
      email,
      password
    });
    
    const token = loginRes.data.accessToken;
    
    // 2. Connect Socket
    const socket = io(TARGET_URL, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true
    });

    socket.on('connect', () => {
      // 3. Join Session
      socket.emit('session:join', { sessionId }, (res) => {
        if (res?.error) {
          console.error(`User ${index} join error:`, res.error);
        }
      });
    });

    // 4. Periodic Reaction
    const reactInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('session:reaction', { sessionId, emoji: '🎉' });
      }
    }, 15000 + Math.random() * 5000);

    socket.on('disconnect', () => {
      clearInterval(reactInterval);
    });

  } catch (err) {
    // Suppress spamming errors for individual users after ramp-up starts
    if (index % 100 === 0) {
        console.error(`User ${index} simulation error:`, err.response?.data || err.message);
    }
  }
}

async function orchestrate() {
  console.log('--- IChange Load Orchestrator Started ---');
  
  try {
    const adminEmail = `admin-${Date.now()}@ichange.com`;
    const password = 'password123';

    // 1. Create Admin & Session
    await axios.post(`${TARGET_URL}/api/auth/register`, { name: 'Admin', email: adminEmail, password });
    const auth = await axios.post(`${TARGET_URL}/api/auth/login`, { email: adminEmail, password });
    const token = auth.data.accessToken;

    const sessionRes = await axios.post(`${TARGET_URL}/api/sessions`, {
      title: 'Enterprise Scalability Test (1,200 Connection Stress)',
      description: 'Simulating high-concurrency signaling and SfU resource allocation.',
      scheduledAt: new Date().toISOString()
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const sessionId = sessionRes.data.session._id;
    console.log(`✅ Session Created: ${sessionId}`);
    console.log(`🚀 Starting simulation of ${NUM_USERS} users...`);

    for (let i = 0; i < NUM_USERS; i++) {
      simulateUser(i, sessionId);
      if (i > 0 && i % 100 === 0) {
        console.log(`[STATUS] Injected ${i} users...`);
      }
      await new Promise(r => setTimeout(r, RAMP_UP_MS));
    }

    console.log('--- ALL USERS INJECTED ---');
  } catch (err) {
    console.error('Orchestration failed:', err.response?.data || err.message);
  }
}

orchestrate();

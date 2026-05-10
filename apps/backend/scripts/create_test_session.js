import axios from 'axios';

async function create() {
  const email = `test-${Date.now()}@ichange.com`;
  const password = 'password123';

  try {
    // 1. Register
    await axios.post('http://localhost:5000/api/auth/register', {
      name: 'Load Test Admin',
      email,
      password
    });
    console.log(`Registered: ${email}`);

    // 2. Login
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
      email,
      password
    });
    const token = loginRes.data.accessToken;

    // 3. Create Session
    const sessionRes = await axios.post('http://localhost:5000/api/sessions', {
      title: '1,200 User Load Test Session',
      description: 'Stress testing the platform signaling and orchestration.',
      scheduledAt: new Date().toISOString()
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const sessionId = sessionRes.data.session._id;
    console.log('SESSION_ID=' + sessionId);
    return sessionId;
  } catch (err) {
    console.error('Failed:', err.response?.data || err.message);
    process.exit(1);
  }
}

create();

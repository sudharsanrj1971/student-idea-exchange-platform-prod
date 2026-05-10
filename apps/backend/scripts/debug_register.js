import axios from 'axios';

async function setup() {
  try {
    const res = await axios.post('http://localhost:5000/api/auth/register', {
      name: 'Load Test Host',
      email: `host-${Date.now()}@ichange.com`,
      password: 'password123'
    });
    console.log('Registration Success:', res.data);
  } catch (err) {
    console.log('Registration Failed:', err.response?.data || err.message);
  }
}

setup();

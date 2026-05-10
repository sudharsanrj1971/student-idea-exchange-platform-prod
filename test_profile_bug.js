import axios from 'axios';

const API_URL = 'http://localhost:5010/api/auth';

async function testLoginProfile() {
  try {
    const email = 'adminn@ichange.app';
    const password = 'password';
    
    console.log('Registering test user:', email);
    try {
      const regRes = await axios.post(`${API_URL}/register`, {
        name: 'Adminn User',
        email: email,
        password: password,
        role: 'admin'
      });
      console.log('Registration successful. Avatar:', regRes.data.user.avatar);
    } catch (e) {
      console.log('Registration failed (already exists or other error). Proceeding to login...');
    }

    console.log('\nLogging in test user...');
    const loginRes = await axios.post(`${API_URL}/login`, {
      email: email,
      password: password
    });
    console.log('Login successful. Avatar:', loginRes.data.user.avatar);

    if (!loginRes.data.user.avatar) {
      console.warn('BUG STILL PRESENT: Avatar is null');
    } else {
      console.log('SUCCESS: Avatar is present:', loginRes.data.user.avatar);
    }
  } catch (err) {
    if (err.response) {
      console.error('API Error:', err.response.status, err.response.data);
    } else {
      console.error('Network Error:', err.message);
    }
  }
}

testLoginProfile();

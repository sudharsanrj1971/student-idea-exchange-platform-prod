import axios from 'axios';

async function setup() {
  try {
    await axios.post('http://localhost:5000/api/auth/register', {
      name: 'Test User',
      email: 'testuser@ichange.com',
      password: 'password123'
    });
    console.log('User registered successfully');
  } catch (err) {
    console.log('User already exists or registration failed', err.response?.data || err.message);
  }
}

setup();

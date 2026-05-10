import axios from 'axios';

async function list() {
  const email = `testuser@ichange.com`;
  const password = 'password123';

  try {
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', { email, password });
    const token = loginRes.data.accessToken;
    const res = await axios.get('http://localhost:5000/api/api/sessions', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Sessions:', res.data.sessions);
  } catch (err) {
    // If login fails, try another approach?
    console.log('Failed:', err.response?.data || err.message);
  }
}
list();

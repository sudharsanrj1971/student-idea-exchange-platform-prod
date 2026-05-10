import axios from 'axios';

const API_URL = 'http://localhost:5010/api/auth';

async function testValidateAdmin() {
  try {
    console.log('Testing validate-email with admin email...');
    const res = await axios.get(`${API_URL}/validate-email?email=sudharsanrj1971@gmail.com`);
    console.log('Admin response:', res.data);
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
  }
}

testValidateAdmin();

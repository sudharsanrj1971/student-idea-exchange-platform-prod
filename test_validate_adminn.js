import axios from 'axios';

const API_URL = 'http://localhost:5010/api/auth';

async function testValidateAdminn() {
  try {
    console.log('Testing validate-email with "adminn"...');
    const res = await axios.get(`${API_URL}/validate-email?email=adminn`);
    console.log('Response:', res.data);
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
  }
}

testValidateAdminn();

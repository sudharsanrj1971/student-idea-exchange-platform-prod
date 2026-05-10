import axios from 'axios';

const API_URL = 'http://localhost:5010/api/auth';

async function testValidateEmail() {
  try {
    console.log('Testing validate-email with student ID...');
    const res1 = await axios.get(`${API_URL}/validate-email?email=410123205053`);
    console.log('Student ID response:', res1.data);

    console.log('\nTesting validate-email with non-existent email (should check Gravatar)...');
    const res2 = await axios.get(`${API_URL}/validate-email?email=test-gravatar@gmail.com`);
    console.log('Gravatar response:', res2.data);
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
  }
}

testValidateEmail();

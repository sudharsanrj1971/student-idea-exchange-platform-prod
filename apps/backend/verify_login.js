import axios from 'axios';

const BASE_URL = 'http://localhost:5010/api';

async function testLogin(identifier, password) {
  try {
    console.log(`Testing login for: ${identifier}...`);
    const resp = await axios.post(`${BASE_URL}/auth/login`, {
      email: identifier,
      password: password
    });
    console.log(`✅ Success for ${identifier}: User found is ${resp.data.user.name} (${resp.data.user.role})`);
    return true;
  } catch (err) {
    console.error(`❌ Failed for ${identifier}:`, err.response?.data?.error || err.message);
    return false;
  }
}

async function runTests() {
  const adminEmail = 'sudharsanrj1971@gmail.com';
  const adminId = '410123205053';
  const adminPass = '205053';

  await testLogin(adminEmail, adminPass);
  await testLogin(adminId, adminPass);
}

runTests();

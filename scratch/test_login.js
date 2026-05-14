import axios from 'axios';

async function testLogin() {
  try {
    const res = await axios.post('http://localhost:5010/api/auth/login', {
      email: 'test-student-unique-123@gmail.com',
      password: '221049'
    });
    
    console.log('Login Success!');
    console.log('User Role:', res.data.user.role);
    console.log('Student ID:', res.data.user.studentId);
  } catch (err) {
    console.error('Login Failed:', err.response?.data || err.message);
  }
}

testLogin();

import axios from 'axios';

const BASE_URL = 'http://localhost:5000'; // Backend direct

async function runAudit() {
  console.log('🚀 Starting Backend Functionality Audit...');

  try {
    // 1. Admin Login Verification
    console.log('\n--- 1. Testing Admin Login ---');
    try {
      const adminLogin = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: 'sudharsanrj1971@gmail.com',
        password: '205053'
      });
      console.log('✅ Admin Login Successful');
    } catch (err) {
      console.error('❌ Admin Login Failed:', err.response?.data || err.message);
    }

    // 2. Teacher Registration Verification
    console.log('\n--- 2. Testing Teacher Registration ---');
    try {
      const teacherReg = await axios.post(`${BASE_URL}/api/auth/register`, {
        name: 'Audit Teacher',
        email: `audit_teacher_${Date.now()}@example.com`,
        password: 'Password123!',
        role: 'teacher',
        teacherRegNo: 'T-AUDIT-123'
      });
      console.log('✅ Teacher Registration Successful');
      console.log('Role assigned:', teacherReg.data.user.role);
    } catch (err) {
      console.error('❌ Teacher Registration Failed:', err.response?.data || err.message);
    }

    // 3. Student Registration Verification
    console.log('\n--- 3. Testing Student Registration ---');
    try {
      const studentReg = await axios.post(`${BASE_URL}/api/auth/register`, {
        name: 'Audit Student',
        email: `audit_student_${Date.now()}@example.com`,
        studentId: 'S-AUDIT-777',
        password: 'Password123!',
        role: 'student'
      });
      console.log('✅ Student Registration Successful');
      console.log('Role assigned:', studentReg.data.user.role);
    } catch (err) {
      console.error('❌ Student Registration Failed:', err.response?.data || err.message);
    }

    // 4. Session Creation & Link Resolution
    console.log('\n--- 4. Testing Session Creation & Link Resolution ---');
    try {
       // Login as teacher to get token
       const teacherLogin = await axios.post(`${BASE_URL}/api/auth/login`, {
         email: `audit_teacher_login@example.com`, // We'll use a new one or the one above
         password: 'Password123!'
       }).catch(() => null); // Fallback to creating a new one if not exists
       
       // For this audit, let's just create a session with the admin token for simplicity
       const adminAuth = await axios.post(`${BASE_URL}/api/auth/login`, {
         email: 'sudharsanrj1971@gmail.com',
         password: '205053'
       });
       const token = adminAuth.data.accessToken;

       const sessionCreate = await axios.post(`${BASE_URL}/api/sessions`, {
         title: 'Audit Session',
         description: 'Testing session sharing links'
       }, {
         headers: { Authorization: `Bearer ${token}` }
       });
       
       const linkCode = sessionCreate.data.session.linkCode;
       console.log('✅ Session Created. Link Code:', linkCode);

       // Resolve link publicly
       const resolve = await axios.get(`${BASE_URL}/api/sessions/join/${linkCode}`);
       console.log('✅ Link Resolution Successful. Session ID:', resolve.data.session._id);
       
       if (resolve.data.session._id === sessionCreate.data.session._id) {
         console.log('✅ Link refers to the correct Session ID');
       } else {
         console.error('❌ Link resolution mismatch!');
       }

    } catch (err) {
      console.error('❌ Session/Link Test Failed:', err.response?.data || err.message);
    }

    console.log('\n--- Audit Complete ---');
  } catch (err) {
    console.error('Fatal Audit Error:', err.message);
  }
}

runAudit();

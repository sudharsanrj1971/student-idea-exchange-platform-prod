import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('.env') });

async function create() {
  const email = 'testuser@ichange.com';
  const password = '@bubududu13362056';
  const target = 'http://localhost:5000';

  try {
    // 1. Login
    const { data: authData } = await axios.post(`${target}/api/auth/login`, {
      email,
      password
    });
    
    const token = authData.accessToken;
    console.log('LoggedIn, using token:', token.substring(0, 10) + '...');

    // 2. Create Session
    const { data: sessionData } = await axios.post(`${target}/api/sessions`, 
      {
        title: 'Load Test Session',
        description: 'Automated test session for 1200 users'
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    console.log('Session Created:', sessionData.session._id);
    console.log('Link Code:', sessionData.session.linkCode);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
    process.exit(1);
  }
}

create();

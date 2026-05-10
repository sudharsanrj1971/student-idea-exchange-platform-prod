import axios from 'axios';

const BASE_URL = 'http://localhost:5000';
const ENDPOINTS = [
  { path: '/health', method: 'GET' },
  { path: '/api/auth/login', method: 'POST' },
  { path: '/api/auth/register', method: 'POST' },
  { path: '/api/sessions', method: 'GET' }, // Needs auth usually
];

async function checkConnectivity() {
  console.log('--- Connectivity Check ---');
  for (const endpoint of ENDPOINTS) {
    try {
      const start = Date.now();
      const res = await axios({
        url: BASE_URL + endpoint.path,
        method: endpoint.method,
        validateStatus: () => true // Don't throw on error codes
      });
      const end = Date.now();
      console.log(`[${res.status}] ${endpoint.method} ${endpoint.path} - ${end - start}ms`);
    } catch (err) {
      console.error(`FAILED: ${endpoint.method} ${endpoint.path} - ${err.message}`);
    }
  }
}

checkConnectivity();

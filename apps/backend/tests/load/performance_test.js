import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 200 },  // Ramp up to 200 users
    { duration: '2m', target: 500 },  // Ramp up to 500 users
    { duration: '2m', target: 1000 }, // Ramp up to 1000 users
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete below 2s
    http_req_failed: ['rate<0.01'],    // Less than 1% failure rate
  },
};

const BASE_URL = 'http://localhost:5000/api';

export default function () {
  // 1. Simulate Login (Tests User model indexing)
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    studentId: `STUDENT_${Math.floor(Math.random() * 1000)}`,
    password: 'password123'
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(loginRes, {
    'login status is 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  // 2. Simulate Fetching Active Sessions (Tests Session model indexing)
  const sessionRes = http.get(`${BASE_URL}/sessions/active`);
  
  check(sessionRes, {
    'get sessions status is 200': (r) => r.status === 200,
  });

  sleep(1);
}

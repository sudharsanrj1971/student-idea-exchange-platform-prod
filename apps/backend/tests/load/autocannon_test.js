import autocannon from 'autocannon';

async function runTest() {
  console.log('Starting Load Test with Autocannon...');

  const result = await autocannon({
    url: 'http://localhost:5000',
    connections: 100, // High concurrency
    duration: 30,    // 30 seconds for quick validation
    requests: [
      {
        method: 'POST',
        path: '/api/auth/login',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: 'STUDENT_TEST',
          password: 'password123'
        })
      },
      {
        method: 'GET',
        path: '/api/sessions/active'
      }
    ]
  });

  console.log('Load Test Results:');
  console.log('Requests/sec:', result.requests.average);
  console.log('Latency p95:', result.latency.p95);
  console.log('P99:', result.latency.p99);
  console.log('Total Requests:', result.requests.total);
}

runTest();

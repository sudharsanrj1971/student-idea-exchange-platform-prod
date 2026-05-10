import autocannon from 'autocannon';
import fs from 'fs';

async function runTest(connections, duration, name) {
  console.log(`\n--- Starting Load Test: ${name} (${connections} connections) ---`);
  
  const result = await autocannon({
    url: 'http://localhost:5000/api/auth/login',
    connections: connections,
    duration: duration,
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      email: 'testuser@ichange.com',
      password: 'password123'
    }),
    setupClient: (client) => {
      client.setBody(JSON.stringify({
        email: 'testuser@ichange.com',
        password: 'password123'
      }));
    }
  });

  console.log(`${name} Results:`);
  console.log(`  Requests/sec: ${result.requests.average}`);
  console.log(`  Latency (ms): p50=${result.latency.p50}, p95=${result.latency.p95}, p99=${result.latency.p99}`);
  console.log(`  Total Errors: ${result.errors}`);
  console.log(`  Total Timeouts: ${result.timeouts}`);
  
  return result;
}

async function start() {
  try {
    // Phase 1: 100 Users
    await runTest(100, 20, 'Phase 1 (100 Users)');
    
    // Phase 2: 500 Users
    await runTest(500, 30, 'Phase 2 (500 Users)');
    
    // Phase 3: 1000 Users
    await runTest(1000, 40, 'Phase 3 (1000 Users)');
    
    console.log('\n✅ All load tests completed.');
  } catch (err) {
    console.error('Load test failed:', err);
  }
}

start();

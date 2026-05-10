import http from 'http';

const URL = 'http://localhost:5000/api/auth/login';
const PAYLOAD = JSON.stringify({
  email: 'testuser@ichange.com',
  password: 'password123'
});

async function runBatch(concurrency, durationMs) {
  console.log(`\n--- Starting Node.js Load Test (${concurrency} concurrency) ---`);
  
  let successful = 0;
  let failed = 0;
  let timeouts = 0;
  const latencies = [];
  const startTime = Date.now();
  const endTime = startTime + durationMs;

  const agent = new http.Agent({ keepAlive: true, maxSockets: concurrency });

  async function sendRequest() {
    return new Promise((resolve) => {
      const start = Date.now();
      const req = http.request(URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(PAYLOAD)
        },
        agent,
        timeout: 10000 
      }, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          const duration = Date.now() - start;
          latencies.push(duration);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            successful++;
          } else {
            failed++;
          }
          resolve();
        });
      });

      req.on('error', (err) => {
        failed++;
        resolve();
      });

      req.on('timeout', () => {
        timeouts++;
        req.destroy();
        resolve();
      });

      req.write(PAYLOAD);
      req.end();
    });
  }

  // Controlled worker threads (via concurrency)
  const workers = Array.from({ length: concurrency }).map(async () => {
    while (Date.now() < endTime) {
      await sendRequest();
    }
  });

  await Promise.all(workers);

  const totalTime = (Date.now() - startTime) / 1000;
  const totalRequests = successful + failed + timeouts;
  const rps = totalRequests / totalTime;
  
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;

  console.log(`Results:`);
  console.log(`  Requests/sec: ${rps.toFixed(2)}`);
  console.log(`  Successful: ${successful}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Timeouts: ${timeouts}`);
  console.log(`  Latency (ms): p50=${p50}, p95=${p95}, p99=${p99}`);
}

async function start() {
  try {
    // Ramp up phase
    console.log('--- Ramping up ---');
    await runBatch(100, 5000);
    
    // Peak load phase
    console.log('\n--- Peak Load ---');
    await runBatch(500, 10000);
    
    // Stress test phase
    console.log('\n--- Stress Test ---');
    await runBatch(1000, 10000);
  } catch (err) {
    console.error(err);
  }
}

start();

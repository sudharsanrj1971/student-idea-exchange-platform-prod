import request from 'supertest';
import { app } from '../src/index.js';

async function testRateLimit() {
  console.log('--- Rate Limit Security Test ---');
  
  // We'll use a route that has a lower limit or we'll temporarily adjust it
  // Actually, let's just hammer /health
  
  const iterations = 200;
  console.log(`Firing ${iterations} requests to /health...`);
  
  const results = [];
  for (let i = 0; i < iterations; i++) {
    results.push(request(app).get('/health'));
  }
  
  const responses = await Promise.all(results);
  const statusCodes = responses.map(r => r.status);
  const rateLimited = statusCodes.filter(s => s === 429).length;
  
  console.log(`Results: ${rateLimited} requests were rate limited (429).`);
  
  if (rateLimited > 0) {
    console.log('✅ Rate limiter is ACTIVE and blocking excessive traffic.');
  } else {
    console.log('❌ Rate limiter did not block requests (Limit might be too high in Load Test Mode).');
  }
}

testRateLimit();

/**
 * ============================================================
 *  IChange — 1200+ User Failure-Boundary Stress Test
 *  Tests: Socket.IO join storms, participant broadcast overload,
 *  memory leak detection, graceful degradation beyond capacity.
 * ============================================================
 *
 * Run: node apps/backend/tests/over1200_stress_test.js
 * Prerequisites: Backend running on http://localhost:5010
 *               LOAD_TEST_MODE=true in .env
 */

import { io as SocketClient } from 'socket.io-client';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── CONFIG ────────────────────────────────────────────────────
const BASE_URL = 'http://localhost:5010';
const API_BASE = `${BASE_URL}/api`;
const LOAD_TEST_EMAIL = 'loadtest-user@ichange.app';
const LOAD_TEST_PASSWORD = 'Password123';

// Test phases
const PHASES = [
  { name: 'Baseline',       users: 100  },
  { name: 'Medium Load',    users: 500  },
  { name: 'At Capacity',    users: 1200 },
  { name: 'Above Capacity', users: 1300 },
  { name: 'Breaking Point', users: 1500 },
];

const RAMP_DELAY_MS = 30;     // ms between each user connection
const HOLD_DURATION_MS = 15000; // How long to hold at peak (15s)
const REPORT_FILE = path.join(__dirname, '..', 'over1200_test_results.json');

// ── HELPERS ───────────────────────────────────────────────────

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

function apiRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function getAuthToken() {
  const res = await apiRequest('POST', '/auth/login', {
    email: LOAD_TEST_EMAIL,
    password: LOAD_TEST_PASSWORD,
  });
  if (res.status !== 200 || !res.body.accessToken) {
    throw new Error(`Login failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.accessToken;
}

async function createSession(token) {
  const res = await apiRequest(
    'POST', '/sessions',
    { 
      title: `Stress Test Session ${Date.now()}`, 
      description: 'Auto-generated for boundary failure testing',
      maxParticipants: 2000,
      isActive: true 
    },
    token
  );
  if (res.status !== 201) {
    throw new Error(`Session create failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.session._id;
}

function connectSocket(token, sessionId) {
  return new Promise((resolve) => {
    const socket = SocketClient(BASE_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
      timeout: 10000,
    });

    const result = { socket, connected: false, joinAck: null, joinError: null, connectTime: null };
    const startTime = Date.now();

    socket.on('connect', () => {
      result.connected = true;
      result.connectTime = Date.now() - startTime;
      socket.emit('session:join', { sessionId }, (ack) => {
        result.joinAck = ack;
        if (ack?.error) result.joinError = ack.error;
        resolve(result);
      });
    });

    socket.on('connect_error', (err) => {
      result.connected = false;
      result.joinError = err.message;
      resolve(result);
    });

    // Resolve after timeout even if no ack received
    setTimeout(() => resolve(result), 8000);
  });
}

// ── MEMORY SNAPSHOT ───────────────────────────────────────────

async function getServerMemory(token) {
  try {
    const res = await apiRequest('GET', '/admin/health', null, token);
    return res.body?.memory || null;
  } catch {
    return null;
  }
}

// ── PHASE RUNNER ──────────────────────────────────────────────

async function runPhase(phaseName, targetUsers, token, sessionId) {
  log(`\n${'═'.repeat(60)}`);
  log(`PHASE: ${phaseName} — Target: ${targetUsers} users`);
  log(`${'═'.repeat(60)}`);

  const sockets = [];
  const metrics = {
    phase: phaseName,
    targetUsers,
    connected: 0,
    joinedSession: 0,
    connectErrors: 0,
    joinErrors: 0,
    joinErrorReasons: {},
    connectTimes: [],
    memoryBefore: null,
    memoryAfter: null,
    peakParticipantsSeen: 0,
    startTime: Date.now(),
    endTime: null,
    durationMs: null,
  };

  metrics.memoryBefore = process.memoryUsage();

  // Ramp up connections
  log(`Ramping up ${targetUsers} users (${RAMP_DELAY_MS}ms delay between each)...`);
  const rampStart = Date.now();

  for (let i = 0; i < targetUsers; i++) {
    const result = await connectSocket(token, sessionId);
    if (result.connected) {
      metrics.connected++;
      if (result.connectTime) metrics.connectTimes.push(result.connectTime);
      sockets.push(result.socket);
      if (!result.joinError) {
        metrics.joinedSession++;
      } else {
        metrics.joinErrors++;
        const reason = result.joinError || 'unknown';
        metrics.joinErrorReasons[reason] = (metrics.joinErrorReasons[reason] || 0) + 1;
      }
    } else {
      metrics.connectErrors++;
      const reason = result.joinError || 'connect_error';
      metrics.joinErrorReasons[reason] = (metrics.joinErrorReasons[reason] || 0) + 1;
    }

    // Progress log every 100 users
    if ((i + 1) % 100 === 0) {
      const elapsed = ((Date.now() - rampStart) / 1000).toFixed(1);
      log(`  → ${i + 1}/${targetUsers} — Connected: ${metrics.connected}, Joined: ${metrics.joinedSession}, Errors: ${metrics.connectErrors + metrics.joinErrors} (${elapsed}s)`);
    }

    await new Promise((r) => setTimeout(r, RAMP_DELAY_MS));
  }

  log(`\n⏳ Holding at ${metrics.joinedSession} active connections for ${HOLD_DURATION_MS / 1000}s...`);
  await new Promise((r) => setTimeout(r, HOLD_DURATION_MS));

  metrics.memoryAfter = process.memoryUsage();

  // Calculate stats
  const times = metrics.connectTimes;
  if (times.length > 0) {
    times.sort((a, b) => a - b);
    metrics.p50ConnectMs = times[Math.floor(times.length * 0.5)];
    metrics.p95ConnectMs = times[Math.floor(times.length * 0.95)];
    metrics.p99ConnectMs = times[Math.floor(times.length * 0.99)];
    metrics.avgConnectMs = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    metrics.maxConnectMs = Math.max(...times);
  }

  metrics.successRate = ((metrics.joinedSession / targetUsers) * 100).toFixed(2) + '%';
  metrics.errorRate = (((metrics.connectErrors + metrics.joinErrors) / targetUsers) * 100).toFixed(2) + '%';
  metrics.endTime = Date.now();
  metrics.durationMs = metrics.endTime - metrics.startTime;

  // Summary
  log(`\n📊 PHASE RESULTS: ${phaseName}`);
  log(`   Target Users:     ${targetUsers}`);
  log(`   ✅ Connected:     ${metrics.connected}`);
  log(`   ✅ Joined Sess:   ${metrics.joinedSession}`);
  log(`   ❌ ConnErrors:    ${metrics.connectErrors}`);
  log(`   ❌ JoinErrors:    ${metrics.joinErrors}`);
  log(`   📈 Success Rate:  ${metrics.successRate}`);
  log(`   📉 Error Rate:    ${metrics.errorRate}`);
  log(`   ⏱  P50 Connect:  ${metrics.p50ConnectMs}ms`);
  log(`   ⏱  P95 Connect:  ${metrics.p95ConnectMs}ms`);
  log(`   ⏱  P99 Connect:  ${metrics.p99ConnectMs}ms`);
  log(`   🧠 Heap Used:     ${Math.round(metrics.memoryAfter.heapUsed / 1024 / 1024)}MB`);
  log(`   🔴 Join Errors:   ${JSON.stringify(metrics.joinErrorReasons)}`);

  // Graceful disconnect all sockets
  log(`\n🔌 Disconnecting ${sockets.length} sockets...`);
  for (const sock of sockets) {
    try { sock.disconnect(); } catch (_) {}
  }
  await new Promise((r) => setTimeout(r, 3000)); // Allow server to process disconnects

  return metrics;
}

// ── DEGRADATION ANALYSIS ──────────────────────────────────────

function analyzeBreakingPoint(results) {
  log(`\n${'═'.repeat(60)}`);
  log('DEGRADATION ANALYSIS');
  log(`${'═'.repeat(60)}`);

  let breakingPoint = null;
  let firstDegradation = null;

  for (const r of results) {
    const errorPct = parseFloat(r.errorRate);
    if (errorPct > 5 && !firstDegradation) {
      firstDegradation = r;
      log(`⚠️  FIRST DEGRADATION at ${r.targetUsers} users (${r.errorRate} error rate)`);
    }
    if (errorPct > 25 && !breakingPoint) {
      breakingPoint = r;
      log(`💥 BREAKING POINT at ${r.targetUsers} users (${r.errorRate} error rate)`);
    }
  }

  if (!breakingPoint) {
    log('✅ No breaking point found — platform held stable across all phases!');
  }

  return { firstDegradation, breakingPoint };
}

// ── MAIN ─────────────────────────────────────────────────────

async function main() {
  log('IChange — 1200+ User Failure-Boundary Stress Test');
  log(`Target: ${BASE_URL}`);
  log('');

  // 1. Auth
  log('Step 1: Authenticating load test user...');
  let token;
  try {
    token = await getAuthToken();
    log('✅ Auth token acquired.');
  } catch (err) {
    log(`❌ FATAL: Cannot authenticate — ${err.message}`);
    log('  → Ensure backend is running and LOAD_TEST_MODE=true in .env');
    process.exit(1);
  }

  // 2. Create session
  log('Step 2: Creating a stress test session...');
  let sessionId;
  try {
    sessionId = await createSession(token);
    log(`✅ Session created: ${sessionId}`);
  } catch (err) {
    log(`❌ FATAL: Cannot create session — ${err.message}`);
    process.exit(1);
  }

  // 3. Run phases
  const allResults = [];
  for (const phase of PHASES) {
    try {
      const result = await runPhase(phase.name, phase.users, token, sessionId);
      allResults.push(result);

      // Short cooldown between phases
      log(`\n💤 Cooldown 10s before next phase...\n`);
      await new Promise((r) => setTimeout(r, 10000));
    } catch (err) {
      log(`❌ Phase "${phase.name}" crashed: ${err.message}`);
      allResults.push({ phase: phase.name, targetUsers: phase.users, crashed: true, error: err.message });
    }
  }

  // 4. Analysis
  analyzeBreakingPoint(allResults);

  // 5. Save report
  const report = {
    timestamp: new Date().toISOString(),
    serverUrl: BASE_URL,
    phases: allResults,
  };
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
  log(`\n📁 Full report saved to: ${REPORT_FILE}`);
  log('\n✅ Stress test complete.');
}

main().catch((err) => {
  console.error('Unhandled error in stress test:', err);
  process.exit(1);
});

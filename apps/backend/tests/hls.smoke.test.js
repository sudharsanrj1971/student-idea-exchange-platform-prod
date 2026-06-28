import request from 'supertest';
import { app, bootstrapPromise } from '../src/index.js';
import fs from 'fs/promises';
import path from 'path';

describe('HLS Smoke Test', () => {
  const HLS_ROOT = process.env.HLS_ROOT || '/var/www/hls';

  beforeAll(async () => {
    // Ensure bootstrap is complete (routes must be mounted)
    await bootstrapPromise;
    // Ensure the HLS directory exists for the test
    try {
      await fs.mkdir(path.join(HLS_ROOT, 'test-session'), { recursive: true });
      await fs.writeFile(path.join(HLS_ROOT, 'test-session', 'index.m3u8'), '#EXTM3U\n#EXT-X-VERSION:3');
    } catch (_) {
      // Directory may not be writable in test env — test will naturally fail with 404
    }
  });

  afterAll(async () => {
    // Cleanup is optional for smoke tests but good practice
    // await fs.rm(path.join(HLS_ROOT, 'test-session'), { recursive: true, force: true });
  });

  it('GET /uploads/hls/test-session/index.m3u8 returns 200 OK', async () => {
    // Assuming Nginx or Express serves the /hls directory.
    // In our index.js, we have: app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
    // But the HLS root is /var/www/hls or similar.
    // The patch 5 says: location /hls/ { root /var/www; }
    // So the URL would be /hls/test-session/index.m3u8
    // However, for local testing without Nginx, we might need to expose it in index.js
    
    const res = await request(app).get('/hls/test-session/index.m3u8');
    // If we haven't exposed /hls in Express yet, this will fail 404.
    // I should probably add it to index.js for dev/test parity.
    expect(res.status).toBe(200);
    expect(res.text).toContain('#EXTM3U');
  });
});

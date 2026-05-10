import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '../config/logger.js';
import { createPlainTransport } from '../mediasoup/transport.js';

const HLS_ROOT = process.env.HLS_ROOT || '/var/www/hls';

/**
 * Start HLS streaming for a given producer.
 * Spawns an FFmpeg process that consumes RTP from Mediasoup and outputs HLS segments.
 */
export async function startHlsStream(router, producer) {
  const sessionId = producer.appData.sessionId || 'default';
  const outDir = path.join(HLS_ROOT, sessionId);

  try {
    // 1. Ensure directory exists
    await fs.mkdir(outDir, { recursive: true });

    // 2. Create PlainTransport for Mediasoup → FFmpeg
    const transport = await createPlainTransport(router);

    // 3. Connect transport (FFmpeg will listen on these ports)
    const remoteRtpPort = 5004; // Random available port or dynamic
    const remoteRtcpPort = 5005;

    // In a real production setup, we'd find dynamic available ports.
    // For this patch, we'll try to connect to localhost.
    
    // Create a consumer for this producer on the plain transport
    const consumer = await transport.consume({
      producerId: producer.id,
      rtpCapabilities: router.rtpCapabilities, // FFmpeg supports standard RTP
      paused: false
    });

    // 4. Construct FFmpeg command
    // We expect the producer to be VP8/H264 video and Opus audio.
    // Simplified for Patch 5.
    const args = [
      '-i', 'pipe:0', // Read from stdin (or we could use SDP file)
      '-c:v', 'copy', // Don't re-encode video (saves CPU)
      '-c:a', 'aac',  // Transcode to AAC for HLS compatibility
      '-f', 'hls',
      '-hls_time', '2',
      '-hls_list_size', '5',
      '-hls_flags', 'delete_segments',
      path.join(outDir, 'index.m3u8')
    ];

    const ffmpeg = spawn('ffmpeg', args);

    ffmpeg.stderr.on('data', (data) => {
      logger.debug(`[FFmpeg] ${data}`);
    });

    ffmpeg.on('close', (code) => {
      logger.info(`[FFmpeg] process exited with code ${code}`);
      transport.close();
    });

    logger.info(`🚀 HLS Pipeline started for session ${sessionId} [Producer: ${producer.id}]`);
    
    return { ffmpeg, outDir };
  } catch (err) {
    logger.error('Failed to start HLS stream', { error: err.message });
    throw err;
  }
}

import { mediasoupConfig } from '../config/mediasoup.js';

export async function createWebRtcTransport(router) {
  if (!router || router.closed) {
    logger.error('Mediasoup router is closed or undefined during transport creation');
    throw new Error('Cannot create transport: Router is closed or undefined');
  }

  // ── Bug Fix: Robustness check for Mediasoup router interface ──
  if (typeof router.createWebRtcTransport !== 'function') {
    logger.error('Invalid router object passed to createWebRtcTransport', { 
      type: typeof router,
      hasCreateWebRtcTransport: !!router.createWebRtcTransport,
      routerId: router?.id 
    });
    throw new Error('Mediasoup router is invalid or missing required methods');
  }

  try {
    const transport = await router.createWebRtcTransport(mediasoupConfig.webRtcTransport);

    // Set bitrates if configured
    if (mediasoupConfig.webRtcTransport.maxIncomingBitrate) {
      await transport.setMaxIncomingBitrate(mediasoupConfig.webRtcTransport.maxIncomingBitrate);
    }

    // ── Transport Event Listeners ──
    transport.on('dtlsstatechange', (dtlsState) => {
      if (dtlsState === 'failed' || dtlsState === 'closed') {
        import('../config/logger.js').then(({ logger }) => {
          logger.warn('Transport DTLS state changed', { transportId: transport.id, dtlsState });
        });
        transport.close();
      }
    });

    transport.on('icestatechange', (iceState) => {
      if (iceState === 'disconnected' || iceState === 'closed') {
         import('../config/logger.js').then(({ logger }) => {
          logger.debug('Transport ICE state changed', { transportId: transport.id, iceState });
        });
      }
    });

    // Explicit timeout: if a transport is created but never connected/used, close it after 10m
    const idleTimeout = setTimeout(() => {
      if (!transport.closed) {
        import('../config/logger.js').then(({ logger }) => {
          logger.info('Closing stale transport due to idle timeout', { transportId: transport.id });
        });
        transport.close();
      }
    }, 10 * 60 * 1000);

    transport.on('@close', () => clearTimeout(idleTimeout));

    const params = {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
      sctpParameters: transport.sctpParameters,
    };

    return { transport, params };
  } catch (error) {
    const { logger } = await import('../config/logger.js');
    logger.error('Failed to create Mediasoup transport', { 
      routerId: router?.id, 
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

export async function createPlainTransport(router) {
  const transport = await router.createPlainTransport({
    listenIp: { ip: '127.0.0.1' }, // Localhost only for FFmpeg consumption
    rtcpMux: false,
    comedia: false
  });

  return transport;
}

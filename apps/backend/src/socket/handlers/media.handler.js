import { getRouter } from '../../mediasoup/router.js';
import { createWebRtcTransport } from '../../mediasoup/transport.js';
import { Session } from '../../models/Session.model.js';
import { logger } from '../../config/logger.js';

// Helper: emit an error through the RESPONSE channel so only the _request()
// promise rejects — NOT the global socket.on('error') toast handler.
function mediaError(socket, responseEvent, message) {
  logger.warn(`[media] ${responseEvent} denied: ${message}`, { socketId: socket.id });
  socket.emit(responseEvent, { error: message });
}

/**
 * Auth check: verify the socket is in the room OR the user is a valid participant in DB.
 * Using DB as fallback prevents false "not authorized" when socket.rooms isn't populated yet
 * due to a timing edge case between socket.join() completion and the next event.
 */
async function isAuthorized(socket, sessionId) {
  // Fast path 1: socket is already in the room
  if (socket.rooms.has(sessionId)) return true;

  // Fast path 2: cached authorization
  if (!socket.authorizedSessions) socket.authorizedSessions = new Set();
  if (socket.authorizedSessions.has(sessionId)) return true;

  // Fallback: check the DB (handles the race condition window)
  try {
    const session = await Session.findById(sessionId).lean();
    if (!session) return false;
    const userId = socket.user._id.toString();
    // Host is always authorized
    const auth = session.host.toString() === userId || session.participants.some(p => p.userId.toString() === userId);
    
    if (auth) {
      socket.authorizedSessions.add(sessionId);
    }
    return auth;
  } catch {
    return false;
  }
}

export function mediaHandler(io, socket) {
  // ── media:getRtpCapabilities ───────────────────────────
  socket.on('media:getRtpCapabilities', async ({ sessionId }) => {
    try {
      if (!await isAuthorized(socket, sessionId))
        return mediaError(socket, 'media:rtpCapabilities', 'Not authorized for this session');

      const router = await getRouter(sessionId);
      if (!router)
        return mediaError(socket, 'media:rtpCapabilities', 'Mediasoup router not available');

      socket.emit('media:rtpCapabilities', { rtpCapabilities: router.rtpCapabilities });
    } catch (err) {
      logger.error('media:getRtpCapabilities error', { error: err.message });
      mediaError(socket, 'media:rtpCapabilities', `Failed to get RTP capabilities: ${err.message}`);
    }
  });

  // ── media:createTransport ──────────────────────────────
  socket.on('media:createTransport', async ({ sessionId, direction }) => {
    try {
      if (!await isAuthorized(socket, sessionId))
        return mediaError(socket, 'media:transportCreated', 'Not authorized for this session');

      const router = await getRouter(sessionId);
      if (!router) {
        return mediaError(socket, 'media:transportCreated', 'Mediasoup router not available for this session');
      }

      const { transport, params } = await createWebRtcTransport(router);

      if (!socket.transports) socket.transports = {};
      socket.transports[transport.id] = transport;

      socket.emit('media:transportCreated', { transportId: transport.id, params, direction });
    } catch (err) {
      logger.error('media:createTransport error', { error: err.message });
      mediaError(socket, 'media:transportCreated', 'Failed to create transport');
    }
  });

  // ── media:connectTransport ─────────────────────────────
  socket.on('media:connectTransport', async ({ transportId, dtlsParameters }) => {
    try {
      const transport = socket.transports?.[transportId];
      if (!transport)
        return mediaError(socket, 'media:transportConnected', 'Transport not found');

      await transport.connect({ dtlsParameters });
      socket.emit('media:transportConnected', { transportId });
    } catch (err) {
      logger.error('media:connectTransport error', { error: err.message });
      mediaError(socket, 'media:transportConnected', 'Failed to connect transport');
    }
  });

  // ── media:produce ──────────────────────────────────────
  socket.on('media:produce', async ({ sessionId, transportId, kind, rtpParameters, appData }) => {
    try {
      if (!await isAuthorized(socket, sessionId))
        return mediaError(socket, 'media:produced', 'Not authorized for this session');

      const transport = socket.transports?.[transportId];
      if (!transport)
        return mediaError(socket, 'media:produced', 'Transport not found');

      const producer = await transport.produce({ kind, rtpParameters, appData });

      if (!socket.producers) socket.producers = {};
      socket.producers[producer.id] = producer;

      socket.emit('media:produced', { producerId: producer.id });

      // Persist producer metadata to DB for cross-worker discovery
      await Session.findByIdAndUpdate(sessionId, {
        $push: {
          activeProducers: {
            producerId: producer.id,
            socketId: socket.id,
            userId: socket.user._id,
            name: socket.user.name,
            kind,
            appData,
          }
        }
      });

      socket.to(sessionId).emit('media:newProducer', {
        producerId: producer.id,
        socketId: socket.id,
        userId: socket.user._id,
        name: socket.user.name,
        kind,
        appData,
      });

      producer.on('transportclose', async () => {
        producer.close();
        await Session.findByIdAndUpdate(sessionId, {
          $pull: { activeProducers: { producerId: producer.id } }
        });
        io.to(sessionId).emit('media:producerClosed', { producerId: producer.id });
      });

      // FIX Bug Class 1 (Memory Leak): `router` here is the resolved Mediasoup router
      // object — NOT a Promise. Calling .then() on it was a bug that silently failed
      // (non-Promise objects ignore .then()). Call startHlsStream directly.
      if (appData?.hlsEnabled || appData?.role === 'host') {
        const { startHlsStream } = await import('../../services/hls.service.js');
        const router = await import('../../mediasoup/router.js').then(m => m.getRouter(sessionId));
        if (router) {
          startHlsStream(router, producer).catch(e => logger.error('HLS trigger failed', { error: e.message }));
        }
      }

    } catch (err) {
      logger.error('media:produce error', { error: err.message });
      mediaError(socket, 'media:produced', 'Failed to produce media');
    }
  });

  // ── media:getProducers ─────────────────────────────────
  socket.on('media:getProducers', async ({ sessionId }) => {
    try {
      if (!await isAuthorized(socket, sessionId))
        return socket.emit('media:producers', { producers: [] });

      // Fetch producers from DB to support cross-worker discovery
      const session = await Session.findById(sessionId).select('activeProducers').lean();
      const producers = session?.activeProducers || [];
      
      socket.emit('media:producers', { producers });
    } catch (err) {
      logger.error('media:getProducers error', { error: err.message });
      socket.emit('media:producers', { producers: [] });
    }
  });

  // ── media:consume ──────────────────────────────────────
  socket.on('media:consume', async ({ sessionId, transportId, producerId, rtpCapabilities }) => {
    try {
      if (!await isAuthorized(socket, sessionId))
        return mediaError(socket, 'media:consumed', 'Not authorized for this session');

      const router = await getRouter(sessionId);
      if (!router) {
        return mediaError(socket, 'media:consumed', 'Mediasoup router not available for session');
      }

      const transport = socket.transports?.[transportId];
      if (!transport)
        return mediaError(socket, 'media:consumed', 'Transport not found');

      // Try to consume locally; if not possible, attempt to pipe from the source router
      if (!router.canConsume({ producerId, rtpCapabilities })) {
        // Find the session that owns this producer
        const srcSession = await Session.findOne({ 'activeProducers.producerId': producerId }).select('_id').lean();
        if (srcSession && srcSession._id.toString() !== sessionId) {
          const sourceRouter = await getRouter(srcSession._id);
          try {
            await sourceRouter.pipeToRouter({ producerId, router });
            // Retry canConsume after piping
            if (!router.canConsume({ producerId, rtpCapabilities })) {
              return mediaError(socket, 'media:consumed', 'Cannot consume this producer even after piping');
            }
          } catch (pipeErr) {
            logger.error('Pipe producer error', { error: pipeErr.message });
            return mediaError(socket, 'media:consumed', 'Failed to pipe producer across workers');
          }
        } else {
          return mediaError(socket, 'media:consumed', 'Cannot consume this producer');
        }
      }

      const consumer = await transport.consume({ producerId, rtpCapabilities, paused: true });

      if (!socket.consumers) socket.consumers = {};
      socket.consumers[consumer.id] = consumer;

      socket.emit('media:consumed', {
        consumerId: consumer.id,
        producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      });
    } catch (err) {
      logger.error('media:consume error', { error: err.message });
      mediaError(socket, 'media:consumed', 'Failed to consume media');
    }
  });

  // ── media:resumeConsumer ───────────────────────────────
  socket.on('media:resumeConsumer', async ({ consumerId }) => {
    try {
      const consumer = socket.consumers?.[consumerId];
      if (!consumer) return;
      await consumer.resume();
      socket.emit('media:resumed', { consumerId });
    } catch (err) {
      logger.error('media:resumeConsumer error', { error: err.message });
      mediaError(socket, 'media:resumed', 'Failed to resume consumer');
    }
  });

  // ── media:pauseConsumer ────────────────────────────────
  socket.on('media:pauseConsumer', async ({ consumerId }) => {
    try {
      const consumer = socket.consumers?.[consumerId];
      if (!consumer) return;
      await consumer.pause();
      socket.emit('media:paused', { consumerId });
    } catch (err) {
      logger.error('media:pauseConsumer error', { error: err.message });
      mediaError(socket, 'media:paused', 'Failed to pause consumer');
    }
  });

  // ── media:closeProducer ────────────────────────────────
  socket.on('media:closeProducer', ({ sessionId, producerId }) => {
    try {
      const producer = socket.producers?.[producerId];
      if (producer) {
        producer.close();
        delete socket.producers[producerId];
        
        // Remove from DB atomically
        Session.findByIdAndUpdate(sessionId, {
          $pull: { activeProducers: { producerId } }
        }).catch(err => logger.error('Failed to remove producer from DB', { producerId, error: err.message }));

        socket.to(sessionId).emit('media:producerClosed', { producerId });
      }
    } catch (err) {
      logger.error('media:closeProducer error', { error: err.message });
    }
  });

  // ── Cleanup on disconnect ──────────────────────────────
  socket.on('disconnecting', async () => {
    const rooms = [...socket.rooms].filter(r => r !== socket.id);

    if (socket.producers) {
      const producerIds = Object.keys(socket.producers);
      Object.entries(socket.producers).forEach(([id, p]) => {
        p.close();
        rooms.forEach(sessionId => {
          io.to(sessionId).emit('media:producerClosed', { producerId: id });
        });
      });

      // ─── Broad Cleanup ─────────────────────────────────
      // Cleanup producers from any rooms the socket was in...
      const cleanupTargets = new Set(rooms);
      // ...plus any sessions it was authorized for (handles race conditions/stale authorizations)
      if (socket.authorizedSessions) {
        socket.authorizedSessions.forEach(id => cleanupTargets.add(id));
      }

      for (const sessionId of cleanupTargets) {
        Session.findByIdAndUpdate(sessionId, {
          $pull: { activeProducers: { socketId: socket.id } }
        }).catch(err => logger.error('Failed to cleanup producers on disconnect', { socketId: socket.id, sessionId, error: err.message }));
      }
    }
    if (socket.consumers) Object.values(socket.consumers).forEach(c => c.close());
    if (socket.transports) Object.values(socket.transports).forEach(t => t.close());

    // FIX Bug Class 1 (Memory Leak): Clear the authorizedSessions Set on disconnect.
    // Without this, each disconnected socket holds a Set in memory indefinitely,
    // causing heap growth proportional to the number of sessions visited.
    if (socket.authorizedSessions) {
      socket.authorizedSessions.clear();
    }
  });
}

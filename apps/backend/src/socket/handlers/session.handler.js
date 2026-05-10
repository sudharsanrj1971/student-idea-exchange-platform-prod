import { Session } from '../../models/Session.model.js';
import { recordJoin, recordLeave } from '../../services/attendance.service.js';
import { logger } from '../../config/logger.js';
import { closeRouter } from '../../mediasoup/router.js';

// Inactivity tracking
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
const inactivityTimers = new Map();

// Batch participant updates to avoid O(N^2) broadcast storms at 1,200 scale
const pendingUpdates = new Set(); // Set of sessionIds needing a broadcast
let broadcastTimer = null;

function scheduleBroadcast(sessionId) {
  pendingUpdates.add(sessionId.toString());
  if (broadcastTimer) return;

  broadcastTimer = setTimeout(async () => {
    broadcastTimer = null;
    const sessionIds = [...pendingUpdates];
    pendingUpdates.clear();

    for (const sid of sessionIds) {
      try {
        const session = await Session.findById(sid).lean();
        if (session && session.isActive) {
          // Broadcast batch update to the entire room
          import('../../socket/index.js').then(({ io }) => {
            if (io) {
              io.to(sid).emit('session:participants', {
                participants: session.participants,
                timestamp: Date.now()
              });
            }
          });
        }
      } catch (err) {
        logger.error('Failed to broadcast throttled update', { sessionId: sid, error: err.message });
      }
    }
  }, 500); // 500ms throttle window (faster live updates)
}

export function sessionHandler(io, socket) {
  const user = socket.user;

  // ── session:join ───────────────────────────────────────
  socket.on('session:join', async ({ sessionId }, ack) => {
    try {
      // Clear inactivity timer if session is resuming
      if (inactivityTimers.has(sessionId)) {
        clearTimeout(inactivityTimers.get(sessionId));
        inactivityTimers.delete(sessionId);
        logger.info(`Session ${sessionId} resumed. Inactivity timer cancelled.`);
      }

      const session = await Session.findById(sessionId);
      if (!session) {
        if (typeof ack === 'function') ack({ error: 'Session not found' });
        return;
      }

      // FIX Bug Class 2 (Race Condition): Guard against duplicate joins using userId,
      // NOT socketId. On rapid reconnect the old socketId is gone, so the old socketId
      // guard would pass and the user would be double-added. userId is stable across
      // all reconnections for the same logical user.
      const userIdStr = user._id.toString();
      const isAlreadyInRoom = session.participants.some(p => p.userId.toString() === userIdStr);
      if (!isAlreadyInRoom) {
        if (session.participants.length >= (session.maxParticipants || 1200)) {
          if (typeof ack === 'function') ack({ error: 'Session is full' });
          return;
        }
        
        await Session.findByIdAndUpdate(sessionId, {
          $set: { isActive: true },
          $push: { 
            participants: {
              userId: user._id,
              socketId: socket.id,
              name: user.name,
              avatar: user.profilePic || user.avatar || null,
            }
          }
        });
        
        // Update local memory reference for subsequent emits
        session.participants.push({
          userId: user._id,
          socketId: socket.id,
          name: user.name,
          avatar: user.profilePic || user.avatar || null,
        });
      } else {
        // User is already tracked by userId — update their socketId (reconnect case)
        // so leave/disconnect logic uses the fresh socket.id.
        await Session.findByIdAndUpdate(
          { _id: sessionId, 'participants.userId': user._id },
          { $set: { isActive: true, 'participants.$.socketId': socket.id } }
        );
      }

      // Then join the Socket.IO room
      await socket.join(sessionId);

      // ACK the joiner — room join + DB save are both complete
      if (typeof ack === 'function') ack({ success: true, participants: session.participants });

      // Record attendance (non-blocking)
      const ipAddress = socket.handshake.address || socket.conn.remoteAddress;
      recordJoin(sessionId, user._id, user.name, user.studentId, ipAddress).catch(err =>
        logger.error('recordJoin failed', { error: err.message })
      );

      // Notify room (Throttled)
      scheduleBroadcast(sessionId);

      // Still notify IMMEDIATELY about the specific joiner for the "pop-up" toast
      socket.to(sessionId).emit('session:joined_toast', {
        id: user._id,
        name: user.name,
      });

      // Send the initial participant list to the joiner immediately
      socket.emit('session:participants', { participants: session.participants });

      logger.debug(`👤 ${user.name} joined session ${sessionId} (Concurrent: ${session.participants.length})`);
    } catch (err) {
      logger.error('session:join error', { error: err.message });
      if (typeof ack === 'function') ack({ error: 'Failed to join session' });
    }
  });


  // ── session:leave ──────────────────────────────────────
  socket.on('session:leave', async ({ sessionId }) => {
    await handleLeave(io, socket, sessionId);
  });

  // ── Auto leave on disconnect ───────────────────────────
  socket.on('disconnect', async () => {
    const rooms = [...socket.rooms].filter((r) => r !== socket.id);
    for (const sessionId of rooms) {
      await handleLeave(io, socket, sessionId);
    }
  });

  // ── hand:raise ─────────────────────────────────────────
  socket.on('hand:raise', ({ sessionId, raised }) => {
    io.to(sessionId).emit('hand:update', {
      userId: user._id,
      name: user.name,
      raised: !!raised,
    });

    if (raised) {
      io.to(sessionId).emit('chat:message', {
        _id: `sys-${Date.now()}-hand`,
        type: 'system',
        text: `${user.name} raised their hand`,
        createdAt: new Date().toISOString()
      });
    }
  });

  // ── session:reaction ───────────────────────────────────
  socket.on('session:reaction', ({ sessionId, emoji }) => {
    io.to(sessionId).emit('session:reaction', {
      userId: user._id,
      name: user.name,
      emoji,
    });
  });

  // ── admin:muteAll ──────────────────────────────────────
  socket.on('admin:muteAll', async ({ sessionId }) => {
    const session = await Session.findById(sessionId);
    if (!session) return;
    if (session.host.toString() !== user._id.toString() && user.role !== 'admin') {
      return socket.emit('error', { message: 'Not authorized to mute all' });
    }
    io.to(sessionId).emit('admin:muteAll');
  });

  // ── admin:muteUser ─────────────────────────────────────
  socket.on('admin:muteUser', async ({ sessionId, targetUserId }) => {
    try {
      const session = await Session.findById(sessionId);
      if (!session) return;
      if (session.host.toString() !== user._id.toString() && user.role !== 'admin') {
        return socket.emit('error', { message: 'Not authorized to mute users' });
      }
      // Emit only to the target user's sockets in the room
      const room = io.sockets.adapter.rooms.get(sessionId);
      if (room) {
        for (const socketId of room) {
          const targetSocket = io.sockets.sockets.get(socketId);
          if (targetSocket?.user?._id?.toString() === targetUserId) {
            targetSocket.emit('admin:muted');
          }
        }
      }
    } catch (err) {
      logger.error('admin:muteUser error', { error: err.message });
    }
  });

  // ── admin:kickUser ─────────────────────────────────────
  socket.on('admin:kickUser', async ({ sessionId, targetUserId }) => {
    try {
      const session = await Session.findById(sessionId);
      if (!session) return;
      if (session.host.toString() !== user._id.toString() && user.role !== 'admin') {
        return socket.emit('error', { message: 'Not authorized to kick users' });
      }
      // Find and notify all sockets belonging to the target user
      const room = io.sockets.adapter.rooms.get(sessionId);
      if (room) {
        for (const socketId of room) {
          const targetSocket = io.sockets.sockets.get(socketId);
          if (targetSocket?.user?._id?.toString() === targetUserId) {
            targetSocket.emit('admin:kicked');
            // Trigger leave logic for that socket
            await handleLeave(io, targetSocket, sessionId);
            targetSocket.leave(sessionId);
          }
        }
      }
    } catch (err) {
      logger.error('admin:kickUser error', { error: err.message });
    }
  });

  // ── Polling System ─────────────────────────────────────
  socket.on('session:poll_start', async ({ sessionId, question, options }) => {
    try {
      const session = await Session.findById(sessionId);
      if (!session) return;
      if (session.host.toString() !== user._id.toString() && user.role !== 'admin') {
        return socket.emit('error', { message: 'Not authorized to start polls' });
      }

      const poll = {
        id: Date.now().toString(),
        question,
        options: options.map(opt => ({ text: opt, votes: 0 })),
        active: true,
        creatorId: user._id,
        votedUserIds: []
      };

      // In a real production app at 1,200 scale, we'd store this in Redis.
      // For this implementation, we broadcast and let the frontend track state.
      io.to(sessionId).emit('poll:started', poll);

      io.to(sessionId).emit('chat:message', {
        _id: `sys-${Date.now()}-poll`,
        type: 'system',
        text: `A new poll has started: "${question}"`,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      logger.error('session:poll_start error', { error: err.message });
    }
  });

  socket.on('session:poll_vote', async ({ sessionId, pollId, optionIndex }) => {
    try {
      // Just broadcast the vote event. 
      // The frontend will aggregate the votes in the Session store.
      io.to(sessionId).emit('poll:vote_cast', { pollId, optionIndex, userId: user._id });
    } catch (err) {
      logger.error('session:poll_vote error', { error: err.message });
    }
  });

  socket.on('session:poll_end', async ({ sessionId, pollId }) => {
    try {
      const session = await Session.findById(sessionId);
      if (!session) return;
      if (session.host.toString() !== user._id.toString() && user.role !== 'admin') {
        return;
      }
      io.to(sessionId).emit('poll:ended', { pollId });

      io.to(sessionId).emit('chat:message', {
        _id: `sys-${Date.now()}-poll-end`,
        type: 'system',
        text: 'The poll has ended and results are finalized.',
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      logger.error('session:poll_end error', { error: err.message });
    }
  });

  // ── admin:observe (God Mode) ───────────────────────────
  socket.on('admin:observe', async ({ sessionId }, ack) => {
    try {
      if (user.role !== 'admin') {
        return ack?.({ error: 'Unauthorized override denied' });
      }
      // Join room WITHOUT updating participants DB or broadcasting join
      await socket.join(sessionId);
      if (typeof ack === 'function') ack({ success: true, message: 'Stealth monitoring active' });
      
      logger.info(`🕵️ Admin ${user.name} started observing session ${sessionId}`);
    } catch (err) {
      logger.error('admin:observe error', { error: err.message });
      if (typeof ack === 'function') ack({ error: 'Failed to initiate observation' });
    }
  });
}

async function handleLeave(io, socket, sessionId) {
  try {
    const userId = socket.user._id.toString();
    await socket.leave(sessionId);

    // Single atomic update: remove socket from participants and conditionally set isActive
    const updatedSession = await Session.findByIdAndUpdate(
      sessionId,
      { $pull: { participants: { socketId: socket.id } } },
      { new: true, lean: true, projection: { participants: 1, isActive: 1 } }
    );
    if (!updatedSession) return;

    const remainingCount = updatedSession.participants.length;
    const updatedIsActive = remainingCount > 0;

    // Update isActive in a fire-and-forget manner
    if (updatedSession.isActive !== updatedIsActive) {
      Session.findByIdAndUpdate(sessionId, { $set: { isActive: updatedIsActive } }).catch(err =>
        logger.error('Failed to update isActive on leave', { error: err.message })
      );
    }

    // Only record leave if NO other sockets for this user remain in the room
    const otherSocketsInRoom = updatedSession.participants.filter(
      (p) => p.userId.toString() === userId
    );
    if (otherSocketsInRoom.length === 0) {
      recordLeave(sessionId, socket.user._id).catch(err =>
        logger.error('recordLeave failed', { error: err.message })
      );
    }

    // Notify room (Throttled)
    scheduleBroadcast(sessionId);

    // Immediate toast for departures
    socket.to(sessionId).emit('session:left_toast', {
      id: socket.user._id,
      name: socket.user.name,
    });

    // Handle Inactivity Timeout
    if (!updatedIsActive) {
      if (!inactivityTimers.has(sessionId)) {
        logger.info(`Session ${sessionId} is empty. Scheduling inactivity cleanup in 5 minutes.`);
        const timer = setTimeout(async () => {
          try {
            logger.info(`Session ${sessionId} inactive for 5 minutes. Closing router.`);
            closeRouter(sessionId);

            // Ensure DB accurately reflects closure
            await Session.findByIdAndUpdate(sessionId, {
              $set: { isActive: false, routerId: null }
            });

            inactivityTimers.delete(sessionId);
          } catch (cleanupErr) {
            logger.error(`Error during inactivity cleanup for session ${sessionId}`, { error: cleanupErr.message });
          }
        }, INACTIVITY_TIMEOUT_MS);

        inactivityTimers.set(sessionId, timer);
      }
    }

  } catch (err) {
    logger.error('session:leave error', { error: err.message });
  }
}

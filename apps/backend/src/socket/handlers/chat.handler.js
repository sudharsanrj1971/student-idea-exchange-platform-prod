import { Message } from '../../models/Message.model.js';
import { logger } from '../../config/logger.js';
import { sanitize } from '../../utils/sanitizer.js';
import { userCache } from '../index.js';
import { UserProfile } from '../../models/UserProfile.model.js';

export function chatHandler(io, socket) {
  const user = socket.user;

  // ── chat:send ──────────────────────────────────────────
  socket.on('chat:send', async ({ sessionId, text, recipientId }) => {
    try {
      if (!text?.trim()) return;
      if (text.length > 1000) {
        return socket.emit('error', { message: 'Message too long (max 1000 chars)' });
      }

      const isPrivate = !!recipientId;
      
      // Fetch fresh avatar from UserProfile or fallback to initial socket user
      let currentAvatar = user.profilePic || user.avatar;
      try {
        const profile = await UserProfile.findOne({ userId: user._id });
        if (profile && profile.profilePic) {
          currentAvatar = profile.profilePic;
        }
      } catch (e) {}

      const message = await Message.create({
        sessionId,
        sender: user._id,
        senderName: user.name,
        senderAvatar: currentAvatar,
        text: sanitize(text.trim()),
        recipient: recipientId || null,
        isPrivate
      });

      const payload = {
        _id: message._id,
        sender: { _id: user._id, name: user.name },
        senderName: user.name,
        profilePic: currentAvatar,
        text: message.text,
        createdAt: message.createdAt,
        sessionId,
        recipientId,
        isPrivate
      };

      if (isPrivate) {
        // Send to specific recipient's sockets in the room
        const room = io.sockets.adapter.rooms.get(sessionId);
        if (room) {
          for (const socketId of room) {
            const targetSocket = io.sockets.sockets.get(socketId);
            if (targetSocket?.user?._id?.toString() === recipientId) {
              targetSocket.emit('chat:message', payload);
            }
          }
        }
        // Always send back to the sender
        socket.emit('chat:message', payload);
      } else {
        // Broadcast to all in session room
        io.to(sessionId).emit('chat:message', payload);
      }
    } catch (err) {
      logger.error('chat:send error', { error: err.message });
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // ── chat:history ───────────────────────────────────────
  socket.on('chat:history', async ({ sessionId, limit = 50, before }) => {
    try {
      const query = { sessionId };
      if (before) query.createdAt = { $lt: new Date(before) };

      const messages = await Message.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      const normalized = messages.map(m => ({
        ...m,
        profilePic: m.senderAvatar || m.profilePic || null,
      }));
      socket.emit('chat:history', { messages: normalized, sessionId });
    } catch (err) {
      logger.error('chat:history error', { error: err.message });
    }
  });

  // ── chat:typing ────────────────────────────────────────
  socket.on('chat:typing', ({ sessionId, isTyping }) => {
    try {
      socket.to(sessionId).emit('chat:typing', {
        userId: user._id,
        name: user.name,
        isTyping: !!isTyping,
      });
    } catch (err) {
      logger.error('chat:typing error', { error: err.message });
    }
  });

  // ── session:reaction ───────────────────────────────────
    socket.on('session:reaction', async ({ sessionId, emoji }) => {
    try {
      let currentAvatar = user.profilePic || user.avatar;
      try {
        const profile = await UserProfile.findOne({ userId: user._id });
        if (profile && profile.profilePic) {
          currentAvatar = profile.profilePic;
        }
      } catch (e) {}

      // Broadcast reaction to everyone in the session
      io.to(sessionId).emit('session:reaction', {
        userId: user._id,
        name: user.name,
        avatar: currentAvatar,
        emoji: sanitize(emoji),
      });
    } catch (err) {
      logger.error('session:reaction error', { error: err.message });
    }
  });
}

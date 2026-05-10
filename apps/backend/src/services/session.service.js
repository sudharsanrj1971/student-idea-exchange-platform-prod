import mongoose from 'mongoose';
import { Session } from '../models/Session.model.js';
import { nanoid } from 'nanoid';
import { getLeastLoadedWorkerIndex } from '../mediasoup/worker.js';

export async function createSession({ title, description, maxParticipants, scheduledAt, hostId }) {
  let linkCode;
  let exists = true;
  let attempts = 0;

  // Ensure linkCode uniqueness
  while (exists && attempts < 10) {
    linkCode = nanoid(10);
    const existing = await Session.findOne({ linkCode }).select('_id');
    if (!existing) exists = false;
    attempts++;
  }

  if (exists) {
    // Highly unlikely with 10 attempts on a 10-char nanoid, but safety first
    throw new Error('Failed to generate a unique link code. Please try again.');
  }

  const workerId = getLeastLoadedWorkerIndex();

  const session = new Session({
    title,
    description,
    maxParticipants,
    scheduledAt,
    host: hostId,
    linkCode,
    workerId, // Pre-assign worker for load balancing
  });

  await session.save();
  return await session.populate('host', 'name email avatar');
}

export async function getSessionsForUser(userId) {
  const sessions = await Session.find({
    isDeleted: { $ne: true },
    $or: [
      { host: userId },
      { 'participants.userId': userId },
    ],
  })
    .select('-participants -activeProducers') // Highly critical: Prevents node memory heap crashes
    .populate('host', 'name email avatar')
    .sort({ createdAt: -1 })
    .limit(50) // Paginate default dashboard bounds
    .lean();

  return sessions;
}

export async function getSessionById(sessionId) {
  if (!mongoose.Types.ObjectId.isValid(sessionId)) {
    const err = new Error('Invalid session ID format');
    err.statusCode = 400;
    throw err;
  }
  const session = await Session.findOne({ _id: sessionId, isDeleted: { $ne: true } })
    .populate('host', 'name email avatar')
    .lean();

  return session;
}

export async function updateSession(sessionId, user, updates) {
  if (!mongoose.Types.ObjectId.isValid(sessionId)) {
    const err = new Error('Invalid session ID format');
    err.statusCode = 400;
    throw err;
  }
  const session = await Session.findById(sessionId);
  if (!session) {
    const err = new Error('Session not found');
    err.statusCode = 404;
    throw err;
  }
  const isHost = session.host.toString() === user._id.toString();
  const isAdmin = user.role === 'admin';

  if (!isHost && !isAdmin) {
    const err = new Error('Unauthorized to edit this session');
    err.statusCode = 403;
    throw err;
  }
  Object.assign(session, updates);
  await session.save();
  return session;
}

export async function deleteSession(sessionId, user) {
  if (!mongoose.Types.ObjectId.isValid(sessionId)) {
    const err = new Error('Invalid session ID format');
    err.statusCode = 400;
    throw err;
  }
  const session = await Session.findById(sessionId);
  if (!session) {
    const err = new Error('Session not found');
    err.statusCode = 404;
    throw err;
  }
  const isHost = session.host.toString() === user._id.toString();
  const isAdmin = user.role === 'admin';

  if (!isHost && !isAdmin) {
    const err = new Error('Unauthorized to delete this session');
    err.statusCode = 403;
    throw err;
  }
  session.isDeleted = true;
  await session.save();
}

export async function resolveByLinkCode(linkCode) {
  const session = await Session.findOne({ linkCode, isDeleted: { $ne: true } })
    .populate('host', 'name email avatar')
    .lean();

  if (!session) {
    const err = new Error('Session not found for this link code');
    err.statusCode = 404;
    throw err;
  }

  return session;
}

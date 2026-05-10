import { Router } from 'express';
import mongoose from 'mongoose';
import { authenticate, requireRole } from '../middleware/auth.js';
import { User } from '../models/User.model.js';
import { Session } from '../models/Session.model.js';
import { AuditLog } from '../models/AuditLog.model.js';
import { Notice } from '../models/Notice.model.js';
import { Message } from '../models/Message.model.js';
import { Config } from '../models/Config.model.js';
import { io } from '../socket/index.js';

const router = Router();

// Helper to log admin actions
async function logAdminAction(req, action, targetId, details = {}) {
  try {
    await AuditLog.create({
      adminId: req.user._id,
      action,
      targetId,
      details,
      ipAddress: req.ip || req.connection.remoteAddress
    });
  } catch (err) {
    console.error('Audit Log Error:', err.message);
  }
}

// Apply global admin protection
router.use(authenticate);
router.use(requireRole('admin'));

// GET /api/admin/stats — Get platform overview
router.get('/stats', async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalSessions = await Session.countDocuments();
    const activeSessions = await Session.countDocuments({ isActive: true });
    
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const newUsers24h = await User.countDocuments({ createdAt: { $gt: yesterday } });

    res.json({
      users: totalUsers,
      sessions: totalSessions,
      active: activeSessions,
      newUsers24h,
      growth: '+12%' 
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/config — Get platform configuration
router.get('/config', async (req, res, next) => {
  try {
    const configs = await Config.find().lean();
    res.json(configs);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/config/:key — Update platform configuration
router.patch('/config/:key', async (req, res, next) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    const config = await Config.findOneAndUpdate(
      { key },
      { value, lastUpdatedBy: req.user._id },
      { new: true }
    );
    
    if (!config) return res.status(404).json({ error: 'Config not found' });
    
    await logAdminAction(req, 'ROLE_CHANGE', null, { key, value }); // Reuse ROLE_CHANGE for generic config log temporarily or keep it simple
    res.json(config);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/users — List all users (Paginated & Searchable)
router.get('/users', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const role = req.query.role || 'all';
    
    const query = {};
    
    // Add Search Filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Add Role Filter
    if (role !== 'all') {
      query.role = role;
    }
    
    const totalUsers = await User.countDocuments(query);
    
    const users = await User.find(query)
      .select('-refreshTokens')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // FIX Bug Class 6 (N+1 Query): Replace per-user Attendance.find() calls with a
    // single aggregation. The old code fired 20 DB queries per page; this fires 1.
    const userIds = users.map(u => u._id);
    const attendanceStats = await mongoose.model('Attendance').aggregate([
      { $match: { userId: { $in: userIds } } },
      { $sort: { joinTime: -1 } },
      {
        $group: {
          _id: '$userId',
          totalTime: { $sum: '$duration' },
          lastSeen: { $first: '$joinTime' },
        }
      }
    ]);

    // Build a fast lookup map: userId -> stats
    const statsMap = new Map(attendanceStats.map(s => [s._id.toString(), s]));

    const enhancedUsers = users.map(u => {
      const stats = statsMap.get(u._id.toString());
      return {
        ...u,
        totalTime: stats?.totalTime || 0,
        lastSeen: stats?.lastSeen || u.createdAt,
      };
    });
      
    res.json({ 
      users: enhancedUsers,
      pagination: {
        total: totalUsers,
        page,
        limit,
        pages: Math.ceil(totalUsers / limit)
      }
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/users/:userId — Update user
router.patch('/users/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { role, isActive, password, name, email, studentId } = req.body;
    
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const oldData = {
      role: user.role,
      isActive: user.isActive,
      name: user.name,
      email: user.email,
      studentId: user.studentId
    };

    if (name) user.name = name;
    if (email) {
      // Check for email uniqueness if changed
      if (email !== user.email) {
        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ error: 'Email already in use' });
        user.email = email;
      }
    }
    if (studentId !== undefined) user.studentId = studentId;
    if (role) user.role = role;
    if (typeof isActive === 'boolean') user.isActive = isActive;
    if (password) user.passwordHash = password; // pre-save hook will hash it
    
    await user.save();
    
    const changes = {};
    if (name && name !== oldData.name) changes.name = name;
    if (email && email !== oldData.email) changes.email = email;
    if (studentId !== oldData.studentId) changes.studentId = studentId;
    if (role && role !== oldData.role) changes.role = role;
    if (typeof isActive === 'boolean' && isActive !== oldData.isActive) changes.isActive = isActive;
    if (password) changes.password = 'CHANGED';

    await logAdminAction(req, 'UPDATE_USER', userId, changes);

    res.json({ message: 'User updated successfully', user });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/users/bulk — Bulk actions (activate, deactivate, change role)
router.post('/users/bulk', async (req, res, next) => {
  try {
    const { userIds, action, value } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'No users selected' });
    }

    let update = {};
    if (action === 'status') {
      update.isActive = value;
    } else if (action === 'role') {
      update.role = value;
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const result = await User.updateMany({ _id: { $in: userIds } }, { $set: update });
    await logAdminAction(req, 'BULK_ACTION', null, { action, count: result.modifiedCount, userIds });

    res.json({ message: `Successfully updated ${result.modifiedCount} users`, count: result.modifiedCount });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/users/:userId/activity — Get user detailed activity
router.get('/users/:userId/activity', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('name email role studentId createdAt').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const attendance = await mongoose.model('Attendance').find({ userId })
      .sort({ joinTime: -1 })
      .limit(50)
      .lean();

    const sessionsHosted = await Session.find({ host: userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json({
      user,
      attendance,
      sessionsHosted
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/active-sessions — List all live sessions with participant counts
router.get('/active-sessions', async (req, res, next) => {
  try {
    const sessions = await Session.find({ isActive: true })
      .populate('host', 'name email')
      .sort({ createdAt: -1 })
      .lean();
    
    // In a real app, you'd get participant counts from Redis/Socket.io
    // For now, we'll return the database view
    res.json(sessions);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/system-health — Return system status and DB info
router.get('/system-health', async (req, res, next) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
    const isAtlas = process.env.MONGODB_URI?.includes('mongodb+srv');
    
    res.json({
      database: {
        status: dbStatus,
        type: isAtlas ? 'MongoDB Atlas' : 'Local/Memory',
        uri: isAtlas ? 'Atlas Cluster' : 'Local Instance'
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      mediasoup: {
        status: 'Online',
        workers: 1 // Simplified for now
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/broadcast — Send global announcement
router.post('/broadcast', async (req, res, next) => {
  try {
    const { content, type, target } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required' });

    const notice = await Notice.create({
      adminId: req.user._id,
      content,
      type: type || 'toast',
      target: target || 'global'
    });

    // Send via socket
    if (io) {
      io.emit('global:notice', {
        id: notice._id,
        content,
        type: notice.type,
        adminName: req.user.name
      });
    }

    await logAdminAction(req, 'GLOBAL_NOTICE', notice._id, { content });
    res.json({ message: 'Announcement broadcasted', notice });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/sessions/:sessionId/snapshot — God Mode: View live session state
router.get('/sessions/:sessionId/snapshot', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = await Session.findById(sessionId).populate('host', 'name email').lean();
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const recentMessages = await Message.find({ sessionId })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    res.json({
      session,
      messages: recentMessages.reverse()
    });

    await logAdminAction(req, 'OBSERVE_SESSION', sessionId);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/sessions/:sessionId — Terminate a live session
router.delete('/sessions/:sessionId', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Notify all participants
    if (io) {
      io.to(sessionId).emit('admin:kicked', { message: 'This session has been terminated by an administrator.' });
      io.to(sessionId).emit('error', { message: 'Session terminated' });
    }

    // Soft delete
    session.isDeleted = true;
    session.isActive = false;
    await session.save();

    await logAdminAction(req, 'TERMINATE_SESSION', sessionId, { title: session.title });
    res.json({ message: 'Session terminated successfully' });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/audit-logs — Paginated audit logs
router.get('/audit-logs', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    
    const logs = await AuditLog.find()
      .populate('adminId', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
      
    const total = await AuditLog.countDocuments();
    
    res.json({
      logs,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/broadcasts/:noticeId — Remove a notice
router.delete('/broadcasts/:noticeId', async (req, res, next) => {
  try {
    const { noticeId } = req.params;
    const notice = await Notice.findByIdAndDelete(noticeId);
    if (!notice) return res.status(404).json({ error: 'Notice not found' });

    await logAdminAction(req, 'DELETE_NOTICE', noticeId, { content: notice.content });
    res.json({ message: 'Notice deleted successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;

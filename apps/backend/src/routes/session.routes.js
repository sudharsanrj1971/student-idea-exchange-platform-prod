import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { linkCodeRateLimiter } from '../middleware/rateLimiter.js';
import {
  createSession,
  getSessionsForUser,
  getSessionById,
  updateSession,
  deleteSession,
  resolveByLinkCode,
} from '../services/session.service.js';
import { getAttendanceReport } from '../services/attendance.service.js';

const router = Router();

// GET /api/sessions/join/:linkCode — resolve link code (PUBLIC)
router.get('/join/:linkCode', linkCodeRateLimiter, async (req, res, next) => {
  try {
    const session = await resolveByLinkCode(req.params.linkCode);
    res.json({ session });
  } catch (err) {
    next(err);
  }
});

// All session routes require auth
router.use(authenticate);

// GET /api/sessions — list user's sessions
router.get('/', async (req, res, next) => {
  try {
    const sessions = await getSessionsForUser(req.user._id);
    const filteredSessions = sessions.filter(s => 
      s.isActive || 
      (s.host && s.host._id && s.host._id.toString() === req.user._id.toString()) || 
      (s.host && s.host.toString() === req.user._id.toString())
    );
    res.json({ sessions: filteredSessions });
  } catch (err) {
    next(err);
  }
});

// POST /api/sessions — create a session
router.post(
  '/',
  [
    body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
    body('description').optional().trim().isLength({ max: 2000 }),
    body('scheduledAt').optional().isISO8601().withMessage('Invalid date format'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const session = await createSession({ ...req.body, hostId: req.user._id });
      res.status(201).json({ session });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/sessions/:id
router.get('/:id', async (req, res, next) => {
  try {
    const session = await getSessionById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ session });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/sessions/:id
router.patch(
  '/:id',
  [
    body('title').optional().trim().notEmpty().isLength({ max: 200 }),
    body('description').optional().trim().isLength({ max: 2000 }),
    body('scheduledAt').optional().isISO8601(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const session = await updateSession(req.params.id, req.user, req.body);
      res.json({ session });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/sessions/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await deleteSession(req.params.id, req.user);
    res.json({ message: 'Session deleted' });
  } catch (err) {
    next(err);
  }
});

// GET /api/sessions/:id/attendance — export/view attendance report
router.get('/:id/attendance', async (req, res, next) => {
  try {
    const session = await getSessionById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    
    // Auth check: host, admin, OR ANY ACTIVE PARTICIPANT
    const isParticipant = session.participants.some(p => p.userId.toString() === req.user._id.toString());
    const isHost = session.host.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isParticipant && !isHost && !isAdmin) {
      return res.status(403).json({ error: 'Unauthorized to view attendance' });
    }

    const report = await getAttendanceReport(req.params.id);
    res.json({ attendance: report });
  } catch (err) {
    next(err);
  }
});

export default router;

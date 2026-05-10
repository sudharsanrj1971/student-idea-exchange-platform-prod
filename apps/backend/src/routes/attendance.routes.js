import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getAttendanceReport } from '../services/attendance.service.js';
import { Session } from '../models/Session.model.js';

const router = Router();

router.use(authenticate);

// GET /api/attendance/:sessionId — admin or session host only
router.get('/:sessionId', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const records = await getAttendanceReport(sessionId);
    
    // Auth Check: Allow if user is admin OR if they are the host of the session
    const session = await Session.findById(sessionId).lean();
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const isHost = session.host?.toString() === req.user?._id?.toString();
    const isAdmin = req.user?.role === 'admin';

    if (!isHost && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to view attendance for this session' });
    }

    res.json({ attendance: records, count: records.length });
  } catch (err) {
    next(err);
  }
});

export default router;

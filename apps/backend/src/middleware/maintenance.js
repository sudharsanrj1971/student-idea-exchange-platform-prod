import { Config } from '../models/Config.model.js';
let lastCheck = 0;
let isMaintenance = false;
export async function maintenanceMode(req, res, next) {
  try {
    if (Date.now() - lastCheck > 10000) {
      const maintenanceConfig = await Config.findOne({ key: 'maintenance_mode' });
      isMaintenance = !!maintenanceConfig?.value;
      lastCheck = Date.now();
    }
    if (isMaintenance) {
      if (req.user?.role === 'admin') return next();
      const url = req.originalUrl || req.path;
      if (url.startsWith('/api/auth/') || url === '/health') return next();
      if (url.startsWith('/api/admin/')) return next();
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'The platform is currently undergoing maintenance. Please try again later.',
        retryAfter: 3600
      });
    }
    next();
  } catch (err) {
    console.error('Maintenance Check Error:', err.message);
    next();
  }
}
export function resetMaintenanceCache() {
  lastCheck = 0;
}

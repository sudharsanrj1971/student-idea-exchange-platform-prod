import { Config } from '../models/Config.model.js';

let lastCheck = 0;
let isMaintenance = false;

export async function maintenanceMode(req, res, next) {
  try {
    // Cache check for 10 seconds to avoid DB hammering on every request
    if (Date.now() - lastCheck > 10000) {
      const maintenanceConfig = await Config.findOne({ key: 'maintenance_mode' });
      isMaintenance = !!maintenanceConfig?.value;
      lastCheck = Date.now();
    }

    if (isMaintenance) {
      // Allow admins to pass through
      if (req.user?.role === 'admin') {
        return next();
      }

      // Special handling for the health check path
      if (req.path === '/health' || req.path === '/api/admin/config') {
          return next();
      }

      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'The platform is currently undergoing maintenance. Please try again later.',
        retryAfter: 3600
      });
    }

    next();
  } catch (err) {
    // Fallback to allowing traffic if config check fails
    console.error('Maintenance Check Error:', err.message);
    next();
  }
}

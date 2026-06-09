import { Config } from '../models/Config.model.js';

let lastCheck = 0;
let isMaintenance = false;

// Paths that are always allowed, even during maintenance.
// This prevents admin lockout when maintenance mode is enabled.
const MAINTENANCE_WHITELIST = [
  '/api/auth/login',
  '/api/auth/admin-login',
  '/api/auth/refresh',
  '/api/auth/sync-profile', // needed for the login page email preview
  '/api/admin/maintenance',  // so admin can toggle maintenance OFF
  '/health',
];

export async function maintenanceMode(req, res, next) {
  try {
    if (Date.now() - lastCheck > 10000) {
      const maintenanceConfig = await Config.findOne({ key: 'maintenance_mode' });
      isMaintenance = !!maintenanceConfig?.value;
      lastCheck = Date.now();
    }

    if (isMaintenance) {
      // Allow authenticated admins to pass through unconditionally
      if (req.user?.role === 'admin') {
        return next();
      }

      // Allow whitelisted paths (admin login, health, maintenance toggle)
      const isWhitelisted = MAINTENANCE_WHITELIST.some(path => req.path.startsWith(path));
      if (isWhitelisted) {
        return next();
      }

      // Allow all /api/auth/* so login page always works
      const url = req.originalUrl || req.path;
      if (url.startsWith('/api/auth/')) return next();

      // Allow all /api/admin/* routes so admin dashboard keeps working
      if (req.path.startsWith('/api/admin')) {
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
    console.error('Maintenance Check Error:', err.message);
    next();
  }
}

// Exposed so tests / admin toggle route can force an immediate re-check
export function resetMaintenanceCache() {
  lastCheck = 0;
}


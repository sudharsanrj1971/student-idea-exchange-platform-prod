import { logger } from '../config/logger.js';

export function globalErrorHandler(err, req, res, _next) {
  const isKnownError = [
    'ValidationError', 
    'CastError', 
    'DocumentNotFoundError', 
    'JsonWebTokenError', 
    'TokenExpiredError'
  ].includes(err.name) || err.statusCode < 500;

  if (isKnownError) {
    logger.debug('Known error handled', {
      name: err.name,
      message: err.message,
      path: req.path,
      method: req.method,
    });
  } else {
    logger.error('Unhandled error', {
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      path: req.path,
      method: req.method,
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(400).json({ error: 'Validation error', details });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ 
      error: 'Invalid format', 
      message: `Invalid format for field: ${err.path}`,
      details: process.env.NODE_ENV === 'development' ? { field: err.path, value: err.value } : undefined 
    });
  }

  // Mongoose document not found (e.g., from orFail or findByIdAndUpdate with specific options)
  if (err.name === 'DocumentNotFoundError') {
    return res.status(404).json({ error: 'Resource not found' });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({ error: `${field} already exists` });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Body parser errors
  if (err.status === 413 || err.statusCode === 413) {
    return res.status(413).json({ error: 'Payload too large', message: 'The request body exceeds the maximum allowed size.' });
  }

  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal server error' : (err.message || 'Request failed'),
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
}

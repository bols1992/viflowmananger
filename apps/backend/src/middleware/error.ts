import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../logger.js';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // Zod validation errors
  if (err instanceof ZodError) {
    logger.warn({ error: err.errors, path: req.path }, 'Validation error');
    return res.status(400).json({
      error: 'Validation failed',
      details: err.errors,
    });
  }

  // Application errors
  if (err instanceof AppError) {
    logger.warn({ error: err, path: req.path }, 'Application error');
    return res.status(err.statusCode).json({
      error: err.message,
    });
  }

  // Multer errors
  if (err.name === 'MulterError') {
    logger.warn({ error: err, path: req.path }, 'Upload error');
    return res.status(400).json({
      error: `Upload error: ${err.message}`,
    });
  }

  // Unknown errors
  logger.error({
    error: err,
    message: err.message,
    stack: err.stack,
    path: req.path
  }, 'Unexpected error');

  return res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && {
      details: err.message,
      stack: err.stack
    })
  });
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
  });
}

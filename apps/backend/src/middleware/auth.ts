import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt.js';
import { logger } from '../logger.js';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Authentication middleware
 * Verifies JWT token from httpOnly cookie
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    const token = req.cookies.token;

    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    logger.warn({ error }, 'Authentication failed');
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Authorization middleware - requires admin role
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  next();
}

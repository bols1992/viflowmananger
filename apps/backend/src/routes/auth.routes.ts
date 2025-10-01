import { Router } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service.js';
import { authenticate } from '../middleware/auth.js';
import { config } from '../config.js';

const router: Router = Router();

const loginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6),
});

/**
 * POST /api/auth/login
 * Login with username and password
 */
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = loginSchema.parse(req.body);

    const { token, user } = await authService.login(username, password);

    // Set httpOnly cookie with JWT
    // SECURITY: httpOnly prevents XSS, secure requires HTTPS, sameSite prevents CSRF
    res.cookie('token', token, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/logout
 * Logout and clear cookie
 */
router.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

/**
 * GET /api/auth/csrf-token
 * CSRF token endpoint for additional protection
 * In this implementation we rely on SameSite cookies
 */
router.get('/csrf-token', (_req, res) => {
  // For now, just return a placeholder
  // In production, implement proper CSRF token generation
  res.json({ csrfToken: 'placeholder' });
});

export default router;

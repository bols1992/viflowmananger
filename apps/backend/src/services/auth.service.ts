import argon2 from 'argon2';
import { prisma } from '../db.js';
import { AppError } from '../middleware/error.js';
import { signToken } from '../utils/jwt.js';
import { logger } from '../logger.js';

export class AuthService {
  /**
   * Login user with username and password
   */
  async login(username: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      logger.warn({ username }, 'Login attempt with unknown username');
      throw new AppError(401, 'Invalid credentials');
    }

    // Verify password using argon2
    const valid = await argon2.verify(user.passwordHash, password);

    if (!valid) {
      logger.warn({ username }, 'Login attempt with invalid password');
      throw new AppError(401, 'Invalid credentials');
    }

    // Generate JWT token
    const token = signToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    logger.info({ username, userId: user.id }, 'User logged in');

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    };
  }
}

export const authService = new AuthService();

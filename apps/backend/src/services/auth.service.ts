import { prisma } from '../db.js';
import { AppError } from '../middleware/error.js';
import { signToken } from '../utils/jwt.js';
import { logger } from '../logger.js';
import { verifyPassword } from '../utils/password.js';

export class AuthService {
  /**
   * Login user with username and password (admin)
   */
  async login(username: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      logger.warn({ username }, 'Login attempt with unknown username');
      throw new AppError(401, 'Invalid credentials');
    }

    // Verify password (supports both argon2 and bcrypt)
    const valid = await verifyPassword(user.passwordHash, password);

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

  /**
   * Login tenant with email and password
   */
  async loginTenant(email: string, password: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { email },
    });

    if (!tenant) {
      logger.warn({ email }, 'Login attempt with unknown tenant email');
      throw new AppError(401, 'Invalid credentials');
    }

    if (!tenant.active) {
      logger.warn({ email }, 'Login attempt for inactive tenant');
      throw new AppError(401, 'Account is inactive');
    }

    // Verify password
    const valid = await verifyPassword(tenant.passwordHash, password);

    if (!valid) {
      logger.warn({ email }, 'Login attempt with invalid password');
      throw new AppError(401, 'Invalid credentials');
    }

    // Generate JWT token with tenant role
    const token = signToken({
      userId: tenant.id,
      username: tenant.email,
      role: 'TENANT',
      tenantId: tenant.id,
    });

    logger.info({ email, tenantId: tenant.id }, 'Tenant logged in');

    return {
      token,
      user: {
        id: tenant.id,
        username: tenant.email,
        role: 'TENANT',
        tenantId: tenant.id,
        tenantName: tenant.name,
      },
    };
  }
}

export const authService = new AuthService();

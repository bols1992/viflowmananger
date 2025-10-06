import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { AppError } from '../middleware/error.js';
import { logger } from '../logger.js';

const router: Router = Router();

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(8),
});

/**
 * POST /api/password/change
 * Change password for current user (tenant only)
 */
router.post('/change', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    // Only tenants can change their password via this endpoint
    if (req.user?.role !== 'TENANT') {
      throw new AppError(403, 'Only tenants can use this endpoint');
    }

    // Get tenant
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.user.userId },
    });

    if (!tenant) {
      throw new AppError(404, 'Tenant not found');
    }

    // Verify current password
    const valid = await verifyPassword(tenant.passwordHash, currentPassword);
    if (!valid) {
      throw new AppError(401, 'Current password is incorrect');
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update password
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { passwordHash },
    });

    logger.info({ tenantId: tenant.id }, 'Tenant password changed');

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;

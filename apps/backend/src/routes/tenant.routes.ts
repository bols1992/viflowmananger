import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { tenantService } from '../services/tenant.service.js';

const router: Router = Router();

// Validation schemas
const createTenantSchema = z.object({
  name: z.string().min(2).max(100),
  domain: z.string().min(3).max(100),
  email: z.string().email(),
  password: z.string().min(8),
});

const updateTenantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  domain: z.string().min(3).max(100).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  active: z.boolean().optional(),
});

/**
 * GET /api/tenants
 * Get all tenants (admin only)
 */
router.get('/', authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const tenants = await tenantService.getAll();

    // Remove password hashes from response
    const sanitized = tenants.map(({ passwordHash, ...tenant }) => tenant);

    res.json(sanitized);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/tenants/:id
 * Get tenant by ID (admin only)
 */
router.get('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const tenant = await tenantService.getById(req.params.id);

    // Remove password hash from response
    const { passwordHash, ...sanitized } = tenant;

    res.json(sanitized);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tenants
 * Create a new tenant (admin only)
 */
router.post('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const data = createTenantSchema.parse(req.body);
    const tenant = await tenantService.create(data);

    // Remove password hash from response
    const { passwordHash, ...sanitized } = tenant;

    res.status(201).json(sanitized);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/tenants/:id
 * Update tenant (admin only)
 */
router.put('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const data = updateTenantSchema.parse(req.body);
    const tenant = await tenantService.update(req.params.id, data);

    // Remove password hash from response
    const { passwordHash, ...sanitized } = tenant;

    res.json(sanitized);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/tenants/:id
 * Delete tenant (admin only)
 */
router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await tenantService.delete(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;

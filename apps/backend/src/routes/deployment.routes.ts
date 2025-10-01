import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { deploymentService } from '../services/deployment.service.js';

const router = Router();

/**
 * GET /api/deployments
 * Get deployments (optionally filtered by siteId)
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const siteId = req.query.siteId as string | undefined;
    const deployments = await deploymentService.getDeployments(siteId);
    res.json({ deployments });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/deployments/:id
 * Get deployment by ID
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const deployment = await deploymentService.getDeploymentById(req.params.id);
    res.json({ deployment });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/deployments/:id/log
 * Get deployment log
 */
router.get('/:id/log', authenticate, async (req, res, next) => {
  try {
    const log = await deploymentService.getDeploymentLog(req.params.id);
    res.json(log);
  } catch (error) {
    next(error);
  }
});

export default router;

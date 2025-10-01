import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { siteService } from '../services/site.service.js';
import { config } from '../config.js';
import { validateUploadFile } from '../utils/zip-validator.js';
import { AppError } from '../middleware/error.js';
import { logger } from '../logger.js';
import { prisma } from '../db.js';
import { deployQueue } from '../queue/deploy.queue.js';

const router: Router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      const uploadDir = config.UPLOAD_DIR;
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, 'upload-' + uniqueSuffix + path.extname(file.originalname));
    },
  }),
  limits: {
    fileSize: config.MAX_UPLOAD_SIZE,
  },
  fileFilter: (_req, file, cb) => {
    // Only accept .zip files
    if (file.mimetype !== 'application/zip' && !file.originalname.endsWith('.zip')) {
      cb(new AppError(400, 'Only ZIP files are allowed'));
      return;
    }
    cb(null, true);
  },
});

const createSiteSchema = z.object({
  name: z.string().min(1).max(100),
  domain: z.string().min(3).max(253),
  description: z.string().max(500).optional(),
  basicAuthPassword: z.string().min(8).max(100),
  basicAuthEnabled: z.boolean().optional(),
});

/**
 * GET /api/sites
 * Get all sites
 */
router.get('/', authenticate, async (_req, res, next) => {
  try {
    const sites = await siteService.getSites();
    res.json({ sites });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/sites/:id
 * Get site by ID
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const site = await siteService.getSiteById(req.params.id);
    res.json({ site });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/sites
 * Create new site
 */
router.post('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const data = createSiteSchema.parse(req.body);
    const site = await siteService.createSite(data);
    res.status(201).json({ site });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/sites/:id/upload
 * Upload ZIP file for site
 */
router.post(
  '/:id/upload',
  authenticate,
  requireAdmin,
  upload.single('file'),
  async (req, res, next) => {
    try {
      const siteId = req.params.id;

      if (!req.file) {
        throw new AppError(400, 'No file uploaded');
      }

      // Validate site exists
      const site = await siteService.getSiteById(siteId);

      // Validate uploaded file
      const validation = await validateUploadFile(req.file.path, config.MAX_UPLOAD_SIZE);

      if (!validation.valid) {
        // Clean up invalid file
        await fs.unlink(req.file.path).catch(() => {});
        throw new AppError(400, validation.error || 'File validation failed');
      }

      // Move file to site-specific directory
      const siteUploadDir = path.join(config.UPLOAD_DIR, site.slug);
      await fs.mkdir(siteUploadDir, { recursive: true });

      const finalPath = path.join(siteUploadDir, 'upload.zip');

      // Remove old upload if exists
      await fs.unlink(finalPath).catch(() => {});

      // Move file
      await fs.rename(req.file.path, finalPath);

      logger.info(
        { siteId, slug: site.slug, size: req.file.size },
        'File uploaded successfully'
      );

      res.json({
        success: true,
        file: {
          path: finalPath,
          size: req.file.size,
          originalName: req.file.originalname,
        },
      });
    } catch (error) {
      // Clean up on error
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }
      next(error);
    }
  }
);

/**
 * POST /api/sites/:id/deploy
 * Trigger deployment for site
 */
router.post('/:id/deploy', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const siteId = req.params.id;
    const site = await siteService.getSiteById(siteId);

    // Check if upload exists
    const zipPath = path.join(config.UPLOAD_DIR, site.slug, 'upload.zip');

    try {
      await fs.access(zipPath);
    } catch {
      throw new AppError(400, 'No upload found for this site. Please upload a ZIP file first.');
    }

    // Create deployment record
    const deployment = await prisma.deployment.create({
      data: {
        siteId: site.id,
        status: 'QUEUED',
      },
    });

    // Add job to queue
    await deployQueue.add('deploy-site', {
      deploymentId: deployment.id,
      siteId: site.id,
      slug: site.slug,
      domain: site.domain,
      zipPath,
      basicAuthUser: site.basicAuthUser,
      basicAuthPassword: req.body.basicAuthPassword || '', // Pass password for htpasswd
    });

    logger.info({ deploymentId: deployment.id, siteId }, 'Deployment queued');

    res.status(202).json({ deployment });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/sites/:id
 * Delete site
 */
router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await siteService.deleteSite(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;

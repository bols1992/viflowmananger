import { Router } from 'express';
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
import { DockerService } from '../services/docker.service.js';
import AdmZip from 'adm-zip';

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
 * Upload ZIP file, build Docker image and start container
 */
router.post(
  '/:id/upload',
  authenticate,
  requireAdmin,
  upload.single('file'),
  async (req, res, next) => {
    let extractPath: string | null = null;
    let deployment: any = null;

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

      // Update site status to building
      await prisma.site.update({
        where: { id: siteId },
        data: { containerStatus: 'building' },
      });

      // Create deployment record
      const deployment = await prisma.deployment.create({
        data: {
          siteId: siteId,
          status: 'RUNNING',
          message: 'Building Docker container...',
        },
      });

      // Create site-specific directory
      const siteUploadDir = path.join(config.UPLOAD_DIR, siteId);
      await fs.mkdir(siteUploadDir, { recursive: true });

      // Extract path for building
      extractPath = path.join(siteUploadDir, 'extracted');
      await fs.rm(extractPath, { recursive: true, force: true });
      await fs.mkdir(extractPath, { recursive: true });

      // Extract ZIP
      logger.info({ siteId }, 'Extracting ZIP file...');
      const zip = new AdmZip(req.file.path);
      zip.extractAllTo(extractPath, true);

      // Find ViFlow DLL
      logger.info({ siteId }, 'Searching for ViFlow application...');
      const dllPath = await DockerService.findViFlowDll(extractPath);

      if (!dllPath) {
        throw new AppError(400, 'Kein ViFlow Export erkannt. Die Datei "ViCon.ViFlow.WebModel.Server.dll" wurde nicht gefunden.');
      }

      logger.info({ siteId, dllPath }, 'ViFlow application found');

      // Detect ViFlow version
      logger.info({ siteId }, 'Detecting ViFlow version...');
      const viflowVersion = await DockerService.detectViFlowVersion(dllPath);
      logger.info({ siteId, viflowVersion }, 'ViFlow version detected');

      // Clean up old container and image if exists
      if (site.containerName) {
        logger.info({ siteId }, 'Cleaning up old container...');
        await DockerService.cleanup(siteId, site.domain);
      }

      // Build Docker image (use dllPath instead of extractPath)
      logger.info({ siteId }, 'Building Docker image...');
      const imageName = await DockerService.buildImage(siteId, dllPath, viflowVersion);

      // Get available port
      const port = await DockerService.getAvailablePort();

      // Start container
      logger.info({ siteId, port }, 'Starting Docker container...');
      const containerName = await DockerService.startContainer(siteId, imageName, port);

      // Update Nginx config
      logger.info({ siteId, domain: site.domain, port }, 'Updating Nginx configuration...');
      await DockerService.updateNginxConfig(site.domain, port);

      // Update site in database
      await prisma.site.update({
        where: { id: siteId },
        data: {
          viflowVersion,
          containerName,
          containerPort: port,
          containerStatus: 'running',
        },
      });

      // Update deployment record as SUCCESS
      await prisma.deployment.update({
        where: { id: deployment.id },
        data: {
          status: 'SUCCESS',
          message: `Container deployed on port ${port}`,
          finishedAt: new Date(),
        },
      });

      // Clean up uploaded ZIP
      await fs.unlink(req.file.path).catch(() => {});

      logger.info(
        { siteId, viflowVersion, containerName, port },
        'Site deployed successfully'
      );

      res.json({
        success: true,
        site: {
          id: siteId,
          viflowVersion,
          containerName,
          containerPort: port,
          containerStatus: 'running',
          url: `http://${site.domain}`,
        },
      });
    } catch (error) {
      // Update status to error
      if (req.params.id) {
        await prisma.site.update({
          where: { id: req.params.id },
          data: { containerStatus: 'error' },
        }).catch(() => {});
      }

      // Update deployment record as FAILED
      if (deployment) {
        await prisma.deployment.update({
          where: { id: deployment.id },
          data: {
            status: 'FAILED',
            message: error instanceof Error ? error.message : 'Deployment failed',
            finishedAt: new Date(),
          },
        }).catch(() => {});
      }

      // Clean up on error
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }
      if (extractPath) {
        await fs.rm(extractPath, { recursive: true, force: true }).catch(() => {});
      }

      logger.error({ siteId: req.params.id, error }, 'Upload and deployment failed');
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
 * POST /api/sites/:id/start
 * Start container
 */
router.post('/:id/start', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const siteId = req.params.id;
    const site = await siteService.getSiteById(siteId);

    if (!site.containerName) {
      throw new AppError(400, 'No container found for this site');
    }

    await DockerService.startExistingContainer(site.containerName);

    await prisma.site.update({
      where: { id: siteId },
      data: { containerStatus: 'running' },
    });

    logger.info({ siteId, containerName: site.containerName }, 'Container started');

    res.json({ success: true, status: 'running' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/sites/:id/stop
 * Stop container
 */
router.post('/:id/stop', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const siteId = req.params.id;
    const site = await siteService.getSiteById(siteId);

    if (!site.containerName) {
      throw new AppError(400, 'No container found for this site');
    }

    await DockerService.stopContainer(site.containerName);

    await prisma.site.update({
      where: { id: siteId },
      data: { containerStatus: 'stopped' },
    });

    logger.info({ siteId, containerName: site.containerName }, 'Container stopped');

    res.json({ success: true, status: 'stopped' });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/sites/:id
 * Delete site and cleanup all resources
 */
router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const siteId = req.params.id;
    const site = await prisma.site.findUnique({ where: { id: siteId } });

    if (!site) {
      throw new AppError(404, 'Site not found');
    }

    // Cleanup Docker resources
    if (site.containerName) {
      logger.info({ siteId, domain: site.domain }, 'Cleaning up Docker resources...');
      await DockerService.cleanup(siteId, site.domain);
    }

    // Delete from database
    const result = await siteService.deleteSite(siteId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;

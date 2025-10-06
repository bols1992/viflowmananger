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

// Configure multer for logo uploads
const logoUpload = multer({
  storage: multer.diskStorage({
    destination: async (req, _file, cb) => {
      const siteId = req.params.id;
      const logoDir = path.join(config.UPLOAD_DIR, siteId, 'logo');
      await fs.mkdir(logoDir, { recursive: true });
      cb(null, logoDir);
    },
    filename: (_req, file, cb) => {
      // Keep original extension
      cb(null, 'logo' + path.extname(file.originalname));
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (_req, file, cb) => {
    // Only accept image files
    const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (!allowedMimes.includes(file.mimetype)) {
      cb(new AppError(400, 'Only image files (PNG, JPG, SVG, WebP) are allowed'));
      return;
    }
    cb(null, true);
  },
});

const createSiteSchema = z.object({
  name: z.string().min(1).max(100),
  subdomain: z.string().min(1).max(63), // Subdomain part only (without base domain)
  description: z.string().max(500).optional(),
  basicAuthPassword: z.string().min(8).max(100),
  basicAuthEnabled: z.boolean().optional(),
  tenantId: z.string().uuid().optional(), // Optional for admin
});

/**
 * GET /api/sites
 * Get all sites (filtered by tenant if not admin)
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    // If user is tenant, only show their sites
    const tenantId = req.user?.role === 'TENANT' ? req.user?.userId : undefined;
    const sites = await siteService.getSites(tenantId);
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
router.post('/', authenticate, async (req, res, next) => {
  try {
    const data = createSiteSchema.parse(req.body);

    // Determine tenant ID
    let tenantId = data.tenantId;
    let baseDomain: string;

    if (req.user?.role === 'TENANT') {
      // Tenant users can only create sites for themselves
      tenantId = req.user.userId;
    }

    // Get tenant's domain if tenantId is provided
    if (tenantId) {
      const { tenantService } = await import('../services/tenant.service.js');
      baseDomain = await tenantService.getTenantDomain(tenantId);
    } else {
      // Fallback to default domain (for backward compatibility)
      baseDomain = 'pm-iwt.de';
    }

    // Construct full domain from subdomain + base domain
    const fullDomain = `${data.subdomain}.${baseDomain}`;

    const site = await siteService.createSite({
      ...data,
      domain: fullDomain,
      tenantId,
    });

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

      // Modify appsettings.json to enable SkipAuthentication
      logger.info({ siteId }, 'Configuring appsettings.json...');
      const appSettingsPath = path.join(extractPath, 'appsettings.json');
      try {
        const appSettingsContent = await fs.readFile(appSettingsPath, 'utf-8');
        const appSettings = JSON.parse(appSettingsContent);

        // Set SkipAuthentication to true
        if (appSettings.ViFlow) {
          appSettings.ViFlow.SkipAuthentication = true;
        } else {
          appSettings.ViFlow = { SkipAuthentication: true };
        }

        await fs.writeFile(appSettingsPath, JSON.stringify(appSettings, null, 2), 'utf-8');
        logger.info({ siteId }, 'SkipAuthentication enabled in appsettings.json');
      } catch (err) {
        logger.warn({ siteId, error: err }, 'Could not modify appsettings.json - file may not exist or be invalid JSON');
      }

      // Find ViFlow DLL
      logger.info({ siteId }, 'Searching for ViFlow application...');
      const dllPath = await DockerService.findViFlowDll(extractPath);

      if (!dllPath) {
        throw new AppError(400, 'Kein ViFlow Export erkannt. Die Datei "ViCon.ViFlow.WebModel.Server.dll" wurde nicht gefunden.');
      }

      logger.info({ siteId, dllPath }, 'ViFlow application found');

      // Calculate relative path from extractPath to dllPath
      const dllSubPath = dllPath === extractPath ? undefined : path.relative(extractPath, dllPath);
      if (dllSubPath) {
        logger.info({ siteId, dllSubPath }, 'DLL found in subdirectory');
      }

      // Detect ViFlow version
      logger.info({ siteId }, 'Detecting ViFlow version...');
      const viflowVersion = await DockerService.detectViFlowVersion(dllPath);
      logger.info({ siteId, viflowVersion }, 'ViFlow version detected');

      // Clean up old container and image if exists
      if (site.containerName) {
        logger.info({ siteId }, 'Cleaning up old container...');
        await DockerService.cleanup(siteId, site.domain, false); // Don't delete upload dir
      }

      // Build Docker image
      logger.info({ siteId }, 'Building Docker image...');
      const imageName = await DockerService.buildImage(siteId, extractPath, viflowVersion, dllSubPath);

      // Get available port
      const port = await DockerService.getAvailablePort();

      // Start containers (ViFlow + Auth Proxy)
      logger.info({ siteId, port }, 'Starting Docker containers...');
      const authPassword = site.basicAuthEnabled ? site.basicAuthPassword : undefined;
      const containerName = await DockerService.startContainer(
        siteId,
        imageName,
        port,
        site.name,
        authPassword
      );

      // Update Nginx config (now just proxies to auth container, no basic auth needed)
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
router.post('/:id/start', authenticate, async (req, res, next) => {
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
router.post('/:id/stop', authenticate, async (req, res, next) => {
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
 * POST /api/sites/:id/logo
 * Upload custom logo for site
 */
router.post(
  '/:id/logo',
  authenticate,
  logoUpload.single('logo'),
  async (req, res, next) => {
    try {
      const siteId = req.params.id;

      if (!req.file) {
        throw new AppError(400, 'No logo file uploaded');
      }

      // Validate site exists
      await siteService.getSiteById(siteId);

      // Update site with logo path
      const logoPath = path.join(siteId, 'logo', req.file.filename);
      await prisma.site.update({
        where: { id: siteId },
        data: { customLogoPath: logoPath },
      });

      logger.info({ siteId, logoPath }, 'Custom logo uploaded');

      res.json({
        success: true,
        logoPath,
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
 * DELETE /api/sites/:id/logo
 * Delete custom logo for site
 */
router.delete('/:id/logo', authenticate, async (req, res, next) => {
  try {
    const siteId = req.params.id;
    const site = await siteService.getSiteById(siteId);

    if (!site.customLogoPath) {
      throw new AppError(404, 'No custom logo found for this site');
    }

    // Delete logo file
    const logoFullPath = path.join(config.UPLOAD_DIR, site.customLogoPath);
    await fs.unlink(logoFullPath).catch(() => {});

    // Update site
    await prisma.site.update({
      where: { id: siteId },
      data: { customLogoPath: null },
    });

    logger.info({ siteId }, 'Custom logo deleted');

    res.json({ success: true });
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

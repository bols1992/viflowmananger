import { prisma } from '../db.js';
import { AppError } from '../middleware/error.js';
import { logger } from '../logger.js';

export class DeploymentService {
  /**
   * Get deployments for a site
   */
  async getDeployments(siteId?: string) {
    return prisma.deployment.findMany({
      where: siteId ? { siteId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        site: {
          select: {
            name: true,
            domain: true,
            slug: true,
          },
        },
      },
      take: 100,
    });
  }

  /**
   * Get deployment by ID
   */
  async getDeploymentById(id: string) {
    const deployment = await prisma.deployment.findUnique({
      where: { id },
      include: {
        site: true,
      },
    });

    if (!deployment) {
      throw new AppError(404, 'Deployment not found');
    }

    return deployment;
  }

  /**
   * Get deployment log
   */
  async getDeploymentLog(id: string) {
    const deployment = await prisma.deployment.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        log: true,
        message: true,
      },
    });

    if (!deployment) {
      throw new AppError(404, 'Deployment not found');
    }

    return {
      id: deployment.id,
      status: deployment.status,
      message: deployment.message,
      log: deployment.log || '',
    };
  }

  /**
   * Update deployment status
   */
  async updateDeploymentStatus(
    id: string,
    status: 'RUNNING' | 'SUCCESS' | 'FAILED',
    message?: string
  ) {
    const updateData: any = { status, message };

    if (status === 'RUNNING') {
      updateData.startedAt = new Date();
    } else if (status === 'SUCCESS' || status === 'FAILED') {
      updateData.finishedAt = new Date();
    }

    return prisma.deployment.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Append to deployment log
   */
  async appendLog(id: string, logLine: string) {
    const deployment = await prisma.deployment.findUnique({
      where: { id },
      select: { log: true },
    });

    if (!deployment) {
      logger.warn({ deploymentId: id }, 'Cannot append log - deployment not found');
      return;
    }

    const currentLog = deployment.log || '';
    const newLog = currentLog + logLine + '\n';

    await prisma.deployment.update({
      where: { id },
      data: { log: newLog },
    });
  }
}

export const deploymentService = new DeploymentService();

import { Worker, Job } from 'bullmq';
import { spawn } from 'child_process';
import path from 'path';
import { config } from '../config.js';
import { deploymentService } from '../services/deployment.service.js';
import { logger } from '../logger.js';

export interface DeployJobData {
  deploymentId: string;
  siteId: string;
  slug: string;
  domain: string;
  zipPath: string;
  basicAuthUser: string;
  basicAuthPassword: string;
}

/**
 * BullMQ Worker for deployment jobs
 * Executes deployment script with sudo and captures output
 */
export function createDeployWorker() {
  const worker = new Worker<DeployJobData>(
    'deploy',
    async (job: Job<DeployJobData>) => {
      const { deploymentId, slug, domain, zipPath, basicAuthUser, basicAuthPassword } = job.data;

      logger.info(
        { deploymentId, slug, domain },
        'Starting deployment job'
      );

      await deploymentService.updateDeploymentStatus(deploymentId, 'RUNNING');
      await deploymentService.appendLog(
        deploymentId,
        `[${new Date().toISOString()}] Starting deployment for ${domain}`
      );

      try {
        // SECURITY: Execute whitelisted deployment script via sudo
        // The script path is hardcoded and controlled by us
        const scriptPath = path.join(config.SCRIPTS_DIR, 'deploy_site.sh');

        const args = [scriptPath, slug, domain, zipPath, basicAuthUser, basicAuthPassword];

        logger.debug({ scriptPath, args: args.slice(0, -1) }, 'Executing deployment script');

        // Execute with sudo
        const proc = spawn('sudo', args, {
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => {
          const line = data.toString();
          stdout += line;
          deploymentService.appendLog(deploymentId, line.trimEnd());
        });

        proc.stderr.on('data', (data) => {
          const line = data.toString();
          stderr += line;
          deploymentService.appendLog(deploymentId, `[ERROR] ${line.trimEnd()}`);
        });

        const exitCode = await new Promise<number>((resolve) => {
          proc.on('close', (code) => resolve(code || 0));
        });

        if (exitCode === 0) {
          logger.info({ deploymentId, slug }, 'Deployment successful');
          await deploymentService.updateDeploymentStatus(
            deploymentId,
            'SUCCESS',
            'Deployment completed successfully'
          );
          await deploymentService.appendLog(
            deploymentId,
            `[${new Date().toISOString()}] ✅ Deployment completed successfully`
          );
        } else {
          logger.error({ deploymentId, slug, exitCode, stderr }, 'Deployment failed');
          await deploymentService.updateDeploymentStatus(
            deploymentId,
            'FAILED',
            `Deployment script failed with exit code ${exitCode}`
          );
          await deploymentService.appendLog(
            deploymentId,
            `[${new Date().toISOString()}] ❌ Deployment failed with exit code ${exitCode}`
          );
        }

        return { success: exitCode === 0, exitCode };
      } catch (error) {
        logger.error({ error, deploymentId }, 'Deployment job error');
        await deploymentService.updateDeploymentStatus(
          deploymentId,
          'FAILED',
          error instanceof Error ? error.message : 'Unknown error'
        );
        await deploymentService.appendLog(
          deploymentId,
          `[${new Date().toISOString()}] ❌ Job error: ${error}`
        );
        throw error;
      }
    },
    {
      connection: {
        host: new URL(config.REDIS_URL).hostname,
        port: parseInt(new URL(config.REDIS_URL).port) || 6379,
      },
      concurrency: 1, // Process one deployment at a time for safety
    }
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Deploy job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err }, 'Deploy job failed');
  });

  return worker;
}

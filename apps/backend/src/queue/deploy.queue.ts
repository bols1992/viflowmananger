import { Queue } from 'bullmq';
import { config } from '../config.js';
import type { DeployJobData } from './deploy.worker.js';

/**
 * BullMQ Queue for deployment jobs
 */
export const deployQueue = new Queue<DeployJobData>('deploy', {
  connection: {
    host: new URL(config.REDIS_URL).hostname,
    port: parseInt(new URL(config.REDIS_URL).port) || 6379,
  },
  defaultJobOptions: {
    attempts: 1, // No automatic retry for deployments
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      count: 100, // Keep last 100 failed jobs
    },
  },
});

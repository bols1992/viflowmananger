import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

export const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, disconnecting Prisma');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, disconnecting Prisma');
  await prisma.$disconnect();
  process.exit(0);
});

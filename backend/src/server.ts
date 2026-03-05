import 'dotenv/config';
import { createApp } from './app.js';
import { connectRedis, disconnectRedis } from './lib/redis.js';
import { prisma } from './lib/db.js';
import { logger } from './lib/logger.js';
import { startSyncWorker } from './sync/sync.worker.js';
import { bootstrapSyncScheduler } from './sync/sync.scheduler.js';

const PORT = parseInt(process.env.PORT || '4000', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function start(): Promise<void> {
  try {
    // Connect to Redis
    await connectRedis();
    logger.info('Redis connected');

    // Start BullMQ sync worker
    startSyncWorker();

    // Bootstrap recurring sync scheduler for existing integrations
    await bootstrapSyncScheduler();

    // Build Fastify app
    const app = await createApp();

    // Start listening
    await app.listen({ port: PORT, host: HOST });
    logger.info(`Server running`, { port: PORT, host: HOST });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully`);
      try {
        await app.close();
        await prisma.$disconnect();
        await disconnectRedis();
        logger.info('Graceful shutdown complete');
        process.exit(0);
      } catch (err) {
        logger.error('Error during shutdown', { error: (err as Error).message });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.fatal('Failed to start server', { error: (err as Error).message });
    process.exit(1);
  }
}

start();

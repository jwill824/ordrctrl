// T048 — Sync Scheduler
// Registers repeating BullMQ jobs every 15 minutes per connected integration.
// Exposes triggerManualSync(userId) for on-demand refresh.

import { syncQueue } from '../lib/queue.js';
import { prisma } from '../lib/db.js';
import { logger } from '../lib/logger.js';

const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Register a repeating sync job for a specific integration.
 * Uses BullMQ's repeat feature with a fixed interval.
 */
export async function scheduleIntegrationSync(
  integrationId: string,
  userId: string
): Promise<void> {
  await syncQueue.add(
    'sync',
    { integrationId, userId },
    {
      repeat: { every: SYNC_INTERVAL_MS },
      jobId: `repeat:${integrationId}`,
    }
  );
  logger.info('Scheduled recurring sync', { integrationId });
}

/**
 * Remove the repeating sync job for an integration (called on disconnect).
 */
export async function unscheduleIntegrationSync(integrationId: string): Promise<void> {
  const repeatableJobs = await syncQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.id === `repeat:${integrationId}`) {
      await syncQueue.removeRepeatableByKey(job.key);
      logger.info('Unscheduled recurring sync', { integrationId });
    }
  }
}

/**
 * Bootstrap: register recurring jobs for all currently connected integrations.
 * Called once on server startup.
 */
export async function bootstrapSyncScheduler(): Promise<void> {
  const integrations = await prisma.integration.findMany({
    where: { status: 'connected' },
    select: { id: true, userId: true },
  });

  for (const integration of integrations) {
    await scheduleIntegrationSync(integration.id, integration.userId);
  }

  logger.info('Sync scheduler bootstrapped', { count: integrations.length });
}

/**
 * Trigger an immediate sync for all connected integrations of a user.
 * Returns the number of jobs queued.
 */
export async function triggerManualSync(userId: string): Promise<number> {
  const integrations = await prisma.integration.findMany({
    where: { userId, status: 'connected' },
    select: { id: true },
  });

  for (const integration of integrations) {
    await syncQueue.add('sync', { integrationId: integration.id, userId });
  }

  return integrations.length;
}

// T047 — Sync Worker
// BullMQ job processor: calls adapter.sync(), handles token refresh, persists via CacheService

import { createWorker, syncQueue, QUEUE_NAMES } from '../lib/queue.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/db.js';
import { getAdapter } from '../integrations/index.js';
import type { ServiceId } from '../integrations/_adapter/types.js';
import { TokenRefreshError } from '../integrations/_adapter/types.js';
import { persistCacheItems, cleanupStaleCacheItems, markMissingItemsAsSourceCompleted, applySourceCompletions } from './cache.service.js';
import { clearExpiredCompleted } from '../feed/feed.service.js';
import { getUserSettings } from '../user/user.service.js';

export interface SyncJobData {
  integrationId: string;
  userId: string;
}

let workerStarted = false;

export function startSyncWorker(): void {
  if (workerStarted) return;
  workerStarted = true;

  createWorker<SyncJobData>(QUEUE_NAMES.SYNC, async (job) => {
    const { integrationId, userId } = job.data;

    // Load integration
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration || integration.status === 'disconnected') {
      logger.info('Skipping sync for disconnected integration', { integrationId });
      return;
    }

    const adapter = getAdapter(integration.serviceId as ServiceId);

    try {
      logger.info('Starting sync', { integrationId, serviceId: integration.serviceId });

      // Attempt sync
      let items;
      try {
        items = await adapter.sync(integrationId);
      } catch (syncErr) {
        if (syncErr instanceof TokenRefreshError) {
          // Try token refresh once
          try {
            logger.info('Attempting token refresh', { integrationId });
            await adapter.refreshToken(integrationId);
            items = await adapter.sync(integrationId);
          } catch (refreshErr) {
            // Token refresh failed — mark integration as error
            await prisma.integration.update({
              where: { id: integrationId },
              data: {
                status: 'error',
                lastSyncError: 'Token refresh failed. Please reconnect.',
              },
            });
            logger.error('Token refresh failed, integration marked error', {
              integrationId,
              error: (refreshErr as Error).message,
            });
            return;
          }
        } else {
          throw syncErr;
        }
      }

      // Persist items
      await persistCacheItems(integrationId, userId, items);

      // Apply source-side completions:
      // 1. Items explicitly marked completed by adapter (completed=true in NormalizedItem)
      // 2. Items absent from this sync result (set-difference / inbox_removal)
      const returnedIds = items.map((i) => i.externalId);
      await markMissingItemsAsSourceCompleted(integrationId, returnedIds);
      await applySourceCompletions(integrationId);

      // Update integration lastSyncAt + clear error
      await prisma.integration.update({
        where: { id: integrationId },
        data: {
          status: 'connected',
          lastSyncAt: new Date(),
          lastSyncError: null,
        },
      });

      // Opportunistic cleanup of stale items
      await cleanupStaleCacheItems();

      // Post-sync auto-clear: dismiss completed items older than user's auto-clear window
      try {
        const settings = await getUserSettings(userId);
        if (settings.autoClearEnabled) {
          const cleared = await clearExpiredCompleted(userId, settings.autoClearWindowDays);
          if (cleared > 0) {
            logger.info('Auto-cleared expired completed items', { userId, cleared });
          }
        }
      } catch (autoClearErr) {
        // Non-fatal: log and continue
        logger.warn('Auto-clear failed (non-fatal)', { userId, error: (autoClearErr as Error).message });
      }

      logger.info('Sync completed', {
        integrationId,
        serviceId: integration.serviceId,
        itemCount: items.length,
      });
    } catch (err) {
      // Mark integration as error
      await prisma.integration.update({
        where: { id: integrationId },
        data: {
          status: 'error',
          lastSyncError: (err as Error).message,
        },
      });
      throw err;
    }
  });

  logger.info('Sync worker started');
}

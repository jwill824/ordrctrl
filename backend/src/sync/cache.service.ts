// T046 — CacheService
// Persist NormalizedItem[] to SyncCacheItem, TTL enforcement, stale cleanup

import { prisma } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import type { NormalizedItem } from '../integrations/_adapter/types.js';
import type { Prisma } from '@prisma/client';

const CACHE_TTL_HOURS = 24;

/**
 * Upsert a batch of NormalizedItems into SyncCacheItem for a given integration.
 * Sets expiresAt = now + 24h.
 * Uses upsert on [integrationId, externalId] to avoid duplicates.
 *
 * NOTE: The update block intentionally omits `completedInOrdrctrl` and `completedAt`.
 * Local completion state is owned by ordrctrl and must never be overwritten by sync.
 * A SyncOverride(REOPENED) record is the explicit signal that the user has locally
 * reopened an item — sync must always respect it. If two-way sync (issue #10) ever
 * needs to push source completion state, it must first check for a SyncOverride.
 */
export async function persistCacheItems(
  integrationId: string,
  userId: string,
  items: NormalizedItem[]
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_HOURS * 60 * 60 * 1000);

  for (const item of items) {
    await prisma.syncCacheItem.upsert({
      where: {
        integrationId_externalId: {
          integrationId,
          externalId: item.externalId,
        },
      },
      create: {
        integrationId,
        userId,
        itemType: item.itemType,
        externalId: item.externalId,
        title: item.title,
        dueAt: item.dueAt,
        startAt: item.startAt,
        endAt: item.endAt,
        syncedAt: now,
        expiresAt,
        rawPayload: item.rawPayload as Prisma.InputJsonValue,
      },
      update: {
        itemType: item.itemType,
        title: item.title,
        dueAt: item.dueAt,
        startAt: item.startAt,
        endAt: item.endAt,
        syncedAt: now,
        expiresAt,
        rawPayload: item.rawPayload as Prisma.InputJsonValue,
      },
    });
  }

  logger.info('Cache items persisted', { integrationId, count: items.length });
}

/**
 * Delete all expired SyncCacheItems (expiresAt < now).
 * Called periodically during sync.
 */
export async function cleanupStaleCacheItems(): Promise<number> {
  const result = await prisma.syncCacheItem.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  if (result.count > 0) {
    logger.info('Stale cache items cleaned up', { count: result.count });
  }
  return result.count;
}

/**
 * Get all non-expired cache items for a user (active + completed).
 */
export async function getCacheItemsForUser(userId: string) {
  return prisma.syncCacheItem.findMany({
    where: {
      userId,
      expiresAt: { gt: new Date() },
    },
    include: {
      integration: {
        select: { serviceId: true, status: true, lastSyncError: true },
      },
    },
    orderBy: { syncedAt: 'desc' },
  });
}

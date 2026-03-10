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
        // If the adapter explicitly signals completion, mark it at create time
        ...(item.completed === true ? { completedAtSource: true } : {}),
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
        // If the adapter explicitly signals completion, propagate to cache
        ...(item.completed === true ? { completedAtSource: true } : {}),
      },
    });
  }

  logger.info('Cache items persisted', { integrationId, count: items.length });
}

/**
 * Mark cache items as completed at source using set-difference:
 * any item for this integration whose externalId is NOT in `returnedExternalIds`
 * is treated as absent from the source's active list → completedAtSource = true.
 *
 * Only operates on items that are still non-expired and not already completedAtSource.
 */
export async function markMissingItemsAsSourceCompleted(
  integrationId: string,
  returnedExternalIds: string[]
): Promise<number> {
  const result = await prisma.syncCacheItem.updateMany({
    where: {
      integrationId,
      expiresAt: { gt: new Date() },
      completedAtSource: false,
      ...(returnedExternalIds.length > 0
        ? { externalId: { notIn: returnedExternalIds } }
        : {}),
    },
    data: { completedAtSource: true },
  });

  if (result.count > 0) {
    logger.info('Items marked as source-completed (set-difference)', {
      integrationId,
      count: result.count,
    });
  }
  return result.count;
}

/**
 * Propagate source completion to ordrctrl:
 * For each SyncCacheItem where completedAtSource=true and completedInOrdrctrl=false,
 * check for a REOPENED SyncOverride. If none exists, set completedInOrdrctrl=true.
 *
 * A REOPENED override means the user explicitly reopened the item after source completion —
 * user intent always wins; we skip those items entirely.
 */
export async function applySourceCompletions(integrationId: string): Promise<number> {
  const pendingItems = await prisma.syncCacheItem.findMany({
    where: {
      integrationId,
      completedAtSource: true,
      completedInOrdrctrl: false,
    },
    select: { id: true },
  });

  if (pendingItems.length === 0) return 0;

  const itemIds = pendingItems.map((i) => i.id);

  // Find items that have a REOPENED override — these must be skipped
  const overriddenIds = await prisma.syncOverride
    .findMany({
      where: {
        syncCacheItemId: { in: itemIds },
        overrideType: 'REOPENED',
      },
      select: { syncCacheItemId: true },
    })
    .then((rows) => new Set(rows.map((r) => r.syncCacheItemId)));

  const toCompleteIds = itemIds.filter((id) => !overriddenIds.has(id));
  if (toCompleteIds.length === 0) return 0;

  const result = await prisma.syncCacheItem.updateMany({
    where: { id: { in: toCompleteIds } },
    data: { completedInOrdrctrl: true, completedAt: new Date() },
  });

  logger.info('Source completions applied to ordrctrl', {
    integrationId,
    completed: result.count,
    skippedByOverride: overriddenIds.size,
  });
  return result.count;
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
 * Optionally excludes items by ID (e.g., dismissed items).
 */
export async function getCacheItemsForUser(userId: string, excludeIds: string[] = []) {
  return prisma.syncCacheItem.findMany({
    where: {
      userId,
      expiresAt: { gt: new Date() },
      ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
    },
    include: {
      integration: {
        select: { serviceId: true, status: true, lastSyncError: true },
      },
    },
    orderBy: { syncedAt: 'desc' },
  });
}

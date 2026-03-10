// T049 — FeedService
// Merge SyncCacheItem[] + NativeTask[] into FeedItem[], apply ordering rules,
// apply duplicate detection (case-insensitive title match across sources).

import { prisma } from '../lib/db.js';
import { getCacheItemsForUser } from '../sync/cache.service.js';
import type { ServiceId } from '../integrations/_adapter/types.js';

export interface FeedItem {
  id: string;                       // "sync:<uuid>" | "native:<uuid>"
  source: string;                   // account label or email, e.g. "you@gmail.com"
  serviceId: string;                // "gmail" | "microsoft_tasks" | "apple_calendar" | "ordrctrl"
  itemType: 'task' | 'event' | 'message';
  title: string;
  dueAt: string | null;             // ISO string
  startAt: string | null;
  endAt: string | null;
  completed: boolean;
  completedAt: string | null;
  isDuplicateSuspect: boolean;
}

export interface SyncStatusEntry {
  status: 'connected' | 'error' | 'disconnected';
  lastSyncAt: string | null;
  error: string | null;
}

export interface FeedResult {
  items: FeedItem[];
  completed: FeedItem[];
  syncStatus: Record<ServiceId, SyncStatusEntry>;
}

const NATIVE_SOURCE = 'ordrctrl';

// T007/T008 — filter dismissed items from the feed
export async function buildFeed(
  userId: string,
  includeCompleted = false
): Promise<FeedResult> {
  // Get dismissed sync item IDs for this user
  const dismissedOverrides = await prisma.syncOverride.findMany({
    where: { userId, overrideType: 'DISMISSED' },
    select: { syncCacheItemId: true },
  });
  const dismissedSyncIds = dismissedOverrides.map((d) => d.syncCacheItemId);

  // Fetch sync cache items excluding dismissed
  const cacheItems = await getCacheItemsForUser(userId, dismissedSyncIds);

  // Fetch native tasks (excluding dismissed)
  const nativeTasks = await prisma.nativeTask.findMany({
    where: { userId, dismissed: false },
    orderBy: { createdAt: 'asc' },
  });

  // Map sync cache items to FeedItem
  const syncFeedItems: FeedItem[] = cacheItems.map((item) => ({
    id: `sync:${item.id}`,
    source: item.integration.label ?? item.integration.accountIdentifier,
    serviceId: item.integration.serviceId,
    itemType: item.itemType as 'task' | 'event' | 'message',
    title: item.title,
    dueAt: item.dueAt?.toISOString() ?? null,
    startAt: item.startAt?.toISOString() ?? null,
    endAt: item.endAt?.toISOString() ?? null,
    completed: item.completedInOrdrctrl,
    completedAt: item.completedAt?.toISOString() ?? null,
    isDuplicateSuspect: false, // populated below
  }));

  // Map native tasks to FeedItem
  const nativeFeedItems: FeedItem[] = nativeTasks.map((task) => ({
    id: `native:${task.id}`,
    source: NATIVE_SOURCE,
    serviceId: 'ordrctrl',
    itemType: 'task' as const,
    title: task.title,
    dueAt: task.dueAt?.toISOString() ?? null,
    startAt: null,
    endAt: null,
    completed: task.completed,
    completedAt: task.completedAt?.toISOString() ?? null,
    isDuplicateSuspect: false,
  }));

  const allItems = [...syncFeedItems, ...nativeFeedItems];

  // Duplicate detection: case-insensitive title match across different sources
  const titleSourceMap = new Map<string, Set<string>>();
  for (const item of allItems) {
    const key = item.title.trim().toLowerCase();
    if (!titleSourceMap.has(key)) titleSourceMap.set(key, new Set());
    titleSourceMap.get(key)!.add(item.source);
  }

  for (const item of allItems) {
    const key = item.title.trim().toLowerCase();
    const sources = titleSourceMap.get(key)!;
    item.isDuplicateSuspect = sources.size > 1;
  }

  // Separate active vs completed
  const activeItems = allItems.filter((i) => !i.completed);
  const completedItems = allItems.filter((i) => i.completed);

  // Sort active items: dated ascending, then undated by syncedAt desc
  const sortedActive = sortFeedItems(activeItems);

  // Sort completed: by completedAt desc
  completedItems.sort((a, b) => {
    const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    return bTime - aTime;
  });

  // Build sync status from integrations
  const integrations = await prisma.integration.findMany({
    where: { userId },
    select: { serviceId: true, status: true, lastSyncAt: true, lastSyncError: true },
  });

  const syncStatus = buildSyncStatus(integrations);

  return {
    items: sortedActive,
    completed: includeCompleted ? completedItems : [],
    syncStatus,
  };
}

/**
 * Sort active feed items:
 * 1. Items with dueAt or startAt → ascending chronological (soonest first)
 * 2. Items without dates → by syncedAt desc (native tasks by createdAt desc)
 */
function sortFeedItems(items: FeedItem[]): FeedItem[] {
  const dated = items.filter((i) => i.dueAt !== null || i.startAt !== null);
  const undated = items.filter((i) => i.dueAt === null && i.startAt === null);

  dated.sort((a, b) => {
    const aTime = new Date(a.dueAt ?? a.startAt!).getTime();
    const bTime = new Date(b.dueAt ?? b.startAt!).getTime();
    return aTime - bTime;
  });

  // Undated: keep as-is (already ordered by syncedAt/createdAt from DB query)

  return [...dated, ...undated];
}

function buildSyncStatus(
  integrations: Array<{
    serviceId: string;
    status: string;
    lastSyncAt: Date | null;
    lastSyncError: string | null;
  }>
): Record<ServiceId, SyncStatusEntry> {
  const ALL_SERVICE_IDS: ServiceId[] = [
    'gmail',
    'microsoft_tasks',
    'apple_calendar',
  ];

  const byService = new Map(integrations.map((i) => [i.serviceId, i]));

  return Object.fromEntries(
    ALL_SERVICE_IDS.map((sid) => {
      const found = byService.get(sid);
      return [
        sid,
        {
          status: (found?.status ?? 'disconnected') as 'connected' | 'error' | 'disconnected',
          lastSyncAt: found?.lastSyncAt?.toISOString() ?? null,
          error: found?.lastSyncError ?? null,
        },
      ];
    })
  ) as Record<ServiceId, SyncStatusEntry>;
}

/**
 * Mark a sync cache item as complete in ordrctrl.
 * Deletes any existing REOPENED SyncOverride for this item.
 * Returns the updated FeedItem fields.
 */
export async function completeSyncItem(
  itemId: string,
  userId: string
): Promise<{ id: string; completed: boolean; completedAt: string }> {
  const updated = await prisma.syncCacheItem.updateMany({
    where: { id: itemId, userId, completedInOrdrctrl: false },
    data: {
      completedInOrdrctrl: true,
      completedAt: new Date(),
    },
  });

  if (updated.count === 0) {
    throw new Error('Item not found or already completed');
  }

  // Delete any REOPENED override — user is re-completing the item
  await prisma.syncOverride.deleteMany({
    where: { syncCacheItemId: itemId, overrideType: 'REOPENED' },
  });

  const item = await prisma.syncCacheItem.findUnique({ where: { id: itemId } });

  return {
    id: `sync:${itemId}`,
    completed: true,
    completedAt: item!.completedAt!.toISOString(),
  };
}

/**
 * Mark a native task as complete.
 */
export async function completeNativeTask(
  taskId: string,
  userId: string
): Promise<{ id: string; completed: boolean; completedAt: string }> {
  const updated = await prisma.nativeTask.updateMany({
    where: { id: taskId, userId, completed: false },
    data: { completed: true, completedAt: new Date() },
  });

  if (updated.count === 0) {
    throw new Error('Task not found or already completed');
  }

  const task = await prisma.nativeTask.findUnique({ where: { id: taskId } });

  return {
    id: `native:${taskId}`,
    completed: true,
    completedAt: task!.completedAt!.toISOString(),
  };
}

/**
 * Reopen a completed native task (uncheck).
 */
export async function uncompleteNativeTask(
  taskId: string,
  userId: string
): Promise<{ id: string; completed: boolean; completedAt: null; isLocalOverride: false }> {
  const item = await prisma.nativeTask.findFirst({
    where: { id: taskId, userId },
  });
  if (!item) {
    throw new Error('Task not found');
  }
  if (!item.completed) {
    throw new Error('Task is not completed');
  }

  await prisma.nativeTask.update({
    where: { id: taskId },
    data: { completed: false, completedAt: null },
  });

  return {
    id: `native:${taskId}`,
    completed: false,
    completedAt: null,
    isLocalOverride: false,
  };
}

/**
 * Reopen a completed sync-sourced task (uncheck).
 * Creates a SyncOverride(REOPENED) to preserve the user's intent across future sync cycles.
 */
export async function uncompleteSyncItem(
  itemId: string,
  userId: string
): Promise<{ id: string; completed: boolean; completedAt: null; isLocalOverride: true }> {
  const item = await prisma.syncCacheItem.findFirst({
    where: { id: itemId, userId },
    include: { integration: { select: { serviceId: true } } },
  });
  if (!item) {
    throw new Error('Item not found');
  }
  if (!item.completedInOrdrctrl) {
    throw new Error('Item is not completed');
  }

  await prisma.syncCacheItem.update({
    where: { id: itemId },
    data: { completedInOrdrctrl: false, completedAt: null },
  });

  // Upsert SyncOverride so re-calling this is idempotent
  await prisma.syncOverride.upsert({
    where: {
      syncCacheItemId_overrideType: {
        syncCacheItemId: itemId,
        overrideType: 'REOPENED',
      },
    },
    create: { userId, syncCacheItemId: itemId, overrideType: 'REOPENED' },
    update: { createdAt: new Date() },
  });

  return {
    id: `sync:${itemId}`,
    completed: false,
    completedAt: null,
    isLocalOverride: true,
  };
}

// ─── Clear Completed ─────────────────────────────────────────────────────────

/**
 * Bulk-clear all completed items for a user by dismissing them.
 * Eligible sync items: completedInOrdrctrl=true, no DISMISSED or REOPENED override.
 * Eligible native tasks: completed=true, dismissed=false.
 * Returns the total number of items cleared.
 */
export async function clearCompletedItems(
  userId: string
): Promise<{ clearedCount: number }> {
  // Find eligible sync items (completed, not already dismissed/reopened)
  const eligibleSync = await prisma.syncCacheItem.findMany({
    where: {
      userId,
      completedInOrdrctrl: true,
      syncOverrides: {
        none: { overrideType: { in: ['DISMISSED', 'REOPENED'] } },
      },
    },
    select: { id: true },
  });

  // Find eligible native tasks (completed, not dismissed)
  const eligibleNative = await prisma.nativeTask.findMany({
    where: { userId, completed: true, dismissed: false },
    select: { id: true },
  });

  let clearedCount = 0;

  if (eligibleSync.length > 0) {
    await prisma.syncOverride.createMany({
      data: eligibleSync.map((item) => ({
        userId,
        syncCacheItemId: item.id,
        overrideType: 'DISMISSED' as const,
      })),
      skipDuplicates: true,
    });
    clearedCount += eligibleSync.length;
  }

  if (eligibleNative.length > 0) {
    await prisma.nativeTask.updateMany({
      where: { id: { in: eligibleNative.map((t) => t.id) } },
      data: { dismissed: true },
    });
    clearedCount += eligibleNative.length;
  }

  return { clearedCount };
}

// ─── Dismiss / Restore ───────────────────────────────────────────────────────

export interface DismissedItem {
  id: string;           // "sync:<uuid>" | "native:<uuid>"
  title: string;
  source: string;
  itemType: 'sync' | 'native';
  dismissedAt: string;  // ISO string
}

/**
 * T021 — Auto-clear expired completed items for a user.
 * Fires during post-sync hook; only runs if autoClearEnabled=true in user settings.
 * Items completed more than autoClearWindowDays ago are dismissed.
 */
export async function clearExpiredCompleted(
  userId: string,
  autoClearWindowDays: number
): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - autoClearWindowDays);

  // Sync items: completed, not already dismissed/reopened, completedAt before cutoff
  const expiredSync = await prisma.syncCacheItem.findMany({
    where: {
      userId,
      completedAt: { not: null, lte: cutoff },
      syncOverrides: {
        none: { overrideType: { in: ['DISMISSED', 'REOPENED'] } },
      },
    },
    select: { id: true },
  });

  let count = 0;
  if (expiredSync.length > 0) {
    await prisma.syncOverride.createMany({
      data: expiredSync.map((item) => ({
        userId,
        syncCacheItemId: item.id,
        overrideType: 'DISMISSED' as const,
      })),
      skipDuplicates: true,
    });
    count += expiredSync.length;
  }

  // Native tasks: completed=true, dismissed=false, completedAt before cutoff
  const nativeResult = await prisma.nativeTask.updateMany({
    where: {
      userId,
      completed: true,
      dismissed: false,
      completedAt: { not: null, lte: cutoff },
    },
    data: { dismissed: true },
  });
  count += nativeResult.count;

  return count;
}

/**
 * T006 — Dismiss a feed item for the authenticated user.
 * - sync items: upsert a SyncOverride(DISMISSED)
 * - native items: set dismissed = true on NativeTask
 */
export async function dismissFeedItem(userId: string, itemId: string): Promise<void> {
  const [type, rawId] = itemId.split(':');

  if (type === 'sync') {
    const item = await prisma.syncCacheItem.findFirst({ where: { id: rawId, userId } });
    if (!item) throw Object.assign(new Error('Item not found'), { code: 'ITEM_NOT_FOUND' });

    await prisma.syncOverride.upsert({
      where: {
        syncCacheItemId_overrideType: {
          syncCacheItemId: rawId,
          overrideType: 'DISMISSED',
        },
      },
      create: { userId, syncCacheItemId: rawId, overrideType: 'DISMISSED' },
      update: {},
    });
  } else {
    // native
    const item = await prisma.nativeTask.findFirst({ where: { id: rawId, userId } });
    if (!item) throw Object.assign(new Error('Item not found'), { code: 'ITEM_NOT_FOUND' });
    if (item.dismissed) throw Object.assign(new Error('Item is already dismissed'), { code: 'ALREADY_DISMISSED' });

    await prisma.nativeTask.update({ where: { id: rawId }, data: { dismissed: true } });
  }
}

/**
 * T013 — Restore a dismissed feed item (undo).
 * - sync items: delete the SyncOverride(DISMISSED)
 * - native items: set dismissed = false on NativeTask
 */
export async function restoreFeedItem(userId: string, itemId: string): Promise<void> {
  const [type, rawId] = itemId.split(':');

  if (type === 'sync') {
    const item = await prisma.syncCacheItem.findFirst({ where: { id: rawId, userId } });
    if (!item) throw Object.assign(new Error('Item not found'), { code: 'ITEM_NOT_FOUND' });

    const override = await prisma.syncOverride.findUnique({
      where: {
        syncCacheItemId_overrideType: {
          syncCacheItemId: rawId,
          overrideType: 'DISMISSED',
        },
      },
    });
    if (!override) throw Object.assign(new Error('Item is not dismissed'), { code: 'NOT_DISMISSED' });

    await prisma.syncOverride.delete({
      where: {
        syncCacheItemId_overrideType: {
          syncCacheItemId: rawId,
          overrideType: 'DISMISSED',
        },
      },
    });
  } else {
    // native
    const item = await prisma.nativeTask.findFirst({ where: { id: rawId, userId } });
    if (!item) throw Object.assign(new Error('Item not found'), { code: 'ITEM_NOT_FOUND' });
    if (!item.dismissed) throw Object.assign(new Error('Item is not dismissed'), { code: 'NOT_DISMISSED' });

    await prisma.nativeTask.update({ where: { id: rawId }, data: { dismissed: false } });
  }
}

/**
 * T019 — Get paginated list of dismissed items for a user.
 * Merges dismissed sync items + dismissed native tasks, sorted by dismissedAt desc.
 */
export async function getDismissedItems(
  userId: string,
  limit: number,
  cursor?: string
): Promise<{ items: DismissedItem[]; nextCursor: string | null; hasMore: boolean }> {
  // Decode cursor (createdAt ISO + id for tiebreaking)
  let cursorDate: Date | undefined;
  let cursorId: string | undefined;
  if (cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
      cursorDate = new Date(decoded.at);
      cursorId = decoded.id;
    } catch {
      throw Object.assign(new Error('Invalid cursor'), { code: 'INVALID_CURSOR' });
    }
  }

  // Dismissed sync overrides
  const dismissedOverrides = await prisma.syncOverride.findMany({
    where: {
      userId,
      overrideType: 'DISMISSED',
      ...(cursorDate
        ? {
            OR: [
              { createdAt: { lt: cursorDate } },
              { createdAt: cursorDate, id: { gt: cursorId! } },
            ],
          }
        : {}),
    },
    include: {
      syncCacheItem: {
        include: {
          integration: { select: { serviceId: true } },
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    take: limit + 1,
  });

  // Dismissed native tasks
  const dismissedNative = await prisma.nativeTask.findMany({
    where: {
      userId,
      dismissed: true,
      ...(cursorDate
        ? {
            OR: [
              { updatedAt: { lt: cursorDate } },
              { updatedAt: cursorDate, id: { gt: cursorId! } },
            ],
          }
        : {}),
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    take: limit + 1,
  });

  // Map to unified shape
  const syncItems: DismissedItem[] = dismissedOverrides.map((o) => ({
    id: `sync:${o.syncCacheItemId}`,
    title: o.syncCacheItem.title,
    source: o.syncCacheItem.integration.serviceId,
    itemType: 'sync' as const,
    dismissedAt: o.createdAt.toISOString(),
  }));

  const nativeItems: DismissedItem[] = dismissedNative.map((t) => ({
    id: `native:${t.id}`,
    title: t.title,
    source: 'ordrctrl',
    itemType: 'native' as const,
    dismissedAt: t.updatedAt.toISOString(),
  }));

  // Merge + sort by dismissedAt desc, take limit+1 to detect hasMore
  const merged = [...syncItems, ...nativeItems]
    .sort((a, b) => new Date(b.dismissedAt).getTime() - new Date(a.dismissedAt).getTime())
    .slice(0, limit + 1);

  const hasMore = merged.length > limit;
  const page = merged.slice(0, limit);

  const lastItem = page[page.length - 1];
  const nextCursor = hasMore && lastItem
    ? Buffer.from(JSON.stringify({ at: lastItem.dismissedAt, id: lastItem.id })).toString('base64')
    : null;

  return { items: page, nextCursor, hasMore };
}

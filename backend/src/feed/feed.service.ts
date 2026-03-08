// T049 — FeedService
// Merge SyncCacheItem[] + NativeTask[] into FeedItem[], apply ordering rules,
// apply duplicate detection (case-insensitive title match across sources).

import { prisma } from '../lib/db.js';
import { getCacheItemsForUser } from '../sync/cache.service.js';
import type { ServiceId } from '../integrations/_adapter/types.js';
import { SERVICE_DISPLAY_NAMES } from '../integrations/_adapter/types.js';

export interface FeedItem {
  id: string;                       // "sync:<uuid>" | "native:<uuid>"
  source: string;                   // "Gmail", "Apple Reminders", etc.
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

/**
 * Build the consolidated feed for a user.
 */
export async function buildFeed(
  userId: string,
  includeCompleted = false
): Promise<FeedResult> {
  // Fetch sync cache items
  const cacheItems = await getCacheItemsForUser(userId);

  // Fetch native tasks
  const nativeTasks = await prisma.nativeTask.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });

  // Map sync cache items to FeedItem
  const syncFeedItems: FeedItem[] = cacheItems.map((item) => ({
    id: `sync:${item.id}`,
    source: SERVICE_DISPLAY_NAMES[item.integration.serviceId as ServiceId] ?? item.integration.serviceId,
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
    'apple_reminders',
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

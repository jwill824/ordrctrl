// T068 — Unit tests for FeedService
// Ordering rules, duplicate detection, completed separation, uncomplete logic

import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the pure logic functions extracted from feed.service.ts
// The full service uses Prisma, so we'll test the sorting/dedup logic directly.

type ItemType = 'task' | 'event' | 'message';

interface MockFeedItem {
  id: string;
  source: string;
  itemType: ItemType;
  title: string;
  dueAt: string | null;
  startAt: string | null;
  endAt: string | null;
  completed: boolean;
  completedAt: string | null;
  isDuplicateSuspect: boolean;
}

// Extracted sorting logic (mirrors feed.service.ts sortFeedItems)
function sortFeedItems(items: MockFeedItem[]): MockFeedItem[] {
  const dated = items.filter((i) => i.dueAt !== null || i.startAt !== null);
  const undated = items.filter((i) => i.dueAt === null && i.startAt === null);

  dated.sort((a, b) => {
    const aTime = new Date(a.dueAt ?? a.startAt!).getTime();
    const bTime = new Date(b.dueAt ?? b.startAt!).getTime();
    return aTime - bTime;
  });

  return [...dated, ...undated];
}

// Extracted duplicate detection logic
function detectDuplicates(items: MockFeedItem[]): MockFeedItem[] {
  const titleSourceMap = new Map<string, Set<string>>();
  for (const item of items) {
    const key = item.title.trim().toLowerCase();
    if (!titleSourceMap.has(key)) titleSourceMap.set(key, new Set());
    titleSourceMap.get(key)!.add(item.source);
  }

  return items.map((item) => ({
    ...item,
    isDuplicateSuspect: titleSourceMap.get(item.title.trim().toLowerCase())!.size > 1,
  }));
}

describe('FeedService — ordering rules', () => {
  it('sorts dated items ascending by dueAt', () => {
    const items: MockFeedItem[] = [
      { id: '1', source: 'Gmail', itemType: 'task', title: 'C', dueAt: '2026-03-10T00:00:00Z', startAt: null, endAt: null, completed: false, completedAt: null, isDuplicateSuspect: false },
      { id: '2', source: 'Gmail', itemType: 'task', title: 'A', dueAt: '2026-03-05T00:00:00Z', startAt: null, endAt: null, completed: false, completedAt: null, isDuplicateSuspect: false },
      { id: '3', source: 'Gmail', itemType: 'task', title: 'B', dueAt: '2026-03-07T00:00:00Z', startAt: null, endAt: null, completed: false, completedAt: null, isDuplicateSuspect: false },
    ];

    const sorted = sortFeedItems(items);
    expect(sorted.map((i) => i.id)).toEqual(['2', '3', '1']);
  });

  it('places undated items after dated items', () => {
    const items: MockFeedItem[] = [
      { id: 'undated', source: 'ordrctrl', itemType: 'task', title: 'No date', dueAt: null, startAt: null, endAt: null, completed: false, completedAt: null, isDuplicateSuspect: false },
      { id: 'dated', source: 'Gmail', itemType: 'task', title: 'Has date', dueAt: '2026-03-08T00:00:00Z', startAt: null, endAt: null, completed: false, completedAt: null, isDuplicateSuspect: false },
    ];

    const sorted = sortFeedItems(items);
    expect(sorted[0].id).toBe('dated');
    expect(sorted[1].id).toBe('undated');
  });

  it('sorts calendar events by startAt', () => {
    const items: MockFeedItem[] = [
      { id: 'e2', source: 'Apple Calendar', itemType: 'event', title: 'Later', dueAt: null, startAt: '2026-03-08T15:00:00Z', endAt: null, completed: false, completedAt: null, isDuplicateSuspect: false },
      { id: 'e1', source: 'Apple Calendar', itemType: 'event', title: 'Earlier', dueAt: null, startAt: '2026-03-08T09:00:00Z', endAt: null, completed: false, completedAt: null, isDuplicateSuspect: false },
    ];

    const sorted = sortFeedItems(items);
    expect(sorted[0].id).toBe('e1');
    expect(sorted[1].id).toBe('e2');
  });

  it('handles empty items array', () => {
    expect(sortFeedItems([])).toEqual([]);
  });
});

describe('FeedService — duplicate detection', () => {
  it('flags items with matching titles from different sources', () => {
    const items: MockFeedItem[] = [
      { id: '1', source: 'Gmail', itemType: 'task', title: 'Call dentist', dueAt: null, startAt: null, endAt: null, completed: false, completedAt: null, isDuplicateSuspect: false },
      { id: '2', source: 'Apple Reminders', itemType: 'task', title: 'Call dentist', dueAt: null, startAt: null, endAt: null, completed: false, completedAt: null, isDuplicateSuspect: false },
    ];

    const result = detectDuplicates(items);
    expect(result[0].isDuplicateSuspect).toBe(true);
    expect(result[1].isDuplicateSuspect).toBe(true);
  });

  it('does NOT flag identical titles from the same source', () => {
    const items: MockFeedItem[] = [
      { id: '1', source: 'Gmail', itemType: 'task', title: 'Same title', dueAt: null, startAt: null, endAt: null, completed: false, completedAt: null, isDuplicateSuspect: false },
      { id: '2', source: 'Gmail', itemType: 'task', title: 'Same title', dueAt: null, startAt: null, endAt: null, completed: false, completedAt: null, isDuplicateSuspect: false },
    ];

    const result = detectDuplicates(items);
    expect(result[0].isDuplicateSuspect).toBe(false);
    expect(result[1].isDuplicateSuspect).toBe(false);
  });

  it('performs case-insensitive title comparison', () => {
    const items: MockFeedItem[] = [
      { id: '1', source: 'Gmail', itemType: 'task', title: 'CALL DENTIST', dueAt: null, startAt: null, endAt: null, completed: false, completedAt: null, isDuplicateSuspect: false },
      { id: '2', source: 'Apple Reminders', itemType: 'task', title: 'call dentist', dueAt: null, startAt: null, endAt: null, completed: false, completedAt: null, isDuplicateSuspect: false },
    ];

    const result = detectDuplicates(items);
    expect(result[0].isDuplicateSuspect).toBe(true);
    expect(result[1].isDuplicateSuspect).toBe(true);
  });

  it('does not flag unique titles', () => {
    const items: MockFeedItem[] = [
      { id: '1', source: 'Gmail', itemType: 'task', title: 'Task A', dueAt: null, startAt: null, endAt: null, completed: false, completedAt: null, isDuplicateSuspect: false },
      { id: '2', source: 'Apple Reminders', itemType: 'task', title: 'Task B', dueAt: null, startAt: null, endAt: null, completed: false, completedAt: null, isDuplicateSuspect: false },
    ];

    const result = detectDuplicates(items);
    expect(result[0].isDuplicateSuspect).toBe(false);
    expect(result[1].isDuplicateSuspect).toBe(false);
  });
});

describe('FeedService — completed separation', () => {
  it('separates active and completed items', () => {
    const allItems: MockFeedItem[] = [
      { id: '1', source: 'ordrctrl', itemType: 'task', title: 'Active', dueAt: null, startAt: null, endAt: null, completed: false, completedAt: null, isDuplicateSuspect: false },
      { id: '2', source: 'ordrctrl', itemType: 'task', title: 'Done', dueAt: null, startAt: null, endAt: null, completed: true, completedAt: '2026-03-05T10:00:00Z', isDuplicateSuspect: false },
    ];

    const active = allItems.filter((i) => !i.completed);
    const completed = allItems.filter((i) => i.completed);

    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('1');
    expect(completed).toHaveLength(1);
    expect(completed[0].id).toBe('2');
  });

  it('sorts completed items by completedAt descending', () => {
    const completed: MockFeedItem[] = [
      { id: 'older', source: 'ordrctrl', itemType: 'task', title: 'Older', dueAt: null, startAt: null, endAt: null, completed: true, completedAt: '2026-03-03T10:00:00Z', isDuplicateSuspect: false },
      { id: 'newer', source: 'ordrctrl', itemType: 'task', title: 'Newer', dueAt: null, startAt: null, endAt: null, completed: true, completedAt: '2026-03-05T10:00:00Z', isDuplicateSuspect: false },
    ];

    completed.sort((a, b) => {
      const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return bTime - aTime;
    });

    expect(completed[0].id).toBe('newer');
    expect(completed[1].id).toBe('older');
  });
});

// ---------------------------------------------------------------------------
// T018 — Unit tests for uncomplete logic
// Using vi.mock to isolate Prisma interactions
// ---------------------------------------------------------------------------

vi.mock('../../src/lib/db.js', () => ({
  prisma: {
    nativeTask: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    syncCacheItem: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    syncOverride: {
      upsert: vi.fn(),
    },
  },
}));

import { prisma } from '../../src/lib/db.js';
import { uncompleteNativeTask, uncompleteSyncItem } from '../../src/feed/feed.service.js';

const mockPrisma = prisma as unknown as {
  nativeTask: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  syncCacheItem: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  syncOverride: { upsert: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('uncompleteNativeTask()', () => {
  it('returns uncompleted feed item on success', async () => {
    mockPrisma.nativeTask.findFirst.mockResolvedValue({ id: 'task-1', userId: 'user-1', completed: true, completedAt: new Date() });
    mockPrisma.nativeTask.update.mockResolvedValue({ id: 'task-1', title: 'My task', dueAt: null, completed: false, completedAt: null });

    const result = await uncompleteNativeTask('task-1', 'user-1');

    expect(result.id).toBe('native:task-1');
    expect(result.completed).toBe(false);
    expect(result.completedAt).toBeNull();
    expect(result.isLocalOverride).toBe(false);
  });

  it('throws when task not found', async () => {
    mockPrisma.nativeTask.findFirst.mockResolvedValue(null);

    await expect(uncompleteNativeTask('missing', 'user-1')).rejects.toThrow('Task not found');
  });

  it('throws when task is already open', async () => {
    mockPrisma.nativeTask.findFirst.mockResolvedValue({ id: 'task-1', userId: 'user-1', completed: false, completedAt: null });

    await expect(uncompleteNativeTask('task-1', 'user-1')).rejects.toThrow('Task is not completed');
  });
});

describe('uncompleteSyncItem()', () => {
  it('returns uncompleted feed item with isLocalOverride=true on success', async () => {
    mockPrisma.syncCacheItem.findFirst.mockResolvedValue({
      id: 'item-1', userId: 'user-1', completedInOrdrctrl: true,
      integration: { serviceId: 'gmail' },
    });
    mockPrisma.syncCacheItem.update.mockResolvedValue({});
    mockPrisma.syncOverride.upsert.mockResolvedValue({});

    const result = await uncompleteSyncItem('item-1', 'user-1');

    expect(result.id).toBe('sync:item-1');
    expect(result.completed).toBe(false);
    expect(result.completedAt).toBeNull();
    expect(result.isLocalOverride).toBe(true);
  });

  it('creates a SyncOverride(REOPENED) record', async () => {
    mockPrisma.syncCacheItem.findFirst.mockResolvedValue({
      id: 'item-1', userId: 'user-1', completedInOrdrctrl: true,
      integration: { serviceId: 'gmail' },
    });
    mockPrisma.syncCacheItem.update.mockResolvedValue({});
    mockPrisma.syncOverride.upsert.mockResolvedValue({});

    await uncompleteSyncItem('item-1', 'user-1');

    expect(mockPrisma.syncOverride.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { syncCacheItemId_overrideType: { syncCacheItemId: 'item-1', overrideType: 'REOPENED' } },
        create: expect.objectContaining({ overrideType: 'REOPENED' }),
      })
    );
  });

  it('throws when item not found', async () => {
    mockPrisma.syncCacheItem.findFirst.mockResolvedValue(null);

    await expect(uncompleteSyncItem('missing', 'user-1')).rejects.toThrow('Item not found');
  });

  it('throws when item is already open', async () => {
    mockPrisma.syncCacheItem.findFirst.mockResolvedValue({
      id: 'item-1', userId: 'user-1', completedInOrdrctrl: false,
      integration: { serviceId: 'gmail' },
    });

    await expect(uncompleteSyncItem('item-1', 'user-1')).rejects.toThrow('Item is not completed');
  });
});

// ---------------------------------------------------------------------------
// T025/T026/T027 — Unit tests for dismissFeedItem, restoreFeedItem, buildFeed filter
// ---------------------------------------------------------------------------

// Extend mock to cover dismiss/restore operations
vi.mock('../../src/sync/cache.service.js', () => ({
  getCacheItemsForUser: vi.fn().mockResolvedValue([]),
}));

import { dismissFeedItem, restoreFeedItem } from '../../src/feed/feed.service.js';

// Extend mockPrisma with dismiss-related methods
const mockPrismaExtended = prisma as unknown as {
  nativeTask: {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  syncCacheItem: {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  syncOverride: {
    upsert: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  integration: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

// Patch the vi.mock to include additional methods (vitest hoists, so we extend mockPrisma manually)
beforeEach(() => {
  const p = prisma as Record<string, unknown>;
  // Ensure all needed mocks exist
  const so = p['syncOverride'] as Record<string, unknown>;
  if (!so['findUnique']) so['findUnique'] = vi.fn();
  if (!so['delete']) so['delete'] = vi.fn();
  if (!so['findMany']) so['findMany'] = vi.fn();
  if (!so['deleteMany']) so['deleteMany'] = vi.fn();
  const nt = p['nativeTask'] as Record<string, unknown>;
  if (!nt['findMany']) nt['findMany'] = vi.fn();
  const sc = p['syncCacheItem'] as Record<string, unknown>;
  if (!sc['findMany']) sc['findMany'] = vi.fn();
  const integ = p as Record<string, unknown>;
  if (!integ['integration']) (integ['integration'] as Record<string, unknown>) = { findMany: vi.fn() };
});

// T025 — dismissFeedItem()
describe('dismissFeedItem()', () => {
  it('creates DISMISSED SyncOverride for sync items', async () => {
    mockPrismaExtended.syncCacheItem.findFirst.mockResolvedValue({ id: 'item-1', userId: 'user-1' });
    mockPrismaExtended.syncOverride.upsert.mockResolvedValue({});

    await dismissFeedItem('user-1', 'sync:item-1');

    expect(mockPrismaExtended.syncOverride.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { syncCacheItemId_overrideType: { syncCacheItemId: 'item-1', overrideType: 'DISMISSED' } },
        create: expect.objectContaining({ overrideType: 'DISMISSED' }),
      })
    );
  });

  it('sets dismissed=true for native items', async () => {
    mockPrismaExtended.nativeTask.findFirst.mockResolvedValue({ id: 'task-1', userId: 'user-1', dismissed: false });
    mockPrismaExtended.nativeTask.update.mockResolvedValue({});

    await dismissFeedItem('user-1', 'native:task-1');

    expect(mockPrismaExtended.nativeTask.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'task-1' }, data: { dismissed: true } })
    );
  });

  it('throws ITEM_NOT_FOUND when sync item does not exist', async () => {
    mockPrismaExtended.syncCacheItem.findFirst.mockResolvedValue(null);

    await expect(dismissFeedItem('user-1', 'sync:missing')).rejects.toMatchObject({ code: 'ITEM_NOT_FOUND' });
  });

  it('throws ALREADY_DISMISSED when native item is already dismissed', async () => {
    mockPrismaExtended.nativeTask.findFirst.mockResolvedValue({ id: 'task-1', userId: 'user-1', dismissed: true });

    await expect(dismissFeedItem('user-1', 'native:task-1')).rejects.toMatchObject({ code: 'ALREADY_DISMISSED' });
  });

  it('is idempotent for sync items (upsert does not throw on duplicate)', async () => {
    mockPrismaExtended.syncCacheItem.findFirst.mockResolvedValue({ id: 'item-1', userId: 'user-1' });
    mockPrismaExtended.syncOverride.upsert.mockResolvedValue({});

    // calling twice should not throw
    await dismissFeedItem('user-1', 'sync:item-1');
    await dismissFeedItem('user-1', 'sync:item-1');
    expect(mockPrismaExtended.syncOverride.upsert).toHaveBeenCalledTimes(2);
  });
});

// T026 — restoreFeedItem()
describe('restoreFeedItem()', () => {
  it('deletes DISMISSED SyncOverride for sync items', async () => {
    mockPrismaExtended.syncCacheItem.findFirst.mockResolvedValue({ id: 'item-1', userId: 'user-1' });
    mockPrismaExtended.syncOverride.findUnique.mockResolvedValue({ id: 'override-1' });
    mockPrismaExtended.syncOverride.delete.mockResolvedValue({});

    await restoreFeedItem('user-1', 'sync:item-1');

    expect(mockPrismaExtended.syncOverride.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { syncCacheItemId_overrideType: { syncCacheItemId: 'item-1', overrideType: 'DISMISSED' } },
      })
    );
  });

  it('sets dismissed=false for native items', async () => {
    mockPrismaExtended.nativeTask.findFirst.mockResolvedValue({ id: 'task-1', userId: 'user-1', dismissed: true });
    mockPrismaExtended.nativeTask.update.mockResolvedValue({});

    await restoreFeedItem('user-1', 'native:task-1');

    expect(mockPrismaExtended.nativeTask.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'task-1' }, data: { dismissed: false } })
    );
  });

  it('throws ITEM_NOT_FOUND when sync item does not exist', async () => {
    mockPrismaExtended.syncCacheItem.findFirst.mockResolvedValue(null);

    await expect(restoreFeedItem('user-1', 'sync:missing')).rejects.toMatchObject({ code: 'ITEM_NOT_FOUND' });
  });

  it('throws NOT_DISMISSED when sync item has no DISMISSED override', async () => {
    mockPrismaExtended.syncCacheItem.findFirst.mockResolvedValue({ id: 'item-1', userId: 'user-1' });
    mockPrismaExtended.syncOverride.findUnique.mockResolvedValue(null);

    await expect(restoreFeedItem('user-1', 'sync:item-1')).rejects.toMatchObject({ code: 'NOT_DISMISSED' });
  });

  it('throws NOT_DISMISSED when native item is not dismissed', async () => {
    mockPrismaExtended.nativeTask.findFirst.mockResolvedValue({ id: 'task-1', userId: 'user-1', dismissed: false });

    await expect(restoreFeedItem('user-1', 'native:task-1')).rejects.toMatchObject({ code: 'NOT_DISMISSED' });
  });
});

// T027 — buildFeed() dismissal filter (integration-level: mock both prisma + cache)
// Note: buildFeed() is Prisma-heavy; we test that getCacheItemsForUser receives excludeIds
// and that native tasks with dismissed=true are filtered out via the query.
describe('buildFeed() — dismissed items excluded', () => {
  it('passes dismissed sync IDs to getCacheItemsForUser', async () => {
    const { getCacheItemsForUser } = await import('../../src/sync/cache.service.js');
    const mockGet = getCacheItemsForUser as ReturnType<typeof vi.fn>;

    mockPrismaExtended.syncOverride.findMany.mockResolvedValue([
      { syncCacheItemId: 'dismissed-sync-1' },
    ]);
    mockGet.mockResolvedValue([]);
    mockPrismaExtended.nativeTask.findMany.mockResolvedValue([]);
    mockPrismaExtended.integration = { findMany: vi.fn().mockResolvedValue([]) } as unknown as typeof mockPrismaExtended.integration;

    const { buildFeed } = await import('../../src/feed/feed.service.js');
    await buildFeed('user-1');

    expect(mockGet).toHaveBeenCalledWith('user-1', ['dismissed-sync-1']);
  });

  it('queries native tasks with dismissed: false', async () => {
    mockPrismaExtended.syncOverride.findMany.mockResolvedValue([]);
    const { getCacheItemsForUser } = await import('../../src/sync/cache.service.js');
    (getCacheItemsForUser as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    mockPrismaExtended.nativeTask.findMany.mockResolvedValue([]);
    mockPrismaExtended.integration = { findMany: vi.fn().mockResolvedValue([]) } as unknown as typeof mockPrismaExtended.integration;

    const { buildFeed } = await import('../../src/feed/feed.service.js');
    await buildFeed('user-1');

    expect(mockPrismaExtended.nativeTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ dismissed: false }) })
    );
  });
});

// T006 — Unit tests for clearCompletedItems()
import { clearCompletedItems } from '../../src/feed/feed.service.js';

describe('clearCompletedItems()', () => {
  beforeEach(() => {
    // Ensure bulk-operation mocks exist
    const p = prisma as Record<string, Record<string, unknown>>;
    if (!p['syncCacheItem']['findMany']) {
      p['syncCacheItem']['findMany'] = vi.fn();
    }
    if (!p['nativeTask']['findMany']) {
      p['nativeTask']['findMany'] = vi.fn();
    }
    if (!p['syncOverride']['createMany']) {
      p['syncOverride']['createMany'] = vi.fn();
    }
    if (!p['nativeTask']['updateMany']) {
      p['nativeTask']['updateMany'] = vi.fn();
    }
  });

  it('bulk-creates DISMISSED overrides for eligible sync items', async () => {
    mockPrismaExtended.syncCacheItem.findMany.mockResolvedValue([
      { id: 'sync-1' },
      { id: 'sync-2' },
    ]);
    mockPrismaExtended.nativeTask.findMany.mockResolvedValue([]);
    const p = prisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
    p['syncOverride']['createMany'] = vi.fn().mockResolvedValue({ count: 2 });

    const result = await clearCompletedItems('user-1');

    expect(p['syncOverride']['createMany']).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
        data: expect.arrayContaining([
          expect.objectContaining({ syncCacheItemId: 'sync-1', overrideType: 'DISMISSED' }),
          expect.objectContaining({ syncCacheItemId: 'sync-2', overrideType: 'DISMISSED' }),
        ]),
      })
    );
    expect(result.clearedCount).toBe(2);
  });

  it('bulk-updates dismissed=true for eligible native tasks', async () => {
    mockPrismaExtended.syncCacheItem.findMany.mockResolvedValue([]);
    mockPrismaExtended.nativeTask.findMany.mockResolvedValue([
      { id: 'task-1' },
      { id: 'task-2' },
    ]);
    const p = prisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
    p['nativeTask']['updateMany'] = vi.fn().mockResolvedValue({ count: 2 });

    const result = await clearCompletedItems('user-1');

    expect(p['nativeTask']['updateMany']).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['task-1', 'task-2'] } },
        data: { dismissed: true },
      })
    );
    expect(result.clearedCount).toBe(2);
  });

  it('excludes sync items with DISMISSED or REOPENED override from query', async () => {
    mockPrismaExtended.syncCacheItem.findMany.mockResolvedValue([]);
    mockPrismaExtended.nativeTask.findMany.mockResolvedValue([]);

    await clearCompletedItems('user-1');

    expect(mockPrismaExtended.syncCacheItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          completedInOrdrctrl: true,
          syncOverrides: {
            none: { overrideType: { in: ['DISMISSED', 'REOPENED'] } },
          },
        }),
      })
    );
  });

  it('excludes already-dismissed native tasks from query', async () => {
    mockPrismaExtended.syncCacheItem.findMany.mockResolvedValue([]);
    mockPrismaExtended.nativeTask.findMany.mockResolvedValue([]);

    await clearCompletedItems('user-1');

    expect(mockPrismaExtended.nativeTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ completed: true, dismissed: false }),
      })
    );
  });

  it('returns clearedCount=0 when nothing is eligible', async () => {
    mockPrismaExtended.syncCacheItem.findMany.mockResolvedValue([]);
    mockPrismaExtended.nativeTask.findMany.mockResolvedValue([]);

    const result = await clearCompletedItems('user-1');

    expect(result.clearedCount).toBe(0);
  });

  it('returns combined count for both sync and native items', async () => {
    mockPrismaExtended.syncCacheItem.findMany.mockResolvedValue([{ id: 'sync-1' }]);
    mockPrismaExtended.nativeTask.findMany.mockResolvedValue([{ id: 'task-1' }, { id: 'task-2' }]);
    const p = prisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
    p['syncOverride']['createMany'] = vi.fn().mockResolvedValue({ count: 1 });
    p['nativeTask']['updateMany'] = vi.fn().mockResolvedValue({ count: 2 });

    const result = await clearCompletedItems('user-1');

    expect(result.clearedCount).toBe(3);
  });
});

// ─── T019 + T029 — permanentDeleteFeedItem() and setUserDueAt() ───────────────

import { permanentDeleteFeedItem, setUserDueAt } from '../../src/feed/feed.service.js';

describe('permanentDeleteFeedItem()', () => {
  beforeEach(() => {
    const p = prisma as Record<string, unknown>;
    const sc = p['syncCacheItem'] as Record<string, unknown>;
    if (!sc['delete']) sc['delete'] = vi.fn();
    const nt = p['nativeTask'] as Record<string, unknown>;
    if (!nt['delete']) nt['delete'] = vi.fn();
  });

  it('hard-deletes a dismissed sync item', async () => {
    mockPrismaExtended.syncCacheItem.findFirst.mockResolvedValue({ id: 'item-1', userId: 'user-1' });
    mockPrismaExtended.syncOverride.findUnique.mockResolvedValue({ id: 'override-1', overrideType: 'DISMISSED' });
    const p = prisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
    p['syncCacheItem']['delete'] = vi.fn().mockResolvedValue({});

    await permanentDeleteFeedItem('user-1', 'sync:item-1');

    expect(p['syncCacheItem']['delete']).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'item-1' } })
    );
  });

  it('throws ITEM_NOT_FOUND when sync item does not exist', async () => {
    mockPrismaExtended.syncCacheItem.findFirst.mockResolvedValue(null);

    await expect(permanentDeleteFeedItem('user-1', 'sync:missing')).rejects.toMatchObject({
      code: 'ITEM_NOT_FOUND',
    });
  });

  it('throws NOT_DISMISSED when sync item has no DISMISSED override', async () => {
    mockPrismaExtended.syncCacheItem.findFirst.mockResolvedValue({ id: 'item-1', userId: 'user-1' });
    mockPrismaExtended.syncOverride.findUnique.mockResolvedValue(null);

    await expect(permanentDeleteFeedItem('user-1', 'sync:item-1')).rejects.toMatchObject({
      code: 'NOT_DISMISSED',
    });
  });

  it('hard-deletes a dismissed native task', async () => {
    mockPrismaExtended.nativeTask.findFirst.mockResolvedValue({ id: 'task-1', userId: 'user-1', dismissed: true });
    const p = prisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
    p['nativeTask']['delete'] = vi.fn().mockResolvedValue({});

    await permanentDeleteFeedItem('user-1', 'native:task-1');

    expect(p['nativeTask']['delete']).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'task-1' } })
    );
  });

  it('throws NOT_DISMISSED when native task is not dismissed', async () => {
    mockPrismaExtended.nativeTask.findFirst.mockResolvedValue({ id: 'task-1', userId: 'user-1', dismissed: false });

    await expect(permanentDeleteFeedItem('user-1', 'native:task-1')).rejects.toMatchObject({
      code: 'NOT_DISMISSED',
    });
  });

  it('throws ITEM_NOT_FOUND when native task does not exist', async () => {
    mockPrismaExtended.nativeTask.findFirst.mockResolvedValue(null);

    await expect(permanentDeleteFeedItem('user-1', 'native:missing')).rejects.toMatchObject({
      code: 'ITEM_NOT_FOUND',
    });
  });
});

describe('setUserDueAt()', () => {
  beforeEach(() => {
    const p = prisma as Record<string, unknown>;
    const sc = p['syncCacheItem'] as Record<string, unknown>;
    if (!sc['update']) sc['update'] = vi.fn();
  });

  it('sets userDueAt on the sync cache item', async () => {
    mockPrismaExtended.syncCacheItem.findFirst.mockResolvedValue({ id: 'item-1', userId: 'user-1' });
    const p = prisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
    p['syncCacheItem']['update'] = vi.fn().mockResolvedValue({});
    const due = new Date('2027-01-15T12:00:00Z');

    await setUserDueAt('user-1', 'item-1', due);

    expect(p['syncCacheItem']['update']).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'item-1' },
        data: { userDueAt: due },
      })
    );
  });

  it('clears userDueAt when null is passed', async () => {
    mockPrismaExtended.syncCacheItem.findFirst.mockResolvedValue({ id: 'item-1', userId: 'user-1' });
    const p = prisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
    p['syncCacheItem']['update'] = vi.fn().mockResolvedValue({});

    await setUserDueAt('user-1', 'item-1', null);

    expect(p['syncCacheItem']['update']).toHaveBeenCalledWith(
      expect.objectContaining({ data: { userDueAt: null } })
    );
  });

  it('throws ITEM_NOT_FOUND when item does not exist', async () => {
    mockPrismaExtended.syncCacheItem.findFirst.mockResolvedValue(null);

    await expect(setUserDueAt('user-1', 'missing', new Date())).rejects.toMatchObject({
      code: 'ITEM_NOT_FOUND',
    });
  });
});

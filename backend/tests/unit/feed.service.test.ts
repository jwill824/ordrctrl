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

// T010 — Unit tests for InboxService

import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../../src/lib/db.js', () => ({
  prisma: {
    syncCacheItem: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    syncOverride: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
    },
    integration: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '../../../src/lib/db.js';
import {
  buildInbox,
  getInboxCount,
  acceptInboxItem,
  dismissInboxItem,
  acceptAll,
  dismissAll,
  InboxError,
} from '../../../src/inbox/inbox.service.js';

const mockPrisma = prisma as any;

const makeItem = (overrides: Record<string, unknown> = {}) => ({
  id: 'item-1',
  integrationId: 'int-1',
  userId: 'user-1',
  itemType: 'task',
  externalId: 'ext-1',
  title: 'Test Task',
  dueAt: null,
  startAt: null,
  endAt: null,
  pendingInbox: true,
  syncedAt: new Date('2026-01-01T00:00:00Z'),
  expiresAt: new Date(Date.now() + 86400000),
  rawPayload: {},
  integration: {
    id: 'int-1',
    serviceId: 'gmail',
    label: 'Work',
    accountIdentifier: 'user@example.com',
  },
  ...overrides,
});

describe('buildInbox', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty result when no items', async () => {
    mockPrisma.syncOverride.findMany.mockResolvedValue([]);
    mockPrisma.syncCacheItem.findMany.mockResolvedValue([]);

    const result = await buildInbox('user-1');
    expect(result).toEqual({ groups: [], total: 0 });
  });

  it('groups items by integrationId', async () => {
    mockPrisma.syncOverride.findMany.mockResolvedValue([]);
    mockPrisma.syncCacheItem.findMany.mockResolvedValue([
      makeItem({ id: 'item-1', integrationId: 'int-1' }),
      makeItem({ id: 'item-2', integrationId: 'int-1', externalId: 'ext-2', title: 'Task 2' }),
      makeItem({ id: 'item-3', integrationId: 'int-2', externalId: 'ext-3', title: 'Task 3',
        integration: { id: 'int-2', serviceId: 'apple_reminders', label: null, accountIdentifier: 'me@icloud.com' } }),
    ]);

    const result = await buildInbox('user-1');
    expect(result.total).toBe(3);
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].integrationId).toBe('int-1');
    expect(result.groups[0].items).toHaveLength(2);
    expect(result.groups[1].integrationId).toBe('int-2');
    expect(result.groups[1].items).toHaveLength(1);
  });

  it('prefixes item IDs with "inbox:"', async () => {
    mockPrisma.syncOverride.findMany.mockResolvedValue([]);
    mockPrisma.syncCacheItem.findMany.mockResolvedValue([makeItem()]);

    const result = await buildInbox('user-1');
    expect(result.groups[0].items[0].id).toBe('inbox:item-1');
  });

  it('excludes dismissed items', async () => {
    mockPrisma.syncOverride.findMany.mockResolvedValue([{ syncCacheItemId: 'item-1' }]);
    mockPrisma.syncCacheItem.findMany.mockResolvedValue([]);

    const result = await buildInbox('user-1');
    // Verify findMany was called with notIn filter
    expect(mockPrisma.syncCacheItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { notIn: ['item-1'] },
        }),
      })
    );
    expect(result.total).toBe(0);
  });

  it('does not add id filter when no dismissed items', async () => {
    mockPrisma.syncOverride.findMany.mockResolvedValue([]);
    mockPrisma.syncCacheItem.findMany.mockResolvedValue([]);

    await buildInbox('user-1');
    const call = mockPrisma.syncCacheItem.findMany.mock.calls[0][0];
    expect(call.where.id).toBeUndefined();
  });

  it('maps optional date fields correctly', async () => {
    const dueAt = new Date('2026-03-15T12:00:00Z');
    mockPrisma.syncOverride.findMany.mockResolvedValue([]);
    mockPrisma.syncCacheItem.findMany.mockResolvedValue([makeItem({ dueAt })]);

    const result = await buildInbox('user-1');
    expect(result.groups[0].items[0].dueAt).toBe(dueAt.toISOString());
  });
});

describe('getInboxCount', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns count of pending inbox items', async () => {
    mockPrisma.syncOverride.findMany.mockResolvedValue([]);
    mockPrisma.syncCacheItem.count.mockResolvedValue(5);

    const count = await getInboxCount('user-1');
    expect(count).toBe(5);
  });

  it('excludes dismissed items from count', async () => {
    mockPrisma.syncOverride.findMany.mockResolvedValue([{ syncCacheItemId: 'item-x' }]);
    mockPrisma.syncCacheItem.count.mockResolvedValue(3);

    await getInboxCount('user-1');
    expect(mockPrisma.syncCacheItem.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { notIn: ['item-x'] } }),
      })
    );
  });
});

describe('acceptInboxItem', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets pendingInbox=false for a valid item', async () => {
    mockPrisma.syncCacheItem.findFirst.mockResolvedValue(makeItem());
    mockPrisma.syncCacheItem.update.mockResolvedValue({});

    await acceptInboxItem('user-1', 'item-1');
    expect(mockPrisma.syncCacheItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { pendingInbox: false },
    });
  });

  it('throws ITEM_NOT_FOUND for missing item', async () => {
    mockPrisma.syncCacheItem.findFirst.mockResolvedValue(null);

    await expect(acceptInboxItem('user-1', 'item-999')).rejects.toThrow(InboxError);
    await expect(acceptInboxItem('user-1', 'item-999')).rejects.toMatchObject({ code: 'ITEM_NOT_FOUND' });
  });

  it('throws ALREADY_ACCEPTED for non-pending item', async () => {
    mockPrisma.syncCacheItem.findFirst.mockResolvedValue(makeItem({ pendingInbox: false }));

    await expect(acceptInboxItem('user-1', 'item-1')).rejects.toMatchObject({ code: 'ALREADY_ACCEPTED' });
  });
});

describe('dismissInboxItem', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a DISMISSED SyncOverride in a transaction', async () => {
    mockPrisma.syncCacheItem.findFirst.mockResolvedValue(makeItem());
    mockPrisma.$transaction.mockImplementation((fn: (tx: typeof mockPrisma) => Promise<unknown>) =>
      fn(mockPrisma)
    );
    mockPrisma.syncOverride.upsert.mockResolvedValue({});

    await dismissInboxItem('user-1', 'item-1');
    expect(mockPrisma.syncOverride.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { syncCacheItemId_overrideType: { syncCacheItemId: 'item-1', overrideType: 'DISMISSED' } },
        create: { userId: 'user-1', syncCacheItemId: 'item-1', overrideType: 'DISMISSED' },
      })
    );
  });

  it('throws ITEM_NOT_FOUND for missing item', async () => {
    mockPrisma.syncCacheItem.findFirst.mockResolvedValue(null);

    await expect(dismissInboxItem('user-1', 'item-999')).rejects.toMatchObject({ code: 'ITEM_NOT_FOUND' });
  });
});

describe('acceptAll', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates all pending items for an integration', async () => {
    mockPrisma.integration.findFirst.mockResolvedValue({ id: 'int-1' });
    mockPrisma.syncCacheItem.updateMany.mockResolvedValue({ count: 3 });

    const count = await acceptAll('user-1', 'int-1');
    expect(count).toBe(3);
    expect(mockPrisma.syncCacheItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ integrationId: 'int-1', pendingInbox: true }),
        data: { pendingInbox: false },
      })
    );
  });

  it('throws INTEGRATION_NOT_FOUND for unknown integration', async () => {
    mockPrisma.integration.findFirst.mockResolvedValue(null);

    await expect(acceptAll('user-1', 'bad-int')).rejects.toMatchObject({ code: 'INTEGRATION_NOT_FOUND' });
  });
});

describe('dismissAll', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates DISMISSED overrides for all pending items', async () => {
    mockPrisma.integration.findFirst.mockResolvedValue({ id: 'int-1' });
    mockPrisma.syncOverride.findMany.mockResolvedValue([]);
    mockPrisma.syncCacheItem.findMany.mockResolvedValue([{ id: 'item-1' }, { id: 'item-2' }]);
    mockPrisma.$transaction.mockResolvedValue([{}, {}]);

    const count = await dismissAll('user-1', 'int-1');
    expect(count).toBe(2);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('skips already-dismissed items', async () => {
    mockPrisma.integration.findFirst.mockResolvedValue({ id: 'int-1' });
    mockPrisma.syncOverride.findMany.mockResolvedValue([{ syncCacheItemId: 'item-1' }]);
    mockPrisma.syncCacheItem.findMany.mockResolvedValue([{ id: 'item-1' }, { id: 'item-2' }]);
    mockPrisma.$transaction.mockResolvedValue([{}]);

    const count = await dismissAll('user-1', 'int-1');
    expect(count).toBe(1);
  });

  it('returns 0 when all items already dismissed', async () => {
    mockPrisma.integration.findFirst.mockResolvedValue({ id: 'int-1' });
    mockPrisma.syncOverride.findMany.mockResolvedValue([{ syncCacheItemId: 'item-1' }]);
    mockPrisma.syncCacheItem.findMany.mockResolvedValue([{ id: 'item-1' }]);

    const count = await dismissAll('user-1', 'int-1');
    expect(count).toBe(0);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws INTEGRATION_NOT_FOUND for unknown integration', async () => {
    mockPrisma.integration.findFirst.mockResolvedValue(null);

    await expect(dismissAll('user-1', 'bad-int')).rejects.toMatchObject({ code: 'INTEGRATION_NOT_FOUND' });
  });
});

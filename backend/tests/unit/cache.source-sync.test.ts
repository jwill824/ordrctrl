import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../src/lib/db.js', () => ({
  prisma: {
    syncCacheItem: {
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
    syncOverride: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../../src/lib/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { prisma } from '../../src/lib/db.js';
import {
  markMissingItemsAsSourceCompleted,
  applySourceCompletions,
} from '../../src/sync/cache.service.js';

const mockPrisma = prisma as any;

describe('markMissingItemsAsSourceCompleted', () => {
  beforeEach(() => vi.clearAllMocks());

  it('marks non-returned items as completedAtSource', async () => {
    mockPrisma.syncCacheItem.updateMany.mockResolvedValue({ count: 2 });

    const count = await markMissingItemsAsSourceCompleted('int-1', ['ext-1', 'ext-2']);

    expect(count).toBe(2);
    expect(mockPrisma.syncCacheItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          integrationId: 'int-1',
          completedAtSource: false,
          externalId: { notIn: ['ext-1', 'ext-2'] },
        }),
        data: { completedAtSource: true },
      })
    );
  });

  it('marks all items when no IDs returned (empty sync)', async () => {
    mockPrisma.syncCacheItem.updateMany.mockResolvedValue({ count: 5 });

    const count = await markMissingItemsAsSourceCompleted('int-1', []);

    expect(count).toBe(5);
    const callArg = mockPrisma.syncCacheItem.updateMany.mock.calls[0][0];
    // When empty, no notIn filter applied
    expect(callArg.where.externalId).toBeUndefined();
  });

  it('returns 0 and does not call updateMany unnecessarily', async () => {
    mockPrisma.syncCacheItem.updateMany.mockResolvedValue({ count: 0 });

    const count = await markMissingItemsAsSourceCompleted('int-1', ['ext-1']);
    expect(count).toBe(0);
  });
});

describe('applySourceCompletions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('completes items that have no REOPENED override', async () => {
    mockPrisma.syncCacheItem.findMany.mockResolvedValue([
      { id: 'ci-1' },
      { id: 'ci-2' },
    ]);
    mockPrisma.syncOverride.findMany.mockResolvedValue([]); // no overrides
    mockPrisma.syncCacheItem.updateMany.mockResolvedValue({ count: 2 });

    const count = await applySourceCompletions('int-1');

    expect(count).toBe(2);
    expect(mockPrisma.syncCacheItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['ci-1', 'ci-2'] } },
        data: expect.objectContaining({ completedInOrdrctrl: true }),
      })
    );
  });

  it('skips items with a REOPENED override', async () => {
    mockPrisma.syncCacheItem.findMany.mockResolvedValue([
      { id: 'ci-1' },
      { id: 'ci-2' },
    ]);
    // ci-1 has a REOPENED override
    mockPrisma.syncOverride.findMany.mockResolvedValue([{ syncCacheItemId: 'ci-1' }]);
    mockPrisma.syncCacheItem.updateMany.mockResolvedValue({ count: 1 });

    const count = await applySourceCompletions('int-1');

    expect(count).toBe(1);
    const callArg = mockPrisma.syncCacheItem.updateMany.mock.calls[0][0];
    // ci-1 is excluded, only ci-2 is completed
    expect(callArg.where.id.in).toEqual(['ci-2']);
  });

  it('skips all items when all have REOPENED overrides', async () => {
    mockPrisma.syncCacheItem.findMany.mockResolvedValue([{ id: 'ci-1' }]);
    mockPrisma.syncOverride.findMany.mockResolvedValue([{ syncCacheItemId: 'ci-1' }]);

    const count = await applySourceCompletions('int-1');

    expect(count).toBe(0);
    expect(mockPrisma.syncCacheItem.updateMany).not.toHaveBeenCalled();
  });

  it('returns 0 when there are no pending source-completed items', async () => {
    mockPrisma.syncCacheItem.findMany.mockResolvedValue([]);

    const count = await applySourceCompletions('int-1');

    expect(count).toBe(0);
    expect(mockPrisma.syncOverride.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.syncCacheItem.updateMany).not.toHaveBeenCalled();
  });
});

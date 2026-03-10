import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../src/lib/queue.js', () => ({
  QUEUE_NAMES: { SYNC: 'sync' },
  createWorker: vi.fn(),
  syncQueue: {},
}));

vi.mock('../../src/lib/db.js', () => ({
  prisma: {
    integration: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../../src/lib/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('../../src/integrations/index.js', () => ({
  getAdapter: vi.fn(),
}));

vi.mock('../../src/sync/cache.service.js', () => ({
  persistCacheItems: vi.fn(),
  cleanupStaleCacheItems: vi.fn(),
  markMissingItemsAsSourceCompleted: vi.fn(),
  applySourceCompletions: vi.fn(),
}));

import { prisma } from '../../src/lib/db.js';
import { getAdapter } from '../../src/integrations/index.js';
import {
  persistCacheItems,
  cleanupStaleCacheItems,
  markMissingItemsAsSourceCompleted,
  applySourceCompletions,
} from '../../src/sync/cache.service.js';
import { createWorker, QUEUE_NAMES } from '../../src/lib/queue.js';
import { startSyncWorker } from '../../src/sync/sync.worker.js';

const mockPrisma = prisma as any;
const mockGetAdapter = getAdapter as ReturnType<typeof vi.fn>;
const mockCreateWorker = createWorker as ReturnType<typeof vi.fn>;
const mockPersistCacheItems = persistCacheItems as ReturnType<typeof vi.fn>;
const mockMarkMissing = markMissingItemsAsSourceCompleted as ReturnType<typeof vi.fn>;
const mockApplyCompletions = applySourceCompletions as ReturnType<typeof vi.fn>;
const mockCleanup = cleanupStaleCacheItems as ReturnType<typeof vi.fn>;

// Capture the worker job handler registered via createWorker
let capturedJobHandler: (job: { data: { integrationId: string; userId: string } }) => Promise<void>;

describe('SyncWorker - source completion pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateWorker.mockImplementation((_queue: string, handler: typeof capturedJobHandler) => {
      capturedJobHandler = handler;
    });
    mockPersistCacheItems.mockResolvedValue(undefined);
    mockMarkMissing.mockResolvedValue(0);
    mockApplyCompletions.mockResolvedValue(0);
    mockCleanup.mockResolvedValue(0);
    mockPrisma.integration.update.mockResolvedValue({});

    // Reset workerStarted by re-importing — we call startSyncWorker each test
    // Since module is cached, mock createWorker captures handler each call
    startSyncWorker();
  });

  const baseIntegration = {
    id: 'int-1',
    userId: 'user-1',
    serviceId: 'microsoft_tasks',
    status: 'connected',
    encryptedAccessToken: 'token',
  };

  function makeAdapter(syncItems: object[]) {
    return {
      sync: vi.fn().mockResolvedValue(syncItems),
      refreshToken: vi.fn(),
    };
  }

  it('calls markMissingItemsAsSourceCompleted with returned externalIds', async () => {
    const items = [
      { externalId: 'ext-1', completed: false },
      { externalId: 'ext-2', completed: false },
    ];
    const adapter = makeAdapter(items);
    mockGetAdapter.mockReturnValue(adapter);
    mockPrisma.integration.findUnique.mockResolvedValue(baseIntegration);

    await capturedJobHandler({ data: { integrationId: 'int-1', userId: 'user-1' } });

    expect(mockMarkMissing).toHaveBeenCalledWith('int-1', ['ext-1', 'ext-2']);
  });

  it('calls applySourceCompletions after markMissing', async () => {
    const items = [{ externalId: 'ext-1', completed: false }];
    const adapter = makeAdapter(items);
    mockGetAdapter.mockReturnValue(adapter);
    mockPrisma.integration.findUnique.mockResolvedValue(baseIntegration);

    await capturedJobHandler({ data: { integrationId: 'int-1', userId: 'user-1' } });

    expect(mockApplyCompletions).toHaveBeenCalledWith('int-1');
    // Ensure order: markMissing before applyCompletions
    const markOrder = mockMarkMissing.mock.invocationCallOrder[0];
    const applyOrder = mockApplyCompletions.mock.invocationCallOrder[0];
    expect(markOrder).toBeLessThan(applyOrder);
  });

  it('passes empty array to markMissing when sync returns no items', async () => {
    const adapter = makeAdapter([]);
    mockGetAdapter.mockReturnValue(adapter);
    mockPrisma.integration.findUnique.mockResolvedValue(baseIntegration);

    await capturedJobHandler({ data: { integrationId: 'int-1', userId: 'user-1' } });

    expect(mockMarkMissing).toHaveBeenCalledWith('int-1', []);
  });

  it('skips sync for disconnected integration', async () => {
    mockPrisma.integration.findUnique.mockResolvedValue({
      ...baseIntegration,
      status: 'disconnected',
    });

    await capturedJobHandler({ data: { integrationId: 'int-1', userId: 'user-1' } });

    expect(mockMarkMissing).not.toHaveBeenCalled();
    expect(mockApplyCompletions).not.toHaveBeenCalled();
  });
});

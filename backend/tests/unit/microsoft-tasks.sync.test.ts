import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../src/lib/db.js', () => ({
  prisma: {
    integration: { findUnique: vi.fn() },
  },
}));

vi.mock('../../src/lib/encryption.js', () => ({
  decrypt: vi.fn((v: string) => v),
  encrypt: vi.fn((v: string) => v),
}));

vi.mock('../../src/lib/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { prisma } from '../../src/lib/db.js';
import { MicrosoftTasksAdapter } from '../../src/integrations/microsoft-tasks/index.js';

const mockPrisma = prisma as any;

describe('MicrosoftTasksAdapter - selective import', () => {
  let adapter: MicrosoftTasksAdapter;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    adapter = new MicrosoftTasksAdapter();
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    vi.clearAllMocks();
  });

  const baseIntegration = {
    id: 'int-1',
    status: 'connected',
    encryptedAccessToken: 'token',
    importEverything: true,
    selectedSubSourceIds: [],
  };

  it('sync() returns all items when importEverything=true', async () => {
    mockPrisma.integration.findUnique.mockResolvedValue({ ...baseIntegration, importEverything: true });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [{ id: 'list1', displayName: 'My Tasks' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [
            { id: 'task1', title: 'Task A', status: 'notStarted' },
            { id: 'task2', title: 'Task B', status: 'notStarted' },
          ],
        }),
      });

    const items = await adapter.sync('int-1');
    expect(items).toHaveLength(2);
  });

  it('sync() filters items by selectedSubSourceIds when importEverything=false', async () => {
    mockPrisma.integration.findUnique.mockResolvedValue({
      ...baseIntegration,
      importEverything: false,
      selectedSubSourceIds: ['list2'],
    });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [
            { id: 'list1', displayName: 'My Tasks' },
            { id: 'list2', displayName: 'Work' },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [{ id: 'task1', title: 'Task A', status: 'notStarted' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [{ id: 'task2', title: 'Task B', status: 'notStarted' }] }),
      });

    const items = await adapter.sync('int-1');
    expect(items).toHaveLength(1);
    expect(items[0].externalId).toBe('task2');
  });

  it('listSubSources() returns mapped SubSource[] from task lists', async () => {
    mockPrisma.integration.findUnique.mockResolvedValue(baseIntegration);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        value: [
          { id: 'list1', displayName: 'My Tasks' },
          { id: 'list2', displayName: 'Work' },
        ],
      }),
    });

    const subSources = await adapter.listSubSources!('int-1');
    expect(subSources).toHaveLength(2);
    expect(subSources[0]).toEqual({ id: 'list1', label: 'My Tasks', type: 'list' });
  });

  it('listSubSources() returns [] on provider error', async () => {
    mockPrisma.integration.findUnique.mockResolvedValue(baseIntegration);
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const subSources = await adapter.listSubSources!('int-1');
    expect(subSources).toEqual([]);
  });
});

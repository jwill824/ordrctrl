import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../src/lib/db.js', () => ({
  prisma: {
    integration: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
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
import { GmailAdapter } from '../../src/integrations/gmail/index.js';

const mockPrisma = prisma as any;

describe('GmailAdapter - selective import', () => {
  let adapter: GmailAdapter;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    adapter = new GmailAdapter();
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    vi.clearAllMocks();
  });

  const baseIntegration = {
    id: 'int-1',
    status: 'connected',
    encryptedAccessToken: 'token',
    gmailSyncMode: 'starred_only',
    importEverything: true,
    selectedSubSourceIds: [],
  };

  it('sync() returns all items when importEverything=true', async () => {
    mockPrisma.integration.findUnique.mockResolvedValue({ ...baseIntegration, importEverything: true });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ id: 'msg1' }, { id: 'msg2' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'msg1',
          labelIds: ['LABEL_1'],
          payload: { headers: [{ name: 'Subject', value: 'Test 1' }] },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'msg2',
          labelIds: ['LABEL_2'],
          payload: { headers: [{ name: 'Subject', value: 'Test 2' }] },
        }),
      });

    const items = await adapter.sync('int-1');
    expect(items).toHaveLength(2);
  });

  it('sync() filters items when importEverything=false with selectedSubSourceIds', async () => {
    mockPrisma.integration.findUnique.mockResolvedValue({
      ...baseIntegration,
      importEverything: false,
      selectedSubSourceIds: ['LABEL_1'],
    });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ id: 'msg1' }, { id: 'msg2' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'msg1',
          labelIds: ['LABEL_1'],
          payload: { headers: [{ name: 'Subject', value: 'Test 1' }] },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'msg2',
          labelIds: ['LABEL_2'],
          payload: { headers: [{ name: 'Subject', value: 'Test 2' }] },
        }),
      });

    const items = await adapter.sync('int-1');
    expect(items).toHaveLength(1);
    expect(items[0].externalId).toBe('msg1');
  });

  it('sync() returns empty array when importEverything=false and selectedSubSourceIds is empty', async () => {
    mockPrisma.integration.findUnique.mockResolvedValue({
      ...baseIntegration,
      importEverything: false,
      selectedSubSourceIds: [],
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messages: [{ id: 'msg1' }] }),
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'msg1',
        labelIds: ['LABEL_1'],
        payload: { headers: [{ name: 'Subject', value: 'Test 1' }] },
      }),
    });

    const items = await adapter.sync('int-1');
    expect(items).toHaveLength(0);
  });

  it('listSubSources() returns mapped SubSource[] from Gmail labels', async () => {
    mockPrisma.integration.findUnique.mockResolvedValue(baseIntegration);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        labels: [
          { id: 'LABEL_1', name: 'Work' },
          { id: 'LABEL_2', name: 'Personal' },
        ],
      }),
    });

    const subSources = await adapter.listSubSources!('int-1');
    expect(subSources).toHaveLength(2);
    expect(subSources[0]).toEqual({ id: 'LABEL_1', label: 'Work', type: 'label' });
    expect(subSources[1]).toEqual({ id: 'LABEL_2', label: 'Personal', type: 'label' });
  });

  it('listSubSources() returns [] on provider error', async () => {
    mockPrisma.integration.findUnique.mockResolvedValue(baseIntegration);

    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const subSources = await adapter.listSubSources!('int-1');
    expect(subSources).toEqual([]);
  });
});

describe('GmailAdapter - source completion modes', () => {
  let adapter: GmailAdapter;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    adapter = new GmailAdapter();
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    vi.clearAllMocks();
  });

  const baseIntegration = {
    id: 'int-1',
    status: 'connected',
    encryptedAccessToken: 'token',
    gmailSyncMode: 'starred_only',
    gmailCompletionMode: null, // defaults to inbox_removal
    importEverything: true,
    selectedSubSourceIds: [],
  };

  it('inbox_removal mode: all returned messages have completed=false', async () => {
    mockPrisma.integration.findUnique.mockResolvedValue({ ...baseIntegration, gmailCompletionMode: null });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ id: 'msg1' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'msg1',
          labelIds: ['UNREAD', 'INBOX'],
          payload: { headers: [{ name: 'Subject', value: 'Hello' }] },
        }),
      });

    const items = await adapter.sync('int-1');
    expect(items).toHaveLength(1);
    expect(items[0].completed).toBe(false);

    // inbox_removal uses is:unread / is:starred is:unread query
    const listCallUrl = mockFetch.mock.calls[0][0] as string;
    expect(listCallUrl).toContain('is%3Aunread');
  });

  it('read mode: unread messages have completed=false, read messages have completed=true', async () => {
    mockPrisma.integration.findUnique.mockResolvedValue({
      ...baseIntegration,
      gmailCompletionMode: 'read',
    });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ id: 'msg1' }, { id: 'msg2' }] }),
      })
      // msg1: has UNREAD label → not yet read → completed=false
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'msg1',
          labelIds: ['UNREAD', 'INBOX'],
          payload: { headers: [{ name: 'Subject', value: 'Unread Mail' }] },
        }),
      })
      // msg2: no UNREAD label → read → completed=true
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'msg2',
          labelIds: ['INBOX'],
          payload: { headers: [{ name: 'Subject', value: 'Read Mail' }] },
        }),
      });

    const items = await adapter.sync('int-1');
    expect(items).toHaveLength(2);

    const unreadItem = items.find((i) => i.externalId === 'msg1');
    const readItem = items.find((i) => i.externalId === 'msg2');
    expect(unreadItem?.completed).toBe(false);
    expect(readItem?.completed).toBe(true);
  });

  it('read mode: uses in:inbox query instead of is:unread', async () => {
    mockPrisma.integration.findUnique.mockResolvedValue({
      ...baseIntegration,
      gmailCompletionMode: 'read',
      gmailSyncMode: 'all_unread',
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messages: [] }),
    });

    await adapter.sync('int-1');

    const listCallUrl = mockFetch.mock.calls[0][0] as string;
    expect(listCallUrl).toContain('in%3Ainbox');
    expect(listCallUrl).not.toContain('is%3Aunread');
  });
});

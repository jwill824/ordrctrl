import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchFeed,
  completeItem,
  uncompleteItem,
  dismissItem,
  restoreItem,
  getDismissedItems,
} from '@/services/feed.service';

const BASE = 'http://localhost:4000';

function mockOk(data: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => data });
}

function mockErr(status: number, message?: string) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => (message ? { message } : {}),
  });
}

describe('feed.service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('fetchFeed', () => {
    it('fetches from /api/feed without includeCompleted by default', async () => {
      global.fetch = mockOk({ items: [], completed: [], syncStatus: {} });
      await fetchFeed();
      expect(global.fetch).toHaveBeenCalledWith(`${BASE}/api/feed`, { credentials: 'include' });
    });

    it('appends ?includeCompleted=true when requested', async () => {
      global.fetch = mockOk({ items: [], completed: [], syncStatus: {} });
      await fetchFeed(true);
      expect(global.fetch).toHaveBeenCalledWith(
        `${BASE}/api/feed?includeCompleted=true`,
        { credentials: 'include' }
      );
    });

    it('returns parsed feed response', async () => {
      const payload = { items: [{ id: '1', title: 'Test' }], completed: [], syncStatus: {} };
      global.fetch = mockOk(payload);
      const result = await fetchFeed();
      expect(result).toEqual(payload);
    });

    it('throws on non-ok response', async () => {
      global.fetch = mockErr(500);
      await expect(fetchFeed()).rejects.toThrow('Failed to load feed');
    });
  });

  describe('completeItem', () => {
    it('sends PATCH to /api/feed/items/:id/complete', async () => {
      global.fetch = mockOk({});
      await completeItem('item-123');
      expect(global.fetch).toHaveBeenCalledWith(
        `${BASE}/api/feed/items/item-123/complete`,
        { method: 'PATCH', credentials: 'include' }
      );
    });

    it('throws with server message on error', async () => {
      global.fetch = mockErr(404, 'Not found');
      await expect(completeItem('bad-id')).rejects.toThrow('Not found');
    });
  });

  describe('uncompleteItem', () => {
    it('sends PATCH to /api/feed/items/:id/uncomplete and returns data', async () => {
      const payload = { id: 'x', completed: false, completedAt: null, isLocalOverride: true };
      global.fetch = mockOk(payload);
      const result = await uncompleteItem('x');
      expect(global.fetch).toHaveBeenCalledWith(
        `${BASE}/api/feed/items/x/uncomplete`,
        { method: 'PATCH', credentials: 'include' }
      );
      expect(result).toEqual(payload);
    });

    it('throws on error', async () => {
      global.fetch = mockErr(404, 'Not found');
      await expect(uncompleteItem('x')).rejects.toThrow('Not found');
    });
  });

  describe('dismissItem', () => {
    it('sends PATCH to /api/feed/items/:id/dismiss', async () => {
      global.fetch = mockOk({});
      await dismissItem('item-abc');
      expect(global.fetch).toHaveBeenCalledWith(
        `${BASE}/api/feed/items/item-abc/dismiss`,
        { method: 'PATCH', credentials: 'include' }
      );
    });

    it('throws with server message on error', async () => {
      global.fetch = mockErr(400, 'Already dismissed');
      await expect(dismissItem('x')).rejects.toThrow('Already dismissed');
    });
  });

  describe('restoreItem', () => {
    it('sends DELETE to /api/feed/items/:id/dismiss', async () => {
      global.fetch = mockOk({});
      await restoreItem('item-abc');
      expect(global.fetch).toHaveBeenCalledWith(
        `${BASE}/api/feed/items/item-abc/dismiss`,
        { method: 'DELETE', credentials: 'include' }
      );
    });

    it('throws on error', async () => {
      global.fetch = mockErr(404, 'Not found');
      await expect(restoreItem('x')).rejects.toThrow('Not found');
    });
  });

  describe('getDismissedItems', () => {
    it('fetches from /api/feed/dismissed without params', async () => {
      global.fetch = mockOk({ items: [], nextCursor: null, hasMore: false });
      await getDismissedItems();
      const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toBe(`${BASE}/api/feed/dismissed`);
    });

    it('appends limit and cursor when provided', async () => {
      global.fetch = mockOk({ items: [], nextCursor: null, hasMore: false });
      await getDismissedItems({ limit: 20, cursor: 'abc123' });
      const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toContain('limit=20');
      expect(url).toContain('cursor=abc123');
    });

    it('throws on non-ok response', async () => {
      global.fetch = mockErr(500);
      await expect(getDismissedItems()).rejects.toThrow('Failed to load dismissed items');
    });
  });
});

// T005/T016 — clearAllCompleted service function
describe('clearAllCompleted', () => {
  it('calls POST /api/feed/completed/clear and returns clearedCount', async () => {
    const { clearAllCompleted } = await import('@/services/feed.service');
    global.fetch = mockOk({ clearedCount: 5 });
    const result = await clearAllCompleted();
    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/api/feed/completed/clear`,
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );
    expect(result.clearedCount).toBe(5);
  });

  it('throws on non-ok response', async () => {
    const { clearAllCompleted } = await import('@/services/feed.service');
    global.fetch = mockErr(500, 'Server error');
    await expect(clearAllCompleted()).rejects.toThrow('Server error');
  });

  it('returns clearedCount=0 when nothing to clear', async () => {
    const { clearAllCompleted } = await import('@/services/feed.service');
    global.fetch = mockOk({ clearedCount: 0 });
    const result = await clearAllCompleted();
    expect(result.clearedCount).toBe(0);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFeed } from '@/hooks/useFeed';
import * as feedService from '@/services/feed.service';

vi.mock('@/services/feed.service');

function feedWithConnectedIntegration(lastSyncAt: string | null): feedService.FeedResponse {
  return {
    items: [],
    completed: [],
    syncStatus: {
      'integration-1': { status: 'connected', lastSyncAt, error: null },
    },
  };
}

describe('useFeed — refresh polling', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.mocked(feedService.triggerSync).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('refresh() with showDismissed:false passes showDismissed:false to fetchFeed during polling', async () => {
    vi.mocked(feedService.fetchFeed)
      .mockResolvedValueOnce(feedWithConnectedIntegration('2025-01-01T00:00:00Z'))
      .mockResolvedValue(feedWithConnectedIntegration('2025-01-01T00:00:01Z'));

    const { result } = renderHook(() => useFeed({ showDismissed: false }));
    // Wait for initial load
    await act(async () => {});

    await act(async () => {
      const refreshPromise = result.current.refresh();
      await vi.advanceTimersByTimeAsync(2001);
      await refreshPromise;
    });

    // All calls after the initial load should carry showDismissed:false
    const calls = vi.mocked(feedService.fetchFeed).mock.calls;
    const postLoadCalls = calls.slice(1);
    expect(postLoadCalls.length).toBeGreaterThan(0);
    postLoadCalls.forEach(([opts]) => {
      expect(opts?.showDismissed).toBe(false);
    });
  });

  it('refresh() with showDismissed:true passes showDismissed:true to fetchFeed during polling', async () => {
    vi.mocked(feedService.fetchFeed)
      .mockResolvedValueOnce(feedWithConnectedIntegration('2025-01-01T00:00:00Z'))
      .mockResolvedValue(feedWithConnectedIntegration('2025-01-01T00:00:01Z'));

    const { result } = renderHook(() => useFeed({ showDismissed: true }));
    await act(async () => {});

    await act(async () => {
      const refreshPromise = result.current.refresh();
      await vi.advanceTimersByTimeAsync(2001);
      await refreshPromise;
    });

    const calls = vi.mocked(feedService.fetchFeed).mock.calls;
    const postLoadCalls = calls.slice(1);
    expect(postLoadCalls.length).toBeGreaterThan(0);
    postLoadCalls.forEach(([opts]) => {
      expect(opts?.showDismissed).toBe(true);
    });
  });

  it('refresh() always includes includeCompleted:true in polling fetchFeed calls', async () => {
    vi.mocked(feedService.fetchFeed)
      .mockResolvedValueOnce(feedWithConnectedIntegration('2025-01-01T00:00:00Z'))
      .mockResolvedValue(feedWithConnectedIntegration('2025-01-01T00:00:01Z'));

    const { result } = renderHook(() => useFeed());
    await act(async () => {});

    await act(async () => {
      const refreshPromise = result.current.refresh();
      await vi.advanceTimersByTimeAsync(2001);
      await refreshPromise;
    });

    const calls = vi.mocked(feedService.fetchFeed).mock.calls;
    const postLoadCalls = calls.slice(1);
    expect(postLoadCalls.length).toBeGreaterThan(0);
    postLoadCalls.forEach(([opts]) => {
      expect(opts?.includeCompleted).toBe(true);
    });
  });

  it('refresh() sets error state when polling deadline is exceeded without sync completion', async () => {
    // Polling always returns the same lastSyncAt — sync never completes
    const staleSyncAt = '2025-01-01T00:00:00Z';
    vi.mocked(feedService.fetchFeed).mockResolvedValue(
      feedWithConnectedIntegration(staleSyncAt)
    );

    const { result } = renderHook(() => useFeed());
    await act(async () => {});

    await act(async () => {
      const refreshPromise = result.current.refresh();
      // Advance past the 30s deadline (15 polls × 2000ms = 30000ms)
      await vi.advanceTimersByTimeAsync(32000);
      await refreshPromise;
    });

    expect(result.current.error).toBe(
      'Sync is taking longer than expected. Showing latest available data.'
    );
  });
});

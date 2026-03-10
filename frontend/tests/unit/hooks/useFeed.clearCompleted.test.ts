import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFeed } from '@/hooks/useFeed';
import * as feedService from '@/services/feed.service';

vi.mock('@/services/feed.service');

const emptyFeed: feedService.FeedResponse = {
  items: [],
  completed: [],
  syncStatus: {},
};

const completedItem: feedService.FeedItem = {
  id: 'native:task-1',
  source: 'ordrctrl',
  itemType: 'task',
  title: 'Done task',
  dueAt: null,
  startAt: null,
  endAt: null,
  completed: true,
  completedAt: '2026-03-10T10:00:00Z',
  isDuplicateSuspect: false,
};

describe('useFeed — clearCompleted', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(feedService.fetchFeed).mockResolvedValue({
      ...emptyFeed,
      completed: [completedItem],
    });
    vi.mocked(feedService.clearAllCompleted).mockResolvedValue({ clearedCount: 1 });
  });

  it('optimistically empties the completed array before the API call resolves', async () => {
    const { result } = renderHook(() => useFeed());

    // Wait for initial load
    await act(async () => {});

    // Completed should have 1 item from initial load
    expect(result.current.completed).toHaveLength(1);

    // Start clear (don't await yet)
    act(() => {
      result.current.clearCompleted();
    });

    // Optimistic: completed is empty immediately
    expect(result.current.completed).toHaveLength(0);
  });

  it('sets clearedCount after successful clear', async () => {
    const { result } = renderHook(() => useFeed());
    await act(async () => {});

    await act(async () => {
      await result.current.clearCompleted();
    });

    expect(result.current.clearedCount).toBe(1);
  });

  it('clearClearedToast resets clearedCount to null', async () => {
    const { result } = renderHook(() => useFeed());
    await act(async () => {});

    await act(async () => {
      await result.current.clearCompleted();
    });

    expect(result.current.clearedCount).toBe(1);

    act(() => {
      result.current.clearClearedToast();
    });

    expect(result.current.clearedCount).toBeNull();
  });

  it('reverts optimistic update and sets error on API failure', async () => {
    vi.mocked(feedService.clearAllCompleted).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useFeed());
    await act(async () => {});

    await act(async () => {
      await result.current.clearCompleted();
    });

    // Error state set
    expect(result.current.error).toBe('Network error');
    // Completed array reverted
    expect(result.current.completed).toHaveLength(1);
    // clearedCount stays null
    expect(result.current.clearedCount).toBeNull();
  });
});

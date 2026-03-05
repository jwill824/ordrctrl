'use client';

// T056 — useFeed hook

import { useState, useEffect, useCallback, useRef } from 'react';
import * as feedService from '@/services/feed.service';
import type { FeedItem, FeedResponse } from '@/services/feed.service';

interface UseFeedReturn {
  items: FeedItem[];
  completed: FeedItem[];
  syncStatus: FeedResponse['syncStatus'];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  refresh: () => Promise<void>;
  completeItem: (itemId: string) => Promise<void>;
}

const POLL_INTERVAL_MS = 60 * 1000; // 60 seconds

export function useFeed(): UseFeedReturn {
  const [data, setData] = useState<FeedResponse>({
    items: [],
    completed: [],
    syncStatus: {},
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const feed = await feedService.fetchFeed(true); // include completed for CompletedSection
      setData(feed);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    load();
  }, [load]);

  // Poll every 60s
  useEffect(() => {
    pollRef.current = setInterval(() => load(), POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load]);

  const refresh = useCallback(async () => {
    // Trigger background sync then reload feed
    await feedService.triggerSync();
    await load(true);
  }, [load]);

  const completeItem = useCallback(
    async (itemId: string) => {
      await feedService.completeItem(itemId);
      // Optimistic update: move item to completed
      setData((prev) => {
        const item = prev.items.find((i) => i.id === itemId);
        if (!item) return prev;
        const now = new Date().toISOString();
        const updated = { ...item, completed: true, completedAt: now };
        return {
          ...prev,
          items: prev.items.filter((i) => i.id !== itemId),
          completed: [updated, ...prev.completed],
        };
      });
    },
    []
  );

  return {
    items: data.items,
    completed: data.completed,
    syncStatus: data.syncStatus,
    loading,
    refreshing,
    error,
    refresh,
    completeItem,
  };
}

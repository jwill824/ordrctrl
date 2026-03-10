'use client';

// T056 — useFeed hook

import { useState, useEffect, useCallback, useRef } from 'react';
import * as feedService from '@/services/feed.service';
import type { FeedItem, FeedResponse } from '@/services/feed.service';

export interface UndoToast {
  itemId: string;
  message: string;
}

interface UseFeedReturn {
  items: FeedItem[];
  completed: FeedItem[];
  syncStatus: FeedResponse['syncStatus'];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  undoToast: UndoToast | null;
  refresh: () => Promise<void>;
  completeItem: (itemId: string) => Promise<void>;
  uncompleteItem: (itemId: string) => Promise<void>;
  dismissItem: (itemId: string) => Promise<void>;
  restoreItem: (itemId: string) => Promise<void>;
  clearUndoToast: () => void;
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
  const [undoToast, setUndoToast] = useState<UndoToast | null>(null);
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

  const uncompleteItem = useCallback(
    async (itemId: string) => {
      // Snapshot for rollback
      let snapshot: typeof data | null = null;
      setData((prev) => {
        snapshot = prev;
        const item = prev.completed.find((i) => i.id === itemId);
        if (!item) return prev;
        return {
          ...prev,
          completed: prev.completed.filter((i) => i.id !== itemId),
          items: [{ ...item, completed: false, completedAt: null }, ...prev.items],
        };
      });

      try {
        const result = await feedService.uncompleteItem(itemId);
        if (result.isLocalOverride) {
          // Mark the item as just reopened so the inline notice renders
          setData((prev) => ({
            ...prev,
            items: prev.items.map((i) =>
              i.id === itemId ? { ...i, isJustReopened: true } : i
            ),
          }));
        }
      } catch (err) {
        // Roll back optimistic update
        if (snapshot) setData(snapshot);
        setError((err as Error).message);
      }
    },
    []
  );

  // T011 — Dismiss a feed item with optimistic update + undo toast
  const dismissItem = useCallback(
    async (itemId: string) => {
      // Optimistically remove from feed
      let snapshot: typeof data | null = null;
      setData((prev) => {
        snapshot = prev;
        return { ...prev, items: prev.items.filter((i) => i.id !== itemId) };
      });

      // Show undo toast
      setUndoToast({ itemId, message: 'Item dismissed' });

      try {
        await feedService.dismissItem(itemId);
      } catch (err) {
        // Roll back on failure
        if (snapshot) setData(snapshot);
        setUndoToast(null);
        setError((err as Error).message);
      }
    },
    []
  );

  // T016 — Restore (undo) a dismissed item
  const restoreItem = useCallback(
    async (itemId: string) => {
      setUndoToast(null);
      try {
        await feedService.restoreItem(itemId);
        // Reload feed to surface restored item
        await load();
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [load]
  );

  const clearUndoToast = useCallback(() => setUndoToast(null), []);

  return {
    items: data.items,
    completed: data.completed,
    syncStatus: data.syncStatus,
    loading,
    refreshing,
    error,
    undoToast,
    refresh,
    completeItem,
    uncompleteItem,
    dismissItem,
    restoreItem,
    clearUndoToast,
  };
}

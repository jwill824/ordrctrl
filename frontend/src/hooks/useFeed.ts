'use client';

// T056 — useFeed hook
// T032/T033/T034/T035 — Triage inbox: new items stage in a pending queue on refresh

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
  // Triage inbox
  pendingItems: FeedItem[];
  isTriageOpen: boolean;
  triageLoading: boolean;
  newItemCount: number;
  openTriage: () => void;
  closeTriage: () => void;
  acceptTriage: () => void;
  dismissTriageItem: (itemId: string) => Promise<void>;
  dismissAllTriage: () => Promise<void>;
  // Actions
  refresh: () => Promise<void>;
  reloadFeed: () => Promise<void>;
  completeItem: (itemId: string) => Promise<void>;
  uncompleteItem: (itemId: string) => Promise<void>;
  dismissItem: (itemId: string) => Promise<void>;
  restoreItem: (itemId: string) => Promise<void>;
  clearUndoToast: () => void;
  clearCompleted: () => Promise<void>;
  clearedCount: number | null;
  clearClearedToast: () => void;
}

// T032 — 15-minute poll interval (matches UI label "Auto-sync every 15 min")
const POLL_INTERVAL_MS = 15 * 60 * 1000;

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
  const [clearedCount, setClearedCount] = useState<number | null>(null);

  // T033 — Triage state
  const [pendingItems, setPendingItems] = useState<FeedItem[]>([]);
  const [isTriageOpen, setIsTriageOpen] = useState(false);
  const [triageLoading, setTriageLoading] = useState(false);
  const [newItemCount, setNewItemCount] = useState(0);

  // Track which item IDs are already known to the feed (so we can diff on refresh)
  const knownIdsRef = useRef<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const feed = await feedService.fetchFeed(true);
      setData(feed);
      // Populate knownIds on initial load (no triage for first load)
      knownIdsRef.current = new Set(feed.items.map((i) => i.id));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // T039 — Silent reload for native task mutations (create/update/delete).
  // Updates the full feed + knownIds without triggering triage.
  const reloadFeed = useCallback(async () => {
    try {
      const feed = await feedService.fetchFeed(true);
      setData(feed);
      // Absorb any new IDs directly into knownIds — they're user-initiated, not incoming sync
      feed.items.forEach((i) => knownIdsRef.current.add(i.id));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  // Initial load — items go straight into the feed, no triage
  useEffect(() => {
    load();
  }, [load]);

  // T035/T040 — Background poll: silent fetch, badge only sync-sourced new items
  const backgroundPoll = useCallback(async () => {
    try {
      const feed = await feedService.fetchFeed(true);
      // T040 — only sync: items are eligible for triage; native tasks are user-owned
      const newItems = feed.items.filter(
        (i) => !knownIdsRef.current.has(i.id) && i.id.startsWith('sync:')
      );
      if (newItems.length > 0) {
        setPendingItems(newItems);
        setNewItemCount(newItems.length);
        // Update feed data (completed, syncStatus) but don't add new active items yet
        setData((prev) => ({ ...prev, completed: feed.completed, syncStatus: feed.syncStatus }));
      } else {
        setData(feed);
        feed.items.forEach((i) => knownIdsRef.current.add(i.id));
      }
    } catch {
      // Silent — don't surface background poll errors
    }
  }, []);

  // T032 — Poll every 15 min (background, no triage auto-open)
  useEffect(() => {
    pollRef.current = setInterval(backgroundPoll, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [backgroundPoll]);

  // T034/T040 — Manual refresh: trigger sync + open triage sheet with sync-sourced new items only
  const refresh = useCallback(async () => {
    setIsTriageOpen(true);
    setTriageLoading(true);
    try {
      await feedService.triggerSync();
      const feed = await feedService.fetchFeed(true);
      // T040 — only sync: items go into triage; native tasks are always user-owned
      const newItems = feed.items.filter(
        (i) => !knownIdsRef.current.has(i.id) && i.id.startsWith('sync:')
      );
      setPendingItems(newItems);
      setNewItemCount(newItems.length);
      // Non-triage items (native + already-known sync) land directly in the feed
      const knownAndNative = feed.items.filter(
        (i) => knownIdsRef.current.has(i.id) || i.id.startsWith('native:')
      );
      knownAndNative.forEach((i) => knownIdsRef.current.add(i.id));
      setData((prev) => ({
        ...prev,
        items: knownAndNative,
        completed: feed.completed,
        syncStatus: feed.syncStatus,
      }));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
      setIsTriageOpen(false);
    } finally {
      setTriageLoading(false);
      setRefreshing(false);
    }
  }, []);

  const openTriage = useCallback(() => setIsTriageOpen(true), []);
  const closeTriage = useCallback(() => {
    // Closing without action = accept all (items land in feed)
    setData((prev) => {
      const merged = [...pendingItems, ...prev.items];
      return { ...prev, items: merged };
    });
    pendingItems.forEach((i) => knownIdsRef.current.add(i.id));
    setPendingItems([]);
    setNewItemCount(0);
    setIsTriageOpen(false);
  }, [pendingItems]);

  const acceptTriage = useCallback(() => {
    // Merge all pending items into the active feed
    setData((prev) => ({ ...prev, items: [...pendingItems, ...prev.items] }));
    pendingItems.forEach((i) => knownIdsRef.current.add(i.id));
    setPendingItems([]);
    setNewItemCount(0);
    setIsTriageOpen(false);
  }, [pendingItems]);

  const dismissTriageItem = useCallback(async (itemId: string) => {
    try {
      await feedService.dismissItem(itemId);
      setPendingItems((prev) => {
        const remaining = prev.filter((i) => i.id !== itemId);
        setNewItemCount(remaining.length);
        return remaining;
      });
      knownIdsRef.current.add(itemId);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  const dismissAllTriage = useCallback(async () => {
    try {
      await Promise.all(pendingItems.map((i) => feedService.dismissItem(i.id)));
      pendingItems.forEach((i) => knownIdsRef.current.add(i.id));
      setPendingItems([]);
      setNewItemCount(0);
      setIsTriageOpen(false);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [pendingItems]);

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
        // Silent reload — restored item absorbs into knownIds, no triage
        await reloadFeed();
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [reloadFeed]
  );

  const clearUndoToast = useCallback(() => setUndoToast(null), []);

  // T008 — Clear all completed tasks (bulk dismiss)
  const clearCompleted = useCallback(async () => {
    // Capture snapshot before the optimistic update (updaters are deferred in React 18)
    const snapshot = data;
    setData((prev) => ({ ...prev, completed: [] }));

    try {
      const result = await feedService.clearAllCompleted();
      setClearedCount(result.clearedCount);
      // Silent reload to pick up any state changes from server
      await reloadFeed();
    } catch (err) {
      // Roll back optimistic update
      setData(snapshot);
      setError((err as Error).message);
    }
  }, [data, reloadFeed]);

  // T014 — Reset the cleared count toast
  const clearClearedToast = useCallback(() => setClearedCount(null), []);

  return {
    items: data.items,
    completed: data.completed,
    syncStatus: data.syncStatus,
    loading,
    refreshing,
    error,
    undoToast,
    pendingItems,
    isTriageOpen,
    triageLoading,
    newItemCount,
    openTriage,
    closeTriage,
    acceptTriage,
    dismissTriageItem,
    dismissAllTriage,
    refresh,
    reloadFeed,
    completeItem,
    uncompleteItem,
    dismissItem,
    restoreItem,
    clearUndoToast,
    clearCompleted,
    clearedCount,
    clearClearedToast,
  };
}

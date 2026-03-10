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
  completeItem: (itemId: string) => Promise<void>;
  uncompleteItem: (itemId: string) => Promise<void>;
  dismissItem: (itemId: string) => Promise<void>;
  restoreItem: (itemId: string) => Promise<void>;
  clearUndoToast: () => void;
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

  // Initial load — items go straight into the feed, no triage
  useEffect(() => {
    load();
  }, [load]);

  // T035 — Background poll: silent fetch, badge new items without opening triage sheet
  const backgroundPoll = useCallback(async () => {
    try {
      const feed = await feedService.fetchFeed(true);
      const newItems = feed.items.filter((i) => !knownIdsRef.current.has(i.id));
      if (newItems.length > 0) {
        setPendingItems(newItems);
        setNewItemCount(newItems.length);
        // Update feed data (completed, syncStatus) but don't add new active items yet
        setData((prev) => ({ ...prev, completed: feed.completed, syncStatus: feed.syncStatus }));
      } else {
        setData(feed);
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

  // T034 — Manual refresh: trigger sync + open triage sheet with new items
  const refresh = useCallback(async () => {
    setIsTriageOpen(true);
    setTriageLoading(true);
    try {
      await feedService.triggerSync();
      const feed = await feedService.fetchFeed(true);
      const newItems = feed.items.filter((i) => !knownIdsRef.current.has(i.id));
      setPendingItems(newItems);
      setNewItemCount(newItems.length);
      // Update completed + syncStatus but hold new active items in triage
      setData((prev) => ({
        ...prev,
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
    completeItem,
    uncompleteItem,
    dismissItem,
    restoreItem,
    clearUndoToast,
  };
}

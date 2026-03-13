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
  // Actions
  refresh: () => Promise<void>;
  reloadFeed: () => Promise<void>;
  completeItem: (itemId: string) => Promise<void>;
  uncompleteItem: (itemId: string) => Promise<void>;
  dismissItem: (itemId: string) => Promise<void>;
  restoreItem: (itemId: string) => Promise<void>;
  permanentDeleteItem: (itemId: string) => Promise<void>;
  setUserDueAt: (itemId: string, dueAt: string | null) => Promise<void>;
  setDescriptionOverride: (itemId: string, value: string | null) => Promise<void>;
  clearUndoToast: () => void;
  clearCompleted: () => Promise<void>;
  clearedCount: number | null;
  clearClearedToast: () => void;
}

interface UseFeedOptions {
  showDismissed?: boolean;
}

// 15-minute background poll interval
const POLL_INTERVAL_MS = 15 * 60 * 1000;

export function useFeed(options: UseFeedOptions = {}): UseFeedReturn {
  const { showDismissed = false } = options;
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

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const feed = await feedService.fetchFeed({ includeCompleted: true, showDismissed });
      setData(feed);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [showDismissed]);

  // Silent reload for native task mutations (create/update/delete).
  const reloadFeed = useCallback(async () => {
    try {
      const feed = await feedService.fetchFeed({ includeCompleted: true, showDismissed });
      setData(feed);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [showDismissed]);

  // Initial load
  useEffect(() => {
    load();
  }, [load]);

  // Background poll every 15 min — silently update feed with accepted items
  const backgroundPoll = useCallback(async () => {
    try {
      const feed = await feedService.fetchFeed({ includeCompleted: true, showDismissed });
      setData(feed);
    } catch {
      // Silent — don't surface background poll errors
    }
  }, [showDismissed]);

  useEffect(() => {
    pollRef.current = setInterval(backgroundPoll, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [backgroundPoll]);

  // Manual refresh: trigger sync, wait for all integrations to complete, then reload.
  // New items from sync land in the inbox (pendingInbox=true) — users review there.
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Snapshot current lastSyncAt timestamps before triggering
      const preSyncTimes = Object.fromEntries(
        Object.entries(data.syncStatus)
          .filter(([, s]) => s.status === 'connected')
          .map(([id, s]) => [id, s.lastSyncAt])
      );
      const connectedCount = Object.keys(preSyncTimes).length;

      await feedService.triggerSync();

      if (connectedCount === 0) {
        await reloadFeed();
        return;
      }

      // Poll feed every 2s until all connected integrations have an updated lastSyncAt
      // (meaning the sync job completed), or until 30s timeout
      const POLL_MS = 2_000;
      const TIMEOUT_MS = 30_000;
      const deadline = Date.now() + TIMEOUT_MS;

      let syncCompleted = false;
      while (Date.now() < deadline) {
        await new Promise<void>((r) => setTimeout(r, POLL_MS));
        const feed = await feedService.fetchFeed({ includeCompleted: true, showDismissed });
        setData(feed);

        const allDone = Object.entries(preSyncTimes).every(([id, before]) => {
          const after = feed.syncStatus[id]?.lastSyncAt;
          return after && after !== before;
        });
        if (allDone) { syncCompleted = true; break; }
      }

      // Final reload with completed items
      await reloadFeed();

      if (!syncCompleted) {
        setError('Sync is taking longer than expected. Showing latest available data.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, [data.syncStatus, reloadFeed, showDismissed]);

  const completeItem = useCallback(
    async (itemId: string) => {
      await feedService.completeItem(itemId);
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
          setData((prev) => ({
            ...prev,
            items: prev.items.map((i) =>
              i.id === itemId ? { ...i, isJustReopened: true } : i
            ),
          }));
        }
      } catch (err) {
        if (snapshot) setData(snapshot);
        setError((err as Error).message);
      }
    },
    []
  );

  const dismissItem = useCallback(
    async (itemId: string) => {
      let snapshot: typeof data | null = null;
      setData((prev) => {
        snapshot = prev;
        return { ...prev, items: prev.items.filter((i) => i.id !== itemId) };
      });
      setUndoToast({ itemId, message: 'Item dismissed' });
      try {
        await feedService.dismissItem(itemId);
      } catch (err) {
        if (snapshot) setData(snapshot);
        setUndoToast(null);
        setError((err as Error).message);
      }
    },
    []
  );

  const restoreItem = useCallback(
    async (itemId: string) => {
      setUndoToast(null);
      try {
        await feedService.restoreItem(itemId);
        await reloadFeed();
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [reloadFeed]
  );

  const clearUndoToast = useCallback(() => setUndoToast(null), []);

  const clearCompleted = useCallback(async () => {
    const snapshot = data;
    setData((prev) => ({ ...prev, completed: [] }));
    try {
      const result = await feedService.clearAllCompleted();
      setClearedCount(result.clearedCount);
      await reloadFeed();
    } catch (err) {
      setData(snapshot);
      setError((err as Error).message);
    }
  }, [data, reloadFeed]);

  const clearClearedToast = useCallback(() => setClearedCount(null), []);

  const permanentDeleteItem = useCallback(
    async (itemId: string) => {
      setData((prev) => ({ ...prev, items: prev.items.filter((i) => i.id !== itemId) }));
      try {
        await feedService.permanentDeleteItem(itemId);
      } catch (err) {
        await reloadFeed();
        setError((err as Error).message);
      }
    },
    [reloadFeed]
  );

  const setUserDueAt = useCallback(
    async (itemId: string, dueAt: string | null) => {
      // Optimistic update
      setData((prev) => ({
        ...prev,
        items: prev.items.map((i) =>
          i.id === itemId
            ? { ...i, dueAt, hasUserDueAt: dueAt !== null && i.id.startsWith('sync:') }
            : i
        ),
      }));
      try {
        await feedService.setUserDueAt(itemId, dueAt);
      } catch (err) {
        await reloadFeed();
        setError((err as Error).message);
      }
    },
    [reloadFeed]
  );

  const setDescriptionOverride = useCallback(
    async (itemId: string, value: string | null) => {
      // Optimistic update: compute new description locally
      setData((prev) => ({
        ...prev,
        items: prev.items.map((i) => {
          if (i.id !== itemId) return i;
          const hasDescriptionOverride = value !== null;
          const descriptionOverride = value;
          const description = value ?? i.originalBody;
          return {
            ...i,
            hasDescriptionOverride,
            descriptionOverride,
            description,
          };
        }),
        completed: prev.completed.map((i) => {
          if (i.id !== itemId) return i;
          const hasDescriptionOverride = value !== null;
          const descriptionOverride = value;
          const description = value ?? i.originalBody;
          return {
            ...i,
            hasDescriptionOverride,
            descriptionOverride,
            description,
          };
        }),
      }));
      try {
        const result = await feedService.setDescriptionOverride(itemId, value);
        // Update with server response
        setData((prev) => ({
          ...prev,
          items: prev.items.map((i) => {
            if (i.id !== itemId) return i;
            return {
              ...i,
              hasDescriptionOverride: result.hasDescriptionOverride,
              descriptionOverride: result.descriptionOverride,
              descriptionUpdatedAt: result.descriptionUpdatedAt,
              description: result.descriptionOverride ?? i.originalBody,
            };
          }),
          completed: prev.completed.map((i) => {
            if (i.id !== itemId) return i;
            return {
              ...i,
              hasDescriptionOverride: result.hasDescriptionOverride,
              descriptionOverride: result.descriptionOverride,
              descriptionUpdatedAt: result.descriptionUpdatedAt,
              description: result.descriptionOverride ?? i.originalBody,
            };
          }),
        }));
      } catch (err) {
        // Revert on error
        await reloadFeed();
        setError((err as Error).message);
      }
    },
    [reloadFeed]
  );

  return {
    items: data.items,
    completed: data.completed,
    syncStatus: data.syncStatus,
    loading,
    refreshing,
    error,
    undoToast,
    refresh,
    reloadFeed,
    completeItem,
    uncompleteItem,
    dismissItem,
    restoreItem,
    permanentDeleteItem,
    setUserDueAt,
    setDescriptionOverride,
    clearUndoToast,
    clearCompleted,
    clearedCount,
    clearClearedToast,
  };
}

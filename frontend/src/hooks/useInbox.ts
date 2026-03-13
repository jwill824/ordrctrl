'use client';

// T010 — useInbox hook
// Fetches inbox groups and exposes per-item and bulk triage actions.

import { useState, useEffect, useCallback, useRef } from 'react';
import * as inboxService from '@/services/inbox.service';
import * as feedService from '@/services/feed.service';
import type { InboxGroup } from '@/services/inbox.service';

interface UseInboxReturn {
  groups: InboxGroup[];
  total: number;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  reload: () => Promise<void>;
  refresh: () => Promise<void>;
  acceptItem: (itemId: string) => Promise<void>;
  dismissItem: (itemId: string) => Promise<void>;
  acceptAllInGroup: (integrationId: string) => Promise<void>;
  dismissAllInGroup: (integrationId: string) => Promise<void>;
}

export function useInbox(): UseInboxReturn {
  const [groups, setGroups] = useState<InboxGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const result = await inboxService.fetchInbox();
      setGroups(result.groups);
      setTotal(result.total);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    // Poll every 60 seconds so new items from sync appear automatically
    timerRef.current = setInterval(() => { void load(); }, 60_000);

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void load();
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      if (timerRef.current !== null) clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [load]);

  const acceptItem = useCallback(
    async (itemId: string) => {
      await inboxService.acceptItem(itemId);
      // Optimistically remove item from groups
      setGroups((prev) =>
        prev
          .map((g) => ({ ...g, items: g.items.filter((i) => i.id !== itemId) }))
          .filter((g) => g.items.length > 0)
      );
      setTotal((prev) => Math.max(0, prev - 1));
    },
    []
  );

  const dismissItem = useCallback(
    async (itemId: string) => {
      await inboxService.dismissItem(itemId);
      // Optimistically remove item from groups
      setGroups((prev) =>
        prev
          .map((g) => ({ ...g, items: g.items.filter((i) => i.id !== itemId) }))
          .filter((g) => g.items.length > 0)
      );
      setTotal((prev) => Math.max(0, prev - 1));
    },
    []
  );

  const acceptAllInGroup = useCallback(
    async (integrationId: string) => {
      const count = await inboxService.acceptAllItems(integrationId);
      setGroups((prev) => prev.filter((g) => g.integrationId !== integrationId));
      setTotal((prev) => Math.max(0, prev - count));
    },
    []
  );

  const dismissAllInGroup = useCallback(
    async (integrationId: string) => {
      const count = await inboxService.dismissAllItems(integrationId);
      setGroups((prev) => prev.filter((g) => g.integrationId !== integrationId));
      setTotal((prev) => Math.max(0, prev - count));
    },
    []
  );

  // Manual refresh: trigger a sync against all integrations, wait for completion,
  // then reload the inbox so newly synced items appear.
  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await feedService.triggerSync();

      // Poll every 2s until the backend has finished syncing (up to 30s).
      // We detect completion by watching the inbox item count change, or after timeout.
      const POLL_MS = 2_000;
      const TIMEOUT_MS = 30_000;
      const deadline = Date.now() + TIMEOUT_MS;
      const before = total;

      let synced = false;
      while (Date.now() < deadline) {
        await new Promise<void>((r) => setTimeout(r, POLL_MS));
        const result = await inboxService.fetchInbox();
        setGroups(result.groups);
        setTotal(result.total);
        if (result.total !== before) { synced = true; break; }
      }

      if (!synced) {
        // Final reload regardless — show whatever is now available
        const result = await inboxService.fetchInbox();
        setGroups(result.groups);
        setTotal(result.total);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, [total]);

  return {
    groups,
    total,
    loading,
    refreshing,
    error,
    reload: load,
    refresh,
    acceptItem,
    dismissItem,
    acceptAllInGroup,
    dismissAllInGroup,
  };
}

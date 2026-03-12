'use client';

// T010 — useInbox hook
// Fetches inbox groups and exposes per-item and bulk triage actions.

import { useState, useEffect, useCallback, useRef } from 'react';
import * as inboxService from '@/services/inbox.service';
import type { InboxGroup } from '@/services/inbox.service';

interface UseInboxReturn {
  groups: InboxGroup[];
  total: number;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  acceptItem: (itemId: string) => Promise<void>;
  dismissItem: (itemId: string) => Promise<void>;
  acceptAllInGroup: (integrationId: string) => Promise<void>;
  dismissAllInGroup: (integrationId: string) => Promise<void>;
}

export function useInbox(): UseInboxReturn {
  const [groups, setGroups] = useState<InboxGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
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

  return {
    groups,
    total,
    loading,
    error,
    reload: load,
    acceptItem,
    dismissItem,
    acceptAllInGroup,
    dismissAllInGroup,
  };
}

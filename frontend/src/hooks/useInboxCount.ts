'use client';

// T010 — useInboxCount hook
// Polls the inbox count every 15 minutes (same interval as feed refresh).

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchInboxCount } from '@/services/inbox.service';

const POLL_INTERVAL_MS = 15 * 60 * 1000;

interface UseInboxCountReturn {
  inboxCount: number;
  refreshCount: () => Promise<void>;
}

export function useInboxCount(): UseInboxCountReturn {
  const [inboxCount, setInboxCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshCount = useCallback(async () => {
    try {
      const count = await fetchInboxCount();
      setInboxCount(count);
    } catch {
      // Silent failure — badge just stays at last known count
    }
  }, []);

  useEffect(() => {
    void refreshCount();

    timerRef.current = setInterval(() => {
      void refreshCount();
    }, POLL_INTERVAL_MS);

    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
      }
    };
  }, [refreshCount]);

  return { inboxCount, refreshCount };
}

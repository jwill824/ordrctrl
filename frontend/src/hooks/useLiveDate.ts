import { useEffect, useState } from 'react';

/**
 * Returns a live `Date` that updates on the given interval.
 * Used so relative time labels (e.g. "due in 2 min") update without a page reload.
 */
export function useLiveDate(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}

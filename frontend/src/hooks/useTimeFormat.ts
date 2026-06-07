import { useState, useCallback } from 'react';

const STORAGE_KEY = 'ordrctrl-time-format';

function detectDefault(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored === '12h';
    // Detect from locale — US/CA default to 12h; most others to 24h
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    return /^en-(US|CA|AU|NZ|IN|PH|ZA)/.test(locale);
  } catch {
    return false;
  }
}

export function useTimeFormat() {
  const [use12h, setUse12h] = useState<boolean>(detectDefault);

  const toggle = useCallback(() => {
    setUse12h((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, next ? '12h' : '24h'); } catch { /* noop */ }
      return next;
    });
  }, []);

  return { use12h, toggle };
}

/**
 * Shared date utility functions for consistent timezone-aware display.
 *
 * Key problem: all-day calendar events (e.g. Apple Calendar DTSTART;VALUE=DATE)
 * are stored as UTC midnight (T00:00:00Z) or UTC noon (T12:00:00Z — our sentinel).
 * In UTC-negative timezones, these shift to the previous local calendar day when
 * naively converted to local time with setHours(0,0,0,0) or toLocaleDateString.
 */

/**
 * Detect whether an ISO date string represents an all-day event.
 * All-day sentinels:
 *   - T00:00:00.000Z  (UTC midnight — legacy data, iCal all-day before backend fix)
 *   - T12:00:00.000Z  (UTC noon — new canonical all-day sentinel, safe for UTC-12…UTC+11.5)
 */
export function isAllDayDate(iso: string): boolean {
  const d = new Date(iso);
  return (d.getUTCHours() === 0 || d.getUTCHours() === 12) &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0;
}

/**
 * Normalise a date string to local midnight for calendar-day comparison.
 *
 * For all-day sentinels (UTC midnight or noon): extract UTC date components and
 * construct local midnight from them, preserving the calendar date regardless of
 * the viewer's timezone offset.
 *
 * For timed events: normalise to local midnight via setHours(0,0,0,0) as usual.
 */
export function toLocalMidnight(dateStr: string): Date {
  const d = new Date(dateStr);
  if (isAllDayDate(dateStr)) {
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * Format an ISO date string for a `datetime-local` HTML input.
 * Uses LOCAL time components so the browser doesn't display UTC time.
 *
 * Example: '2026-03-18T03:00:00Z' in UTC-4 → '2026-03-17T23:00'
 */
export function toLocalDateTimeInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Format an ISO date string for a `date` HTML input (no time).
 * For all-day sentinels, extracts the UTC calendar date (the intended date).
 * For timed events, extracts the local calendar date.
 *
 * Example (all-day): '2026-03-18T12:00:00Z' → '2026-03-18'
 * Example (timed):   '2026-03-18T03:00:00Z' in UTC-4 → '2026-03-17'
 */
export function toLocalDateInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (isAllDayDate(iso)) {
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Relative day label for a date vs. a reference "now".
 * Uses calendar-day comparison (not 24-hour diff) for correct bucketing.
 *
 * Returns: 'Today' | 'Tomorrow' | 'Yesterday' | 'Nd overdue' | 'In Nd' | 'MMM D'
 */
export function formatRelativeDay(iso: string, now: Date): string {
  const eventDay = toLocalMidnight(iso);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((eventDay.getTime() - today.getTime()) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays < 7) return `In ${diffDays}d`;

  const d = new Date(iso);
  const year = eventDay.getFullYear();
  const nowYear = today.getFullYear();
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(year !== nowYear ? { year: 'numeric' } : {}),
  });
}

/**
 * Format a time portion from an ISO string using the local timezone.
 * Returns empty string for all-day events (no time to display).
 *
 * Example: '2026-03-18T03:00:00Z' in UTC-4 → '11:00 PM'
 */
export function formatLocalTime(iso: string): string {
  if (isAllDayDate(iso)) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

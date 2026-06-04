import { useMemo } from 'react';
import { useLiveDate } from './useLiveDate';
import { toLocalMidnight } from '@/utils/dateUtils';
import type { FeedItem } from '@/services/feed.service';

export interface PlannerItem extends FeedItem {
  durationMinutes: number;
}

export interface UsePlannerTimelineOptions {
  items: FeedItem[];
  sourceFilter?: string | null;
  /** When provided, only scheduled items whose startAt falls on this calendar day are included. */
  targetDate?: Date;
}

export interface UsePlannerTimelineResult {
  scheduled: PlannerItem[];
  unscheduled: FeedItem[];
  now: Date;
}

export function usePlannerTimeline({ items, sourceFilter, targetDate }: UsePlannerTimelineOptions): UsePlannerTimelineResult {
  const now = useLiveDate();

  const { scheduled, unscheduled } = useMemo(() => {
    const filtered = sourceFilter
      ? items.filter((i) => i.serviceId === sourceFilter || i.source === sourceFilter)
      : items;

    const targetMidnight = targetDate
      ? (() => { const d = new Date(targetDate); d.setHours(0, 0, 0, 0); return d.getTime(); })()
      : null;

    const scheduled: PlannerItem[] = [];
    const unscheduled: FeedItem[] = [];

    for (const item of filtered) {
      if (item.startAt !== null && item.endAt !== null) {
        if (targetMidnight !== null) {
          const itemMidnight = toLocalMidnight(item.startAt).getTime();
          if (itemMidnight !== targetMidnight) {
            unscheduled.push(item);
            continue;
          }
        }
        const durationMinutes =
          (new Date(item.endAt).getTime() - new Date(item.startAt).getTime()) / 60000;
        scheduled.push({ ...item, durationMinutes });
      } else {
        unscheduled.push(item);
      }
    }

    scheduled.sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime());

    return { scheduled, unscheduled };
  }, [items, sourceFilter, targetDate]);

  return { scheduled, unscheduled, now };
}

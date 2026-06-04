import { useMemo } from 'react';
import { useLiveDate } from './useLiveDate';
import type { FeedItem } from '@/services/feed.service';

export interface PlannerItem extends FeedItem {
  durationMinutes: number;
}

export interface UsePlannerTimelineOptions {
  items: FeedItem[];
  sourceFilter?: string | null;
}

export interface UsePlannerTimelineResult {
  scheduled: PlannerItem[];
  unscheduled: FeedItem[];
  now: Date;
}

export function usePlannerTimeline({ items, sourceFilter }: UsePlannerTimelineOptions): UsePlannerTimelineResult {
  const now = useLiveDate();

  const { scheduled, unscheduled } = useMemo(() => {
    const filtered = sourceFilter
      ? items.filter((i) => i.serviceId === sourceFilter || i.source === sourceFilter)
      : items;

    const scheduled: PlannerItem[] = [];
    const unscheduled: FeedItem[] = [];

    for (const item of filtered) {
      if (item.startAt !== null && item.endAt !== null) {
        const durationMinutes =
          (new Date(item.endAt).getTime() - new Date(item.startAt).getTime()) / 60000;
        scheduled.push({ ...item, durationMinutes });
      } else {
        unscheduled.push(item);
      }
    }

    scheduled.sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime());

    return { scheduled, unscheduled };
  }, [items, sourceFilter]);

  return { scheduled, unscheduled, now };
}

import { useMemo } from 'react';
import { toLocalMidnight, addDays } from '@/utils/dateUtils';
import type { FeedItem } from '@/services/feed.service';
import type { PlannerItem } from './usePlannerTimeline';

export type { PlannerItem } from './usePlannerTimeline';

export interface UseWeeklyPlannerOptions {
  items: FeedItem[];
  weekStart: Date;
  sourceFilter?: string | null;
}

export interface UseWeeklyPlannerResult {
  dayMap: Map<string, PlannerItem[]>;
  weekDays: Date[];
}

export function useWeeklyPlanner({ items, weekStart, sourceFilter }: UseWeeklyPlannerOptions): UseWeeklyPlannerResult {
  return useMemo(() => {
    const weekDays: Date[] = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    const filtered = sourceFilter
      ? items.filter((i) => i.serviceId === sourceFilter || i.source === sourceFilter)
      : items;

    const dayMap = new Map<string, PlannerItem[]>(
      weekDays.map((d) => {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return [key, []];
      })
    );

    for (const item of filtered) {
      if (item.startAt === null || item.endAt === null) continue;
      const local = toLocalMidnight(item.startAt);
      const dayKey = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
      const bucket = dayMap.get(dayKey);
      if (!bucket) continue;
      const durationMinutes =
        (new Date(item.endAt).getTime() - new Date(item.startAt).getTime()) / 60000;
      bucket.push({ ...item, durationMinutes });
    }

    for (const bucket of dayMap.values()) {
      bucket.sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime());
    }

    return { dayMap, weekDays };
  }, [items, weekStart, sourceFilter]);
}

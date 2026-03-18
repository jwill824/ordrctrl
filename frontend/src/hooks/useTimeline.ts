'use client';

// T005 — useTimeline hook
// T015 — sourceFilter param

import { useMemo } from 'react';
import { useLiveDate } from './useLiveDate';
import type { FeedItem } from '@/services/feed.service';
import type { TimelineBucket, TimelineGroupData } from '@/types/timeline';

// Canonical display order for buckets
const BUCKET_ORDER: TimelineBucket[] = [
  'overdue',
  'today',
  'this-week',
  'later',
  'unscheduled',
];

const BUCKET_LABELS: Record<TimelineBucket, string> = {
  overdue: 'Overdue',
  today: 'Today',
  'this-week': 'This Week',
  later: 'Later',
  unscheduled: 'No Date',
};

/**
 * Assign a temporal bucket using midnight-normalised date comparison.
 * Specification from data-model.md:
 *   diffDays < 0  → 'overdue'
 *   diffDays === 0 → 'today'
 *   diffDays 1–7  → 'this-week'
 *   diffDays > 7  → 'later'
 *   dueAt === null → 'unscheduled'
 */
function getBucket(dueAt: string | null, now: Date): TimelineBucket {
  if (!dueAt) return 'unscheduled';

  const dueDay = new Date(dueAt);
  dueDay.setHours(0, 0, 0, 0);

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.floor(
    (dueDay.getTime() - today.getTime()) / 86_400_000
  );

  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'today';
  if (diffDays <= 7) return 'this-week';
  return 'later';
}

export interface UseTimelineOptions {
  /** Active (non-completed, non-dismissed) feed items from useFeed */
  items: FeedItem[];
  /** When set, show only items whose serviceId or source matches this value */
  sourceFilter?: string | null;
}

/**
 * Transforms a flat list of FeedItems into bucketed timeline groups.
 *
 * - Uses useLiveDate() so bucket boundaries update every 60 s without a reload
 * - Omits empty buckets entirely
 * - Sorts within buckets: dueAt ASC then title ASC; unscheduled: title ASC only
 */
export function useTimeline({ items, sourceFilter }: UseTimelineOptions): TimelineGroupData[] {
  const now = useLiveDate();

  return useMemo(() => {
    // T015 — apply source filter if provided
    const filtered = sourceFilter
      ? items.filter(
          (i) => i.serviceId === sourceFilter || i.source === sourceFilter
        )
      : items;

    const buckets = new Map<TimelineBucket, FeedItem[]>();

    for (const item of filtered) {
      const bucket = getBucket(item.dueAt, now);
      if (!buckets.has(bucket)) buckets.set(bucket, []);
      buckets.get(bucket)!.push(item);
    }

    // Sort within each bucket
    for (const [bucket, bucketItems] of buckets) {
      bucketItems.sort((a, b) => {
        if (bucket === 'unscheduled') {
          return a.title.localeCompare(b.title);
        }
        // dueAt ASC, then title ASC
        const dateA = a.dueAt ? new Date(a.dueAt).getTime() : 0;
        const dateB = b.dueAt ? new Date(b.dueAt).getTime() : 0;
        if (dateA !== dateB) return dateA - dateB;
        return a.title.localeCompare(b.title);
      });
    }

    // Return only non-empty buckets in canonical order
    return BUCKET_ORDER.filter((bucket) => buckets.has(bucket)).map(
      (bucket) => ({
        bucket,
        label: BUCKET_LABELS[bucket],
        items: buckets.get(bucket)!,
      })
    );
  }, [items, sourceFilter, now]);
}

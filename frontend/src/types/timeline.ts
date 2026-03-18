// T002 — Timeline types

import type { FeedItem } from '@/services/feed.service';

/**
 * Which view the feed page is showing.
 * Persisted in UserSettings.feedViewMode.
 */
export type TimelineViewMode = 'feed' | 'timeline';

/**
 * Temporal bucket a feed item falls into.
 * Assigned using midnight-normalised date comparison (see useTimeline).
 */
export type TimelineBucket =
  | 'overdue'
  | 'today'
  | 'this-week'
  | 'later'
  | 'unscheduled';

/** One collapsible group in the timeline view. */
export interface TimelineGroupData {
  bucket: TimelineBucket;
  label: string;
  items: FeedItem[];
}

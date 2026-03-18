'use client';

// T007 — TimelineView component
// T013 — Offline stale-data indicator
// T016 — Source filter UI

import { TimelineGroup } from './TimelineGroup';
import type { TimelineGroupData } from '@/types/timeline';
import type { FeedItem } from '@/services/feed.service';

interface TimelineViewProps {
  groups: TimelineGroupData[];
  onComplete: (id: string) => void;
  onDismiss?: (id: string) => void;
  onEdit?: (item: FeedItem) => void;
  /** True when the app has no network connectivity */
  isOffline?: boolean;
  /** ISO timestamp of the last successful sync, used to show stale-data age */
  lastSyncAt?: string | null;
  /** Currently active source filter (serviceId or null for All) */
  sourceFilter?: string | null;
  /** All distinct service IDs present in the current feed */
  availableSources?: string[];
  onSourceFilterChange?: (source: string | null) => void;
}

export function TimelineView({
  groups,
  onComplete,
  onDismiss,
  onEdit,
  isOffline,
  lastSyncAt,
  sourceFilter,
  availableSources,
  onSourceFilterChange,
}: TimelineViewProps) {
  const isEmpty = groups.length === 0;

  // T013 — compute how stale the cached data is in minutes
  const staleAgeMin =
    isOffline && lastSyncAt
      ? Math.floor((Date.now() - new Date(lastSyncAt).getTime()) / 60_000)
      : null;

  return (
    <div>
      {/* T013 — offline stale-data indicator */}
      {isOffline && (
        <div className="flex items-center gap-1.5 text-[0.7rem] text-amber-600 mb-3">
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden
          >
            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
            <path
              d="M6 3.5v3M6 8.5v.5"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
          {staleAgeMin !== null
            ? `Offline — showing data from ${
                staleAgeMin < 1 ? 'just now' : `${staleAgeMin} min ago`
              }`
            : 'Offline — showing cached data'}
        </div>
      )}

      {/* T016 — source filter pill row (shown only when ≥ 2 sources exist) */}
      {availableSources &&
        availableSources.length > 1 &&
        onSourceFilterChange && (
          <div className="flex items-center gap-1.5 mb-4 flex-wrap">
            <button
              type="button"
              onClick={() => onSourceFilterChange(null)}
              className={`text-[0.65rem] font-bold uppercase tracking-[0.08em] px-2 py-0.5 border transition-colors ${
                !sourceFilter
                  ? 'border-black bg-black text-white'
                  : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-400'
              }`}
            >
              All
            </button>
            {availableSources.map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => onSourceFilterChange(src)}
                className={`text-[0.65rem] font-bold uppercase tracking-[0.08em] px-2 py-0.5 border transition-colors ${
                  sourceFilter === src
                    ? 'border-black bg-black text-white'
                    : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-400'
                }`}
              >
                {src}
              </button>
            ))}
          </div>
        )}

      {isEmpty && (
        <div className="text-zinc-400 text-sm pt-4 text-center">
          Nothing scheduled.
        </div>
      )}

      {groups.map((group) => (
        <TimelineGroup
          key={group.bucket}
          bucket={group.bucket}
          label={group.label}
          items={group.items}
          onComplete={onComplete}
          onDismiss={onDismiss}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}

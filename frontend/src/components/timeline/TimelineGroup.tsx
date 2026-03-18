'use client';

// T006 — TimelineGroup component
// T012 — Overdue visual distinction
// T018 — Sticky header CSS
// T019 — Task count badge

import { useState } from 'react';
import { FeedItemRow } from '@/components/feed/FeedItem';
import type { FeedItem } from '@/services/feed.service';
import type { TimelineBucket } from '@/types/timeline';

interface TimelineGroupProps {
  bucket: TimelineBucket;
  label: string;
  items: FeedItem[];
  onComplete: (id: string) => void;
  onDismiss?: (id: string) => void;
  onEdit?: (item: FeedItem) => void;
}

/** Buckets that expand by default when the timeline view opens. */
const DEFAULT_EXPANDED: Record<TimelineBucket, boolean> = {
  overdue: true,
  today: true,
  'this-week': false,
  later: false,
  unscheduled: false,
};

export function TimelineGroup({
  bucket,
  label,
  items,
  onComplete,
  onDismiss,
  onEdit,
}: TimelineGroupProps) {
  // State resets on every mount — no persistence across view opens
  const [open, setOpen] = useState(() => DEFAULT_EXPANDED[bucket]);

  // T012 — overdue bucket gets red accent treatment
  const isOverdue = bucket === 'overdue';

  return (
    <div className="mb-2">
      {/* T018 — sticky header: top-12 clears the 3rem app header */}
      <div className={`sticky top-12 z-10 bg-white ${isOverdue ? 'border-l-2 border-red-400 pl-2' : ''}`}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between py-2 bg-transparent border-none cursor-pointer text-left border-b border-zinc-100"
        >
          <div className="flex items-center gap-2">
            {/* T012 — overdue label is red */}
            <span
              className={`text-[0.7rem] font-bold uppercase tracking-[0.1em] ${
                isOverdue ? 'text-red-600' : 'text-zinc-400'
              }`}
            >
              {label}
            </span>

            {/* T019 — task count badge shown when collapsed */}
            {!open && (
              <span
                className={`text-[0.65rem] font-semibold ${
                  isOverdue ? 'text-red-400' : 'text-zinc-400'
                }`}
              >
                {items.length} task{items.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            className={`flex-shrink-0 transition-transform duration-150 ${
              open ? 'rotate-180' : 'rotate-0'
            }`}
          >
            <path
              d="M2 4l4 4 4-4"
              stroke="#a1a1aa"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Item list */}
      {open && (
        <div className={isOverdue ? 'border-l-2 border-red-100 pl-2' : ''}>
          {items.map((item) => (
            <FeedItemRow
              key={item.id}
              item={item}
              onComplete={onComplete}
              onDismiss={onDismiss}
              onClick={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

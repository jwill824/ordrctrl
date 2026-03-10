'use client';

// T052 — CompletedSection component
// Collapsible section collapsed by default, renders completed FeedItem list

import { useState } from 'react';
import { FeedItemRow } from './FeedItem';
import type { FeedItem } from '@/services/feed.service';

interface CompletedSectionProps {
  items: FeedItem[];
  onUncomplete: (itemId: string) => void;
  onClear: () => void;
}

export function CompletedSection({ items, onUncomplete, onClear }: CompletedSectionProps) {
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 bg-transparent border-none cursor-pointer py-2 text-left"
        >
          <span className="text-[0.7rem] font-bold uppercase tracking-[0.1em] text-zinc-400">
            Completed ({items.length})
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="#a1a1aa"
            className={`flex-shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : 'rotate-0'}`}
          >
            <path d="M2 4l4 4 4-4" stroke="#a1a1aa" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear all completed tasks"
          className="text-[0.7rem] font-bold uppercase tracking-[0.1em] text-zinc-400 bg-transparent border-none cursor-pointer py-2 hover:text-zinc-600"
        >
          Clear
        </button>
      </div>

      {open && (
        <div>
          {items.map((item) => (
            <FeedItemRow
              key={item.id}
              item={item}
              onComplete={() => {}} // completed items can't be re-completed via this handler
              onUncomplete={onUncomplete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

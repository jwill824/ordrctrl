'use client';

// T052 — CompletedSection component
// Collapsible section collapsed by default, renders completed FeedItem list

import { useState } from 'react';
import { FeedItemRow } from './FeedItem';
import type { FeedItem } from '@/services/feed.service';

interface CompletedSectionProps {
  items: FeedItem[];
}

export function CompletedSection({ items }: CompletedSectionProps) {
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 bg-transparent border-none cursor-pointer py-2 w-full text-left"
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

      {open && (
        <div>
          {items.map((item) => (
            <FeedItemRow
              key={item.id}
              item={item}
              onComplete={() => {}} // completed items can't be re-completed
            />
          ))}
        </div>
      )}
    </div>
  );
}

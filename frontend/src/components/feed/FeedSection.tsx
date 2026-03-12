'use client';

import type { FeedItem } from '@/services/feed.service';
import { FeedItemRow } from './FeedItem';

interface FeedSectionProps {
  label: string;
  items: FeedItem[];
  emptyMessage?: string;
  onComplete: (id: string) => void;
  onUncomplete?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onRestore?: (id: string) => void;
  onPermanentDelete?: (id: string) => void;
  onEdit?: (item: FeedItem) => void;
}

export function FeedSection({
  label,
  items,
  emptyMessage,
  onComplete,
  onUncomplete,
  onDismiss,
  onRestore,
  onPermanentDelete,
  onEdit,
}: FeedSectionProps) {
  if (items.length === 0 && !emptyMessage) return null;

  return (
    <div className="mb-4">
      <div className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-zinc-400 pb-1 mb-1 border-b border-zinc-100">
        {label}
      </div>
      {items.length === 0 && emptyMessage ? (
        <p className="text-sm text-zinc-400 py-4 text-center">{emptyMessage}</p>
      ) : (
        items.map((item) => (
          <FeedItemRow
            key={item.id}
            item={item}
            onComplete={onComplete}
            onUncomplete={onUncomplete}
            onDismiss={onDismiss}
            onRestore={onRestore}
            onPermanentDelete={onPermanentDelete ? () => onPermanentDelete(item.id) : undefined}
            onClick={onEdit ? () => onEdit(item) : undefined}
          />
        ))
      )}
    </div>
  );
}

'use client';

// T010 — InboxItem component
// Renders a single inbox item with Accept and Dismiss buttons.

import type { InboxItem as InboxItemType } from '@/services/inbox.service';

interface InboxItemProps {
  item: InboxItemType;
  onAccept: (itemId: string) => Promise<void>;
  onDismiss: (itemId: string) => Promise<void>;
}

function formatDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function InboxItem({ item, onAccept, onDismiss }: InboxItemProps) {
  const dateStr = formatDate(item.dueAt ?? item.startAt);
  const typeLabel = item.itemType === 'task' ? '↗' : item.itemType === 'event' ? '⏰' : '✉';

  return (
    <div
      data-testid="inbox-item"
      className="flex items-start justify-between gap-3 py-3 border-b border-zinc-100 last:border-b-0"
    >
      <div className="flex items-start gap-2 min-w-0 flex-1">
        <span className="text-zinc-400 text-xs mt-0.5 shrink-0" aria-hidden="true">
          {typeLabel}
        </span>
        <div className="min-w-0">
          <p className="text-sm text-zinc-900 truncate">{item.title}</p>
          {dateStr && (
            <p className="text-xs text-zinc-400 mt-0.5">{dateStr}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => void onAccept(item.id)}
          aria-label={`Accept ${item.title}`}
          className="px-2 py-1 text-xs font-medium text-white bg-black hover:bg-zinc-800 rounded-sm"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={() => void onDismiss(item.id)}
          aria-label={`Dismiss ${item.title}`}
          className="px-2 py-1 text-xs font-medium text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded-sm"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

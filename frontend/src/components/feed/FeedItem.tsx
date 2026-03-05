'use client';

// T051 — FeedItem component

import type { FeedItem as FeedItemType } from '@/services/feed.service';

const SOURCE_COLORS: Record<string, string> = {
  Gmail: '#EA4335',
  'Apple Reminders': '#007AFF',
  'Microsoft Tasks': '#0078d4',
  'Apple Calendar': '#34C759',
  ordrctrl: '#18181b',
};

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days < 7) return `In ${days}d`;

  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

interface FeedItemProps {
  item: FeedItemType;
  onComplete: (id: string) => void;
  onClick?: (item: FeedItemType) => void;
}

export function FeedItemRow({ item, onComplete, onClick }: FeedItemProps) {
  const sourceColor = SOURCE_COLORS[item.source] ?? '#a1a1aa';
  const dateStr = item.dueAt
    ? formatDate(item.dueAt)
    : item.startAt
    ? `${formatDate(item.startAt)} ${formatTime(item.startAt)}`.trim()
    : '';

  const isOverdue =
    item.dueAt && new Date(item.dueAt) < new Date() && !item.completed;

  return (
    <div className={`flex items-start gap-3 py-[0.875rem] border-b border-zinc-100 ${item.completed ? 'opacity-50' : ''}`}>
      {/* Checkbox */}
      <button
        type="button"
        aria-label={item.completed ? 'Completed' : 'Mark complete'}
        onClick={() => !item.completed && onComplete(item.id)}
        className={`w-[1.125rem] h-[1.125rem] border flex-shrink-0 mt-0.5 flex items-center justify-center p-0 ${
          item.completed
            ? 'border-zinc-400 bg-zinc-400 cursor-default'
            : 'border-zinc-300 bg-white cursor-pointer'
        }`}
      >
        {item.completed && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="white">
            <path d="M1.5 5L4 7.5 8.5 2" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>

      {/* Content */}
      <div
        className={`flex-1 min-w-0 ${onClick ? 'cursor-pointer' : ''}`}
        onClick={() => onClick?.(item)}
      >
        {/* Title row */}
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`text-[0.9rem] text-black break-words ${item.completed ? 'line-through' : ''}`}>
            {item.title}
          </span>

          {/* Duplicate warning */}
          {item.isDuplicateSuspect && (
            <span
              title="This item may be a duplicate from another source"
              className="text-[0.65rem] font-bold uppercase tracking-[0.06em] text-amber-600 border border-amber-300 px-[0.3rem] py-[0.1rem] flex-shrink-0"
            >
              ⚠ Duplicate?
            </span>
          )}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {/* Source badge — color is runtime dynamic, keep inline style only for color */}
          <span
            className="text-[0.65rem] font-bold uppercase tracking-[0.08em]"
            style={{ color: sourceColor }}
          >
            {item.source}
          </span>

          {/* Date */}
          {dateStr && (
            <>
              <span className="text-zinc-200 text-xs">·</span>
              <span className={`text-xs ${isOverdue ? 'text-red-600 font-semibold' : 'text-zinc-500'}`}>
                {dateStr}
              </span>
            </>
          )}

          {/* Event end time */}
          {item.itemType === 'event' && item.endAt && (
            <span className="text-xs text-zinc-400">
              – {formatTime(item.endAt)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

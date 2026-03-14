'use client';

// T051 — FeedItem component

import { useState } from 'react';
import type { FeedItem as FeedItemType } from '@/services/feed.service';
import { useLiveDate } from '@/hooks/useLiveDate';

const SERVICE_COLORS: Record<string, string> = {
  gmail: '#EA4335',
  apple_reminders: '#007AFF',
  microsoft_tasks: '#0078d4',
  apple_calendar: '#34C759',
  ordrctrl: '#18181b',
};

const SERVICE_NAMES: Record<string, string> = {
  gmail: 'Gmail',
  apple_reminders: 'Reminders',
  microsoft_tasks: 'To Do',
  apple_calendar: 'Calendar',
  ordrctrl: 'ordrctrl',
};

const SOURCE_LABEL_MAP: Record<string, string> = {
  gmail: 'Open in Gmail',
  microsoft_tasks: 'Open in To Do',
  apple_calendar: 'Open in Calendar',
  apple_reminders: 'Open in Reminders',
};

function formatDate(iso: string | null, now: Date): string {
  if (!iso) return '';
  const d = new Date(iso);
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
  onUncomplete?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onRestore?: (id: string) => void;
  onPermanentDelete?: () => void;
  onClick?: (item: FeedItemType) => void;
}

// T012 — DismissButton: shown on hover via group/group-hover
function DismissButton({ onDismiss }: { onDismiss: () => void }) {
  return (
    <button
      type="button"
      aria-label="Dismiss item"
      title="Dismiss — hide this item from your feed"
      onClick={(e) => {
        e.stopPropagation();
        onDismiss();
      }}
      className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity flex-shrink-0 w-6 h-6 flex items-center justify-center text-zinc-300 hover:text-zinc-500 bg-transparent border-0 p-0 cursor-pointer"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </button>
  );
}

export function FeedItemRow({ item, onComplete, onUncomplete, onDismiss, onRestore, onPermanentDelete, onClick }: FeedItemProps) {
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const now = useLiveDate();
  const serviceColor = SERVICE_COLORS[item.serviceId] ?? '#a1a1aa';
  const serviceName = SERVICE_NAMES[item.serviceId] ?? item.serviceId;
  const showAccountLabel = item.serviceId !== 'ordrctrl' && item.source !== serviceName;
  const dateStr = item.dueAt
    ? formatDate(item.dueAt, now)
    : item.startAt
    ? `${formatDate(item.startAt, now)} ${formatTime(item.startAt)}`.trim()
    : '';

  const isOverdue =
    item.dueAt && new Date(item.dueAt) < now && !item.completed;

  return (
    <div className={`group flex items-start gap-3 py-[0.875rem] border-b border-zinc-100 ${item.completed ? 'opacity-50' : ''}`}>
      {/* Checkbox */}
      <button
        type="button"
        aria-label={item.completed ? 'Reopen task' : 'Mark complete'}
        onClick={() => {
          if (item.completed) {
            onUncomplete?.(item.id);
          } else {
            onComplete(item.id);
          }
        }}
        className={`w-[1.125rem] h-[1.125rem] border flex-shrink-0 mt-0.5 flex items-center justify-center p-0 ${
          item.completed
            ? 'border-zinc-400 bg-zinc-400 cursor-pointer hover:bg-zinc-300 hover:border-zinc-300'
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
          {/* Service badge + account label */}
          <span
            className="text-[0.65rem] font-bold uppercase tracking-[0.08em]"
            style={{ color: serviceColor }}
          >
            {serviceName}
          </span>
          {showAccountLabel && (
            <span className="text-[0.65rem] text-zinc-400 font-normal normal-case tracking-normal truncate max-w-[120px]">
              {item.source}
            </span>
          )}

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

          {/* Source link — Apple Calendar falls back to calshow:// (generic app open).
              TODO: add calshow://<timestamp> event deep links when iOS support lands. */}
          {item.serviceId !== 'ordrctrl' && (item.sourceUrl || item.serviceId === 'apple_calendar') && (
            <>
              <span className="text-zinc-200 text-xs">·</span>
              <a
                href={item.sourceUrl ?? 'calshow://'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[0.65rem] text-zinc-400 hover:text-zinc-700 underline"
              >
                {SOURCE_LABEL_MAP[item.serviceId] ?? 'Open Source'}
              </a>
            </>
          )}
        </div>
      </div>

      {/* T012/T017 — Dismiss button (hover-reveal) */}
      {onDismiss && !item.completed && (
        <DismissButton onDismiss={() => onDismiss(item.id)} />
      )}

      {/* Restore button (dismissed view) */}
      {onRestore && (
        <button
          type="button"
          aria-label="Restore item"
          onClick={(e) => { e.stopPropagation(); onRestore(item.id); }}
          className="flex-shrink-0 text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-zinc-400 hover:text-black bg-transparent border-0 p-0 cursor-pointer"
        >
          Restore
        </button>
      )}

      {/* Permanent delete button (dismissed view) */}
      {onPermanentDelete && (
        <button
          type="button"
          aria-label="Delete permanently"
          onClick={(e) => { e.stopPropagation(); onPermanentDelete(); }}
          className="flex-shrink-0 text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-red-400 hover:text-red-600 bg-transparent border-0 p-0 cursor-pointer"
        >
          Delete
        </button>
      )}

      {/* Inline local-override notice for reopened sync items */}
      {item.isJustReopened && !noticeDismissed && item.serviceId !== 'ordrctrl' && (
        <div className="flex items-center gap-1.5 mt-1 ml-[1.875rem] text-[0.7rem] text-zinc-400">
          <span>This change is local to ordrctrl and won&apos;t update {serviceName}.</span>
          <button
            type="button"
            aria-label="Dismiss notice"
            onClick={() => setNoticeDismissed(true)}
            className="bg-transparent border-0 p-0 cursor-pointer text-zinc-400 leading-none"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

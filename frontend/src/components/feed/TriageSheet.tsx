'use client';

// T036 — Triage Sheet: bottom sheet that appears on refresh showing new/pending items
// Users can accept or dismiss items before they land in the feed.

import type { FeedItem } from '@/services/feed.service';

interface TriageSheetProps {
  isOpen: boolean;
  loading: boolean;
  items: FeedItem[];
  onClose: () => void;       // close = accept all remaining
  onAcceptAll: () => void;
  onDismissAll: () => Promise<void>;
  onDismissItem: (itemId: string) => Promise<void>;
}

function ItemTypeLabel({ source }: { source: string }) {
  if (source === 'native') return null;
  return (
    <span className="text-[0.6rem] font-medium uppercase tracking-wider text-zinc-400 ml-1.5">
      {source}
    </span>
  );
}

export function TriageSheet({
  isOpen,
  loading,
  items,
  onClose,
  onAcceptAll,
  onDismissAll,
  onDismissItem,
}: TriageSheetProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-label="Incoming items"
        className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-zinc-200 shadow-xl max-h-[80vh] flex flex-col"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-8 h-1 bg-zinc-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100 flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">
              {loading
                ? 'Syncing…'
                : items.length > 0
                ? `${items.length} new item${items.length === 1 ? '' : 's'}`
                : 'Feed is up to date'}
            </h2>
            {!loading && items.length > 0 && (
              <p className="text-[0.7rem] text-zinc-400 mt-0.5">
                Review and accept or dismiss before adding to your feed
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-zinc-400 hover:text-zinc-700 bg-transparent border-0 cursor-pointer p-1 leading-none text-lg"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-zinc-400 text-sm">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                className="animate-spin"
              >
                <path d="M14 8A6 6 0 1 0 8 14" />
              </svg>
              Checking for new items…
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                className="text-zinc-300 mb-3"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <p className="text-sm text-zinc-500">Nothing new — your feed is current.</p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-5 py-3 group">
                  {/* Item type dot */}
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      item.itemType === 'task'
                        ? 'bg-zinc-800'
                        : item.itemType === 'event'
                        ? 'bg-blue-400'
                        : 'bg-zinc-300'
                    }`}
                  />

                  {/* Title + source */}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-zinc-800 truncate block">{item.title}</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      {item.dueAt && (
                        <span className="text-[0.65rem] text-zinc-400">
                          {new Date(item.dueAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      )}
                      <ItemTypeLabel source={item.source} />
                    </div>
                  </div>

                  {/* Per-item dismiss */}
                  <button
                    type="button"
                    onClick={() => onDismissItem(item.id)}
                    aria-label={`Dismiss "${item.title}"`}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-700 bg-transparent border-0 cursor-pointer p-1 text-base leading-none"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer actions */}
        {!loading && (
          <div className="flex items-center gap-3 px-5 py-4 border-t border-zinc-100 flex-shrink-0">
            {items.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={onAcceptAll}
                  className="flex-1 bg-black text-white text-sm py-2.5 px-4 border-0 cursor-pointer hover:bg-zinc-800 transition-colors"
                >
                  Accept all
                </button>
                <button
                  type="button"
                  onClick={onDismissAll}
                  className="flex-1 bg-transparent text-zinc-500 text-sm py-2.5 px-4 border border-zinc-200 cursor-pointer hover:border-zinc-400 hover:text-zinc-700 transition-colors"
                >
                  Dismiss all
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-black text-white text-sm py-2.5 px-4 border-0 cursor-pointer hover:bg-zinc-800 transition-colors"
              >
                Done
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

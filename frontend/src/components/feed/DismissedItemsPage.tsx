'use client';

// T022 — DismissedItemsPage: paginated list of dismissed feed items with restore action

import { useState, useEffect, useCallback } from 'react';
import * as feedService from '@/services/feed.service';
import type { DismissedItem } from '@/services/feed.service';

const SOURCE_COLORS: Record<string, string> = {
  gmail: '#EA4335',
  microsoft_tasks: '#0078d4',
  apple_calendar: '#34C759',
  ordrctrl: '#18181b',
};

function formatDismissedDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    gmail: 'Gmail',
    microsoft_tasks: 'Microsoft To Do',
    apple_calendar: 'Apple Calendar',
    ordrctrl: 'ordrctrl',
  };
  return labels[source] ?? source;
}

export function DismissedItemsPage() {
  const [items, setItems] = useState<DismissedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoringIds, setRestoringIds] = useState<Set<string>>(new Set());

  const loadPage = useCallback(async (cursor?: string) => {
    const isFirst = !cursor;
    if (isFirst) setLoading(true); else setLoadingMore(true);

    try {
      const res = await feedService.getDismissedItems({ cursor });
      if (isFirst) {
        setItems(res.items);
      } else {
        setItems((prev) => [...prev, ...res.items]);
      }
      setNextCursor(res.nextCursor);
      setHasMore(res.hasMore);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { loadPage(); }, [loadPage]);

  const handleRestore = async (itemId: string) => {
    setRestoringIds((prev) => new Set(prev).add(itemId));
    try {
      await feedService.restoreItem(itemId);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRestoringIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  if (loading) {
    return <p className="text-sm text-zinc-400 pt-4">Loading…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600 pt-4">{error}</p>;
  }

  if (items.length === 0) {
    return (
      <div className="pt-8 text-center">
        <p className="text-sm text-zinc-400">No dismissed items.</p>
        <p className="text-xs text-zinc-300 mt-1">
          Items you dismiss from your feed will appear here for restoration.
        </p>
      </div>
    );
  }

  return (
    <div>
      <ul className="divide-y divide-zinc-100">
        {items.map((item) => {
          const color = SOURCE_COLORS[item.source] ?? '#a1a1aa';
          const isRestoring = restoringIds.has(item.id);
          return (
            <li key={item.id} className="flex items-center justify-between gap-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-[0.9rem] text-black truncate">{item.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className="text-[0.65rem] font-bold uppercase tracking-[0.08em]"
                    style={{ color }}
                  >
                    {sourceLabel(item.source)}
                  </span>
                  <span className="text-zinc-200 text-xs">·</span>
                  <span className="text-xs text-zinc-400">
                    Dismissed {formatDismissedDate(item.dismissedAt)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                disabled={isRestoring}
                onClick={() => handleRestore(item.id)}
                className="text-xs text-zinc-500 border border-zinc-200 px-2.5 py-1 hover:border-zinc-400 hover:text-black disabled:opacity-40 disabled:cursor-default bg-white cursor-pointer flex-shrink-0"
              >
                {isRestoring ? 'Restoring…' : 'Restore'}
              </button>
            </li>
          );
        })}
      </ul>

      {hasMore && (
        <div className="pt-4 text-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => loadPage(nextCursor ?? undefined)}
            className="text-xs text-zinc-500 border border-zinc-200 px-3 py-1.5 hover:border-zinc-400 hover:text-black disabled:opacity-40 bg-white cursor-pointer"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}

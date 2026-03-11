'use client';

// T010 — InboxPage component
// Full inbox page: loading state, empty state, groups list.

import { useInbox } from '@/hooks/useInbox';
import { InboxGroup } from './InboxGroup';

export function InboxPage() {
  const {
    groups,
    total,
    loading,
    error,
    reload,
    acceptItem,
    dismissItem,
    acceptAllInGroup,
    dismissAllInGroup,
  } = useInbox();

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top nav */}
      <header className="border-b border-zinc-100 px-5 h-12 flex items-center justify-between sticky top-0 bg-white z-10">
        <span className="text-[0.65rem] font-bold tracking-[0.28em] uppercase text-black">
          ordrctrl
        </span>
        <a
          href="/feed"
          className="text-xs text-zinc-500 hover:text-zinc-800"
        >
          ← Back to feed
        </a>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-[40rem] w-full mx-auto px-5 pt-6 pb-24">
        <div className="flex items-baseline gap-2 mb-6">
          <h1 className="text-base font-semibold text-zinc-900">Inbox</h1>
          {!loading && total > 0 && (
            <span className="text-xs text-zinc-400">
              {total} item{total !== 1 ? 's' : ''}
            </span>
          )}
          <button
            type="button"
            onClick={() => void reload()}
            className="ml-auto text-xs text-zinc-400 hover:text-zinc-700"
            aria-label="Refresh inbox"
          >
            ↻ Refresh
          </button>
        </div>

        {error && (
          <div className="border-l-2 border-red-500 py-1 pl-3 text-[0.8rem] text-red-600 mb-4">
            {error}
          </div>
        )}

        {loading && (
          <div className="text-zinc-400 text-sm pt-8 text-center">Loading…</div>
        )}

        {!loading && total === 0 && !error && (
          <div className="text-center pt-16">
            <p className="text-zinc-400 text-sm">Your inbox is empty.</p>
            <p className="text-zinc-300 text-xs mt-1">
              New synced items will appear here first.
            </p>
          </div>
        )}

        {!loading && groups.length > 0 && (
          <div>
            {groups.map((group) => (
              <InboxGroup
                key={group.integrationId}
                group={group}
                onAcceptItem={acceptItem}
                onDismissItem={dismissItem}
                onAcceptAll={acceptAllInGroup}
                onDismissAll={dismissAllInGroup}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

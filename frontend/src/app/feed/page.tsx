// T055 + T061 — Feed page
// T010 — view mode toggle / swipe integration
// T014 — first-launch swipe hint
// T017 — source filter state

import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Suspense } from 'react';
import { useFeed } from '@/hooks/useFeed';
import { useTimeline } from '@/hooks/useTimeline';
import { useNativeTasks } from '@/hooks/useNativeTasks';
import { useInboxCount } from '@/hooks/useInboxCount';
import { usePlatform } from '@/plugins/index';
import { getUserSettings, updateUserSettings } from '@/services/user.service';
import { FeedSection } from '@/components/feed/FeedSection';
import { CompletedSection } from '@/components/feed/CompletedSection';
import { IntegrationErrorBanner } from '@/components/feed/IntegrationErrorBanner';
import { FeedEmptyState } from '@/components/feed/FeedEmptyState';
import { AddTaskForm } from '@/components/tasks/AddTaskForm';
import { EditTaskModal } from '@/components/tasks/EditTaskModal';
import { AccountMenu } from '@/components/AccountMenu';
import { TimelineView, TimelineSwipeContainer } from '@/components/timeline';
import type { FeedItem } from '@/services/feed.service';
import type { TimelineViewMode } from '@/types/timeline';

const SWIPE_HINT_KEY = 'ordrctrl.timeline.swipeHintSeen';

function FeedPageContent() {
  const [searchParams] = useSearchParams();
  const showDismissed = searchParams.get('showDismissed') === 'true';

  const {
    items, completed, syncStatus, loading, refreshing, error,
    refresh, reloadFeed, completeItem, uncompleteItem, dismissItem, restoreItem,
    permanentDeleteItem, setUserDueAt, setDescriptionOverride, setTitleOverride,
    undoToast, clearUndoToast,
    clearCompleted, clearedCount, clearClearedToast,
  } = useFeed({ showDismissed });
  const { create, update, remove } = useNativeTasks(reloadFeed);
  const { inboxCount } = useInboxCount();
  const { isMobile, isDesktop } = usePlatform();

  // ── View mode (T010) ──────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<TimelineViewMode>('feed');
  const settingsLoadedRef = useRef(false);

  useEffect(() => {
    if (settingsLoadedRef.current) return;
    settingsLoadedRef.current = true;
    getUserSettings()
      .then((s) => {
        if (s.feedViewMode) setViewMode(s.feedViewMode);
      })
      .catch(() => {/* silently default to 'feed' */});
  }, []);

  const handleModeChange = (mode: TimelineViewMode) => {
    setViewMode(mode);
    updateUserSettings({ feedViewMode: mode }).catch(() => {/* best-effort */});
  };

  // ── Source filter (T017) ──────────────────────────────────────────────────
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);

  const availableSources = useMemo(() => {
    const ids = new Set(items.map((i) => i.serviceId));
    return Array.from(ids).sort();
  }, [items]);

  // ── Timeline groups (T005) ────────────────────────────────────────────────
  const timelineGroups = useTimeline({ items, sourceFilter });

  // ── Offline detection (T013) ──────────────────────────────────────────────
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  const lastSyncAt = Object.values(syncStatus)
    .map((s) => s.lastSyncAt)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;

  // ── First-launch swipe hint (T014) ────────────────────────────────────────
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  useEffect(() => {
    if (!isMobile) return;
    if (typeof window === 'undefined') return;
    const seen = window.localStorage.getItem(SWIPE_HINT_KEY);
    if (!seen) {
      setShowSwipeHint(true);
      window.localStorage.setItem(SWIPE_HINT_KEY, 'true');
    }
  }, [isMobile]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTask, setEditingTask] = useState<FeedItem | null>(null);

  const hasIntegrations = Object.values(syncStatus).some(
    (s) => s.status === 'connected' || s.status === 'error'
  );
  const isEmpty = items.length === 0 && !loading;

  const handleItemClick = (item: FeedItem) => {
    setEditingTask(item);
  };

  // Split active items into dated and undated sections (feed view)
  const datedItems = items.filter((i) => i.dueAt !== null);
  const undatedItems = items.filter((i) => i.dueAt === null);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top nav */}
      <header className="border-b border-zinc-100 px-5 h-12 flex items-center justify-between sticky top-0 bg-white z-10">
        <span className="text-[0.65rem] font-bold tracking-[0.28em] uppercase text-black">
          ordrctrl
        </span>

        <div className="flex items-center gap-3">
          {/* T010 — desktop/web view mode toggle */}
          {!showDismissed && !isMobile && (
            <button
              type="button"
              aria-label={viewMode === 'feed' ? 'Switch to timeline view' : 'Switch to feed view'}
              title={viewMode === 'feed' ? 'Timeline view' : 'Feed view'}
              onClick={() => handleModeChange(viewMode === 'feed' ? 'timeline' : 'feed')}
              className="bg-transparent border-0 p-1 flex items-center cursor-pointer text-zinc-500 hover:text-black"
            >
              {viewMode === 'feed' ? (
                /* Timeline icon — horizontal bars with varying indent */
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M2 4h12M4 8h8M6 12h4"/>
                </svg>
              ) : (
                /* Feed/list icon */
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M2 4h12M2 8h12M2 12h12"/>
                </svg>
              )}
            </button>
          )}

          {inboxCount > 0 ? (
            <Link to="/inbox"
              aria-label={`Inbox — ${inboxCount} item${inboxCount !== 1 ? 's' : ''}`}
              className="relative bg-transparent border-0 p-1 flex items-center cursor-pointer text-zinc-500 no-underline"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 4h16v12H4z" />
                <path d="M4 16l4-4h8l4 4" />
              </svg>
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-black text-white text-[0.5rem] font-bold rounded-full flex items-center justify-center leading-none">
                {inboxCount > 9 ? '9+' : inboxCount}
              </span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              aria-label="Refresh feed"
              className="relative bg-transparent border-0 p-1 flex items-center cursor-pointer text-zinc-500 disabled:cursor-default"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={refreshing ? 'animate-spin' : ''}
              >
                <path d="M13.5 2.5A7 7 0 1 0 14.5 9"/>
                <path d="M14.5 2.5v4h-4"/>
              </svg>
            </button>
          )}

          <AccountMenu />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-[40rem] w-full mx-auto px-5 pt-4 pb-24">
        {error && (
          <div className="border-l-2 border-red-500 py-1 pl-3 text-[0.8rem] text-red-600 mb-4">
            {error}
          </div>
        )}

        {!showDismissed && <IntegrationErrorBanner syncStatus={syncStatus} />}

        {!showDismissed && Object.values(syncStatus).some((s) => s.status === 'connected') && (
          <div className="text-[0.7rem] text-zinc-400 mb-2 flex items-center gap-1.5">
            {refreshing ? (
              <>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="animate-spin">
                  <path d="M9 5A4 4 0 1 0 5 1"/>
                </svg>
                Syncing…
              </>
            ) : (
              <span>Auto-sync every 15 min</span>
            )}
          </div>
        )}

        {showDismissed && (
          <div className="flex items-center gap-2 mb-4">
            <Link to="/feed" className="text-[0.7rem] text-zinc-400 hover:text-black no-underline">
              ← Back to feed
            </Link>
            <span className="text-zinc-200">|</span>
            <span className="text-[0.7rem] text-zinc-500">Dismissed items</span>
          </div>
        )}

        {!showDismissed && showAddForm && (
          <AddTaskForm
            onSubmit={async (title, dueAt) => {
              await create(title, dueAt);
              setShowAddForm(false);
            }}
            onCancel={() => setShowAddForm(false)}
          />
        )}

        {loading && (
          <div className="text-zinc-400 text-sm pt-8 text-center">
            Loading…
          </div>
        )}

        {/* Dismissed view */}
        {showDismissed && !loading && (
          <FeedSection
            label="Dismissed"
            items={items}
            emptyMessage="No dismissed items."
            onComplete={completeItem}
            onRestore={restoreItem}
            onPermanentDelete={permanentDeleteItem}
          />
        )}

        {/* Normal feed view */}
        {!showDismissed && !loading && (
          <>
            {isEmpty && <FeedEmptyState hasIntegrations={hasIntegrations} />}

            {items.length > 0 && (() => {
              // Shared feed JSX
              const feedJsx = (
                <>
                  <FeedSection
                    label="Upcoming"
                    items={datedItems}
                    onComplete={completeItem}
                    onDismiss={dismissItem}
                    onEdit={handleItemClick}
                  />
                  <FeedSection
                    label="No Date"
                    items={undatedItems}
                    onComplete={completeItem}
                    onDismiss={dismissItem}
                    onEdit={handleItemClick}
                  />
                </>
              );

              // Shared timeline JSX
              const timelineJsx = (
                <TimelineView
                  groups={timelineGroups}
                  onComplete={completeItem}
                  onDismiss={dismissItem}
                  onEdit={handleItemClick}
                  isOffline={isOffline}
                  lastSyncAt={lastSyncAt}
                  sourceFilter={sourceFilter}
                  availableSources={availableSources}
                  onSourceFilterChange={setSourceFilter}
                />
              );

              // T010 — mobile: swipe container; desktop/web: render based on viewMode
              if (isMobile) {
                return (
                  <>
                    {/* T014 — first-launch swipe hint */}
                    {showSwipeHint && (
                      <div className="flex items-center justify-between mb-3 px-1 py-1.5 bg-zinc-50 border border-zinc-100">
                        <span className="text-[0.7rem] text-zinc-500">
                          Swipe left for timeline view
                        </span>
                        <button
                          type="button"
                          aria-label="Dismiss hint"
                          onClick={() => setShowSwipeHint(false)}
                          className="bg-transparent border-0 p-0 cursor-pointer text-zinc-400 hover:text-zinc-600 leading-none text-base ml-2"
                        >
                          ×
                        </button>
                      </div>
                    )}
                    <TimelineSwipeContainer
                      mode={viewMode}
                      onModeChange={handleModeChange}
                      feedContent={feedJsx}
                      timelineContent={timelineJsx}
                    />
                  </>
                );
              }

              // Desktop / web
              return viewMode === 'timeline' ? timelineJsx : feedJsx;
            })()}

            <CompletedSection items={completed} onUncomplete={uncompleteItem} onClear={clearCompleted} />
          </>
        )}
      </main>

      {/* FAB — Add task (normal feed only) */}
      {!showDismissed && !showAddForm && (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          aria-label="Add task"
          className="fixed bottom-6 right-6 w-12 h-12 bg-black border-0 cursor-pointer flex items-center justify-center shadow-lg z-20"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
            <path d="M9 3v12M3 9h12"/>
          </svg>
        </button>
      )}

      {/* Edit task modal */}
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          onSave={async (id, fields) => {
            if (id.startsWith('sync:')) {
              // For sync items, only due date can be changed via user override
              await setUserDueAt(id, fields.dueAt ?? null);
            } else {
              await update(id, fields);
            }
            setEditingTask(null);
          }}
          onDelete={async (id) => {
            await remove(id);
            setEditingTask(null);
          }}
          onClose={() => setEditingTask(null)}
          onSetDescriptionOverride={setDescriptionOverride}
          onSetTitleOverride={setTitleOverride}
        />
      )}

      {/* Cleared completed toast */}
      {clearedCount !== null && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-zinc-900 text-white text-sm px-4 py-2.5 shadow-lg z-30">
          <span>
            Cleared {clearedCount} completed task{clearedCount !== 1 ? 's' : ''} — find them in{' '}
            <Link to="/feed?showDismissed=true" className="text-zinc-300 underline underline-offset-2 hover:text-white">
              Dismissed Items
            </Link>
          </span>
          <button
            type="button"
            aria-label="Close"
            onClick={clearClearedToast}
            className="text-zinc-500 hover:text-zinc-300 bg-transparent border-0 p-0 cursor-pointer leading-none ml-1"
          >
            ×
          </button>
        </div>
      )}

      {/* Undo toast for dismiss */}
      {undoToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-zinc-900 text-white text-sm px-4 py-2.5 shadow-lg z-30">
          <span>{undoToast.message}</span>
          <button
            type="button"
            onClick={() => restoreItem(undoToast.itemId)}
            className="text-zinc-300 underline underline-offset-2 bg-transparent border-0 p-0 cursor-pointer text-sm hover:text-white"
          >
            Undo
          </button>
          <button
            type="button"
            aria-label="Close"
            onClick={clearUndoToast}
            className="text-zinc-500 hover:text-zinc-300 bg-transparent border-0 p-0 cursor-pointer leading-none ml-1"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default function FeedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <FeedPageContent />
    </Suspense>
  );
}

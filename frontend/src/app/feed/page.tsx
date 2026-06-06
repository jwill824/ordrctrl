// T055 + T061 — Feed page
// T010 — view mode toggle / swipe integration
// T017 — source filter state

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Suspense } from 'react';
import { useFeed } from '@/hooks/useFeed';
import { useNativeTasks } from '@/hooks/useNativeTasks';
import { getUserSettings, updateUserSettings } from '@/services/user.service';
import { usePlannerTimeline } from '@/hooks/usePlannerTimeline';
import { FeedSection } from '@/components/feed/FeedSection';
import { CompletedSection } from '@/components/feed/CompletedSection';
import { IntegrationErrorBanner } from '@/components/feed/IntegrationErrorBanner';
import { FeedEmptyState } from '@/components/feed/FeedEmptyState';
import { AddTaskForm } from '@/components/tasks/AddTaskForm';
import { TaskSheet } from '@/components/tasks/TaskSheet';
import { EditTaskModal } from '@/components/tasks/EditTaskModal';
import { DailyPlannerView, WeeklyPlannerView } from '@/components/timeline';
import { useWeeklyPlanner } from '@/hooks/useWeeklyPlanner';
import { useTaskSheet } from '@/hooks/useTaskSheet';
import { getWeekStart, addDays } from '@/utils/dateUtils';
import type { FeedItem } from '@/services/feed.service';
import type { PlannerItem } from '@/hooks/usePlannerTimeline';
import type { TimelineViewMode } from '@/types/timeline';

type PlannerViewMode = Extract<TimelineViewMode, 'planner' | 'week'>;

function FeedPageContent() {
  const [searchParams] = useSearchParams();
  const showDismissed = searchParams.get('showDismissed') === 'true';

  const {
    items, completed, syncStatus, loading, refreshing, error,
    reloadFeed, completeItem, uncompleteItem, dismissItem, restoreItem,
    permanentDeleteItem, setUserDueAt, setDescriptionOverride, setTitleOverride,
    undoToast, clearUndoToast,
    clearCompleted, clearedCount, clearClearedToast,
    createScheduledTask,
  } = useFeed({ showDismissed });
  const { create, update, remove } = useNativeTasks(reloadFeed);

  const handleReschedule = useCallback(async (taskId: string, newStartAt: string) => {
    if (!taskId.startsWith('native:')) return; // sync items not updatable via tasks API
    await update(taskId, { startAt: newStartAt });
  }, [update]);

  const handleResize = useCallback(async (taskId: string, newDurationMinutes: number) => {
    if (!taskId.startsWith('native:')) return; // sync items not updatable via tasks API
    await update(taskId, { duration: newDurationMinutes });
  }, [update]);

  // ── View mode (T010) ──────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<PlannerViewMode>('planner');
  const [isDragActive, setIsDragActive] = useState(false);
  const settingsLoadedRef = useRef(false);

  useEffect(() => {
    if (settingsLoadedRef.current) return;
    settingsLoadedRef.current = true;
    getUserSettings()
      .then((s) => {
        const stored = s.feedViewMode;
        if (stored === 'planner' || stored === 'week') setViewMode(stored);
        // handles legacy 'feed'/'timeline'/'list' values — defaults to 'planner'
      })
      .catch(() => {/* silently default to 'planner' */});
  }, []);

  const handleModeChange = (mode: PlannerViewMode) => {
    setViewMode(mode);
    updateUserSettings({ feedViewMode: mode }).catch(() => {/* best-effort */});
  };

  // ── Source filter (T017) ──────────────────────────────────────────────────
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);

  const availableSources = useMemo(() => {
    const ids = new Set(items.map((i) => i.serviceId));
    return Array.from(ids).sort();
  }, [items]);

  // ── Weekly planner state ──────────────────────────────────────────────────
  const [plannerDate, setPlannerDate] = useState(() => new Date());
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));

  const { dayMap, weekDays } = useWeeklyPlanner({ items, weekStart, sourceFilter });

  const handleDayTap = (date: Date) => {
    setPlannerDate(date);
    handleModeChange('planner');
  };

  // ── Planner timeline (T04) ────────────────────────────────────────────────
  const { scheduled, unscheduled, allDay, now } = usePlannerTimeline({
    items,
    sourceFilter,
    targetDate: viewMode === 'planner' ? plannerDate : undefined,
  });

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTask, setEditingTask] = useState<FeedItem | null>(null);
  const { isOpen: isSheetOpen, task: sheetTask, mode: sheetMode, openCreate, openEdit, close: closeSheet } = useTaskSheet();

  const quickCreateDefaultStartAt = (() => {
    const d = new Date();
    d.setMinutes(Math.round(d.getMinutes() / 15) * 15, 0, 0);
    return d.toISOString();
  })();

  const handleBlockTap = useCallback((item: PlannerItem) => {
    if (item.id.startsWith('native:')) {
      openEdit(item);
    } else {
      setEditingTask(item as FeedItem);
    }
  }, [openEdit]);

  const hasIntegrations = Object.values(syncStatus).some(
    (s) => s.status === 'connected' || s.status === 'error'
  );
  const isEmpty = items.length === 0 && !loading;

  const handleItemClick = (item: FeedItem) => {
    setEditingTask(item);
  };

  return (
    <>
      {/* Day/Week sub-header toggle */}
      {!showDismissed && (
        <div className="flex items-center justify-center h-11 border-b border-zinc-100 flex-shrink-0 bg-white">
          <div className="flex items-center rounded-full border border-zinc-200 overflow-hidden text-[0.65rem] font-semibold">
            <button
              type="button"
              className={`px-4 py-1.5 border-0 cursor-pointer transition-colors ${viewMode === 'planner' ? 'bg-black text-white' : 'bg-transparent text-zinc-500 hover:text-black'}`}
              onClick={() => setViewMode('planner')}
            >Day</button>
            <button
              type="button"
              className={`px-4 py-1.5 border-0 cursor-pointer transition-colors ${viewMode === 'week' ? 'bg-black text-white' : 'bg-transparent text-zinc-500 hover:text-black'}`}
              onClick={() => setViewMode('week')}
            >Week</button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className={`flex-1 overflow-y-auto ${viewMode === 'week' ? 'overflow-x-auto' : 'overflow-x-hidden'} touch-pan-y`}
        style={{ touchAction: isDragActive ? 'none' : undefined }}
      >
        {/* Weekly view renders full-width outside the narrow main wrapper */}
        {!showDismissed && !loading && viewMode === 'week' && (
          <div className="px-3 pt-4 pb-4">
            <WeeklyPlannerView
              weekDays={weekDays}
              dayMap={dayMap}
              plannerDate={plannerDate}
              onDayTap={handleDayTap}
              weekStart={weekStart}
              onPrevWeek={() => setWeekStart(addDays(weekStart, -7))}
              onNextWeek={() => setWeekStart(addDays(weekStart, 7))}
              onToday={() => setWeekStart(getWeekStart(new Date()))}
              sourceFilter={sourceFilter}
              availableSources={availableSources}
              onSourceFilterChange={setSourceFilter}
            />
          </div>
        )}
        {viewMode !== 'week' && <main className="max-w-[40rem] w-full mx-auto px-5 pt-4 pb-4">
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

        {/* Normal planner view */}
        {!showDismissed && !loading && (
          <>
            {isEmpty && <FeedEmptyState hasIntegrations={hasIntegrations} />}

            {items.length > 0 && (
              <DailyPlannerView
                scheduled={scheduled}
                unscheduled={unscheduled}
                allDay={allDay}
                now={now}
                onComplete={completeItem}
                onDismiss={dismissItem}
                onEdit={handleItemClick}
                onTap={handleBlockTap}
                sourceFilter={sourceFilter}
                availableSources={availableSources}
                onSourceFilterChange={setSourceFilter}
                onReschedule={handleReschedule}
                onResize={handleResize}
                onDragActiveChange={setIsDragActive}
              />
            )}

            <CompletedSection items={completed} onUncomplete={uncompleteItem} onClear={clearCompleted} />
          </>
        )}
      </main>}
      </div>

      {/* FAB — Add task */}
      {!showDismissed && !showAddForm && !isSheetOpen && (
        <button
          type="button"
          onClick={() => viewMode === 'planner' ? openCreate() : setShowAddForm(true)}
          aria-label="Add task"
          className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6 right-6 w-12 h-12 bg-black border-0 cursor-pointer flex items-center justify-center shadow-lg z-20"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
            <path d="M9 3v12M3 9h12"/>
          </svg>
        </button>
      )}

      {/* TaskSheet — create or edit mode */}
      {isSheetOpen && viewMode === 'planner' && (
        <TaskSheet
          task={sheetTask ?? undefined}
          defaultStartAt={sheetTask ? undefined : quickCreateDefaultStartAt}
          defaultDuration={30}
          onSave={async (title, startAt, durationMinutes, isAllDay) => {
            if (sheetMode === 'create') {
              await createScheduledTask(title, startAt, durationMinutes, isAllDay);
            } else if (sheetTask) {
              await update(sheetTask.id, { title, startAt, duration: durationMinutes, isAllDay });
            }
            closeSheet();
            reloadFeed();
          }}
          onDelete={sheetTask ? async () => {
            await remove(sheetTask.id);
            closeSheet();
            reloadFeed();
          } : undefined}
          onCancel={closeSheet}
        />
      )}

      {/* Edit task modal — sync items only */}
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
        <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-zinc-900 text-white text-sm px-4 py-2.5 shadow-lg z-30">
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
        <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-zinc-900 text-white text-sm px-4 py-2.5 shadow-lg z-30">
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
    </>
  );
}

export default function FeedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <FeedPageContent />
    </Suspense>
  );
}

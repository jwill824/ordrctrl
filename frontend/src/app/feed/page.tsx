'use client';

// T055 + T061 — Feed page
// Renders active FeedItem[], CompletedSection, IntegrationErrorBanner[], FeedEmptyState,
// manual Refresh button, sync status row, FAB for AddTaskForm, EditTaskModal for native tasks.

import { useState } from 'react';
import Link from 'next/link';
import { useFeed } from '@/hooks/useFeed';
import { useNativeTasks } from '@/hooks/useNativeTasks';
import { FeedItemRow } from '@/components/feed/FeedItem';
import { CompletedSection } from '@/components/feed/CompletedSection';
import { IntegrationErrorBanner } from '@/components/feed/IntegrationErrorBanner';
import { FeedEmptyState } from '@/components/feed/FeedEmptyState';
import { AddTaskForm } from '@/components/tasks/AddTaskForm';
import { EditTaskModal } from '@/components/tasks/EditTaskModal';
import type { FeedItem } from '@/services/feed.service';

export default function FeedPage() {
  const { items, completed, syncStatus, loading, refreshing, error, refresh, completeItem, uncompleteItem } =
    useFeed();
  const { create, update, remove } = useNativeTasks(refresh);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTask, setEditingTask] = useState<FeedItem | null>(null);

  const hasIntegrations = Object.values(syncStatus).some(
    (s) => s.status === 'connected' || s.status === 'error'
  );
  const isEmpty = items.length === 0 && !loading;

  const handleItemClick = (item: FeedItem) => {
    // Only native tasks are editable via modal
    if (item.id.startsWith('native:')) {
      setEditingTask(item);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top nav */}
      <header className="border-b border-zinc-100 px-5 h-12 flex items-center justify-between sticky top-0 bg-white z-10">
        <span className="text-[0.65rem] font-bold tracking-[0.28em] uppercase text-black">
          ordrctrl
        </span>

        <div className="flex items-center gap-3">
          {/* Refresh button */}
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            aria-label="Refresh feed"
            className="bg-transparent border-0 p-1 flex items-center cursor-pointer text-zinc-500 disabled:cursor-default"
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

          {/* Settings link */}
          <Link
            href="/settings/integrations"
            className="text-zinc-500 no-underline text-xs"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-label="Settings">
              <circle cx="8" cy="8" r="2.5"/>
              <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M2.93 2.93l1.06 1.06M12.01 12.01l1.06 1.06M2.93 13.07l1.06-1.06M12.01 3.99l1.06-1.06"/>
            </svg>
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-[40rem] w-full mx-auto px-5 pt-4 pb-24">
        {/* Error banner */}
        {error && (
          <div className="border-l-2 border-red-500 py-1 pl-3 text-[0.8rem] text-red-600 mb-4">
            {error}
          </div>
        )}

        {/* Integration error banners */}
        <IntegrationErrorBanner syncStatus={syncStatus} />

        {/* Sync status row */}
        {Object.values(syncStatus).some((s) => s.status === 'connected') && (
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

        {/* Add task form (shown inline when FAB clicked) */}
        {showAddForm && (
          <AddTaskForm
            onSubmit={async (title, dueAt) => {
              await create(title, dueAt);
              setShowAddForm(false);
            }}
            onCancel={() => setShowAddForm(false)}
          />
        )}

        {/* Loading state */}
        {loading && (
          <div className="text-zinc-400 text-sm pt-8 text-center">
            Loading…
          </div>
        )}

        {/* Empty state */}
        {isEmpty && <FeedEmptyState hasIntegrations={hasIntegrations} />}

        {/* Feed items */}
        {!loading && items.length > 0 && (
          <div>
            {items.map((item) => (
              <FeedItemRow
                key={item.id}
                item={item}
                onComplete={completeItem}
                onClick={item.id.startsWith('native:') ? handleItemClick : undefined}
              />
            ))}
          </div>
        )}

        {/* Completed section */}
        <CompletedSection items={completed} onUncomplete={uncompleteItem} />
      </main>

      {/* Floating Action Button — Add task */}
      {!showAddForm && (
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
            await update(id, fields);
            setEditingTask(null);
          }}
          onDelete={async (id) => {
            await remove(id);
            setEditingTask(null);
          }}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  );
}

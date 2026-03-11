'use client';

// T055 + T061 — Feed page
// Renders active FeedItem[], CompletedSection, IntegrationErrorBanner[], FeedEmptyState,
// manual Refresh button, sync status row, FAB for AddTaskForm, EditTaskModal for native tasks.

import { useState } from 'react';
import Link from 'next/link';
import { useFeed } from '@/hooks/useFeed';
import { useNativeTasks } from '@/hooks/useNativeTasks';
import { useInboxCount } from '@/hooks/useInboxCount';
import { FeedItemRow } from '@/components/feed/FeedItem';
import { CompletedSection } from '@/components/feed/CompletedSection';
import { IntegrationErrorBanner } from '@/components/feed/IntegrationErrorBanner';
import { FeedEmptyState } from '@/components/feed/FeedEmptyState';
import { AddTaskForm } from '@/components/tasks/AddTaskForm';
import { EditTaskModal } from '@/components/tasks/EditTaskModal';
import { TriageSheet } from '@/components/feed/TriageSheet';
import { AccountMenu } from '@/components/AccountMenu';
import type { FeedItem } from '@/services/feed.service';

export default function FeedPage() {
  const {
    items, completed, syncStatus, loading, refreshing, error,
    refresh, reloadFeed, completeItem, uncompleteItem, dismissItem, restoreItem,
    undoToast, clearUndoToast,
    pendingItems, isTriageOpen, triageLoading,
    closeTriage, acceptTriage, dismissTriageItem, dismissAllTriage,
    clearCompleted, clearedCount, clearClearedToast,
  } = useFeed();
  const { create, update, remove } = useNativeTasks(reloadFeed);
  const { inboxCount } = useInboxCount();

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
          {/* Inbox link (shown when inbox has items) or Refresh button */}
          {inboxCount > 0 ? (
            <Link
              href="/inbox"
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
              disabled={triageLoading}
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
                className={triageLoading ? 'animate-spin' : ''}
              >
                <path d="M13.5 2.5A7 7 0 1 0 14.5 9"/>
                <path d="M14.5 2.5v4h-4"/>
              </svg>
            </button>
          )}

          {/* Settings link */}
          <AccountMenu />
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
            {triageLoading ? (
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
                onDismiss={dismissItem}
                onClick={item.id.startsWith('native:') ? handleItemClick : undefined}
              />
            ))}
          </div>
        )}

        {/* Completed section */}
        <CompletedSection items={completed} onUncomplete={uncompleteItem} onClear={clearCompleted} />
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

      {/* T007 — Cleared completed toast */}
      {clearedCount !== null && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-zinc-900 text-white text-sm px-4 py-2.5 shadow-lg z-30">
          <span>
            Cleared {clearedCount} completed task{clearedCount !== 1 ? 's' : ''} — find them in{' '}
            <Link href="/settings/dismissed" className="text-zinc-300 underline underline-offset-2 hover:text-white">
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

      {/* T017 — Undo toast for dismiss */}
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
      {/* T036/T037 — Triage sheet: review new items on refresh */}
      <TriageSheet
        isOpen={isTriageOpen}
        loading={triageLoading}
        items={pendingItems}
        onClose={closeTriage}
        onAcceptAll={acceptTriage}
        onDismissAll={dismissAllTriage}
        onDismissItem={dismissTriageItem}
      />
    </div>
  );
}

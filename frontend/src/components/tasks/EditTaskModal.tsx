'use client';

// T060 — EditTaskModal component
// For native tasks: edit title + due date, delete.
// For sync items: edit user due date override + description override; show "(override)" when applied.

import { useState, useEffect } from 'react';
import type { FeedItem } from '@/services/feed.service';
import { buildSourceLinkHandler } from '@/hooks/useSourceLink';

const SOURCE_LABEL_MAP: Record<string, string> = {
  gmail: 'Open in Gmail',
  microsoft_tasks: 'Open in To Do',
  apple_calendar: 'Open in Calendar',
  apple_reminders: 'Open in Reminders',
};

interface EditTaskModalProps {
  task: FeedItem;
  onSave: (id: string, fields: { title?: string; dueAt?: string | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
  onSetDescriptionOverride?: (id: string, value: string | null) => Promise<void>;
}

export function EditTaskModal({ task, onSave, onDelete, onClose, onSetDescriptionOverride }: EditTaskModalProps) {
  const isSyncItem = task.id.startsWith('sync:') && task.serviceId !== 'ordrctrl';
  const [title, setTitle] = useState(task.title);
  const [dueAt, setDueAt] = useState(
    task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 16) : ''
  );
  const [description, setDescription] = useState(task.description ?? '');
  const [showOriginal, setShowOriginal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(task.title);
    setDueAt(task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 16) : '');
    setDescription(task.description ?? '');
  }, [task]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSyncItem && !title.trim()) return;
    setError(null);
    setSaving(true);
    try {
      const isoDate = dueAt ? new Date(dueAt).toISOString() : null;
      if (isSyncItem && onSetDescriptionOverride) {
        // Save description override: if textarea is empty, clear override; otherwise set it
        const descValue = description.trim() || null;
        await onSetDescriptionOverride(task.id, descValue);
      }
      await onSave(task.id, { title: title.trim(), dueAt: isoDate });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleClearDate = async () => {
    setError(null);
    setSaving(true);
    try {
      await onSave(task.id, { dueAt: null });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this task?')) return;
    setDeleting(true);
    try {
      await onDelete(task.id);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const sourceLabel = task.serviceId ? (SOURCE_LABEL_MAP[task.serviceId] ?? 'Open Source') : null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-[24rem] p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[0.7rem] font-bold uppercase tracking-[0.1em] text-zinc-400">
            {isSyncItem ? 'Edit task' : 'Edit task'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="bg-transparent border-0 cursor-pointer p-0 text-zinc-400 flex"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 3l10 10M13 3L3 13"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {!isSyncItem && (
            <div>
              <label htmlFor="edit-title" className="block text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-zinc-400 mb-1.5">Title</label>
              <input
                id="edit-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={500}
                autoFocus
                className="w-full border border-zinc-300 bg-white py-2.5 px-3 text-[0.9rem] text-black outline-none transition-colors focus:border-black placeholder:text-zinc-400"
              />
            </div>
          )}

          {isSyncItem && (
            <p className="text-[0.75rem] text-zinc-500">
              <span className="font-semibold text-zinc-800">{task.title}</span>
              <br />
              <span className="mt-1 block">
                Assign a local due date — won&apos;t update the source service.
                {task.hasUserDueAt && (
                  <span className="ml-1 text-zinc-400">(override active)</span>
                )}
              </span>
            </p>
          )}

          {isSyncItem && (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <label htmlFor="edit-description" className="block text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-zinc-400">
                  Description
                </label>
                {task.hasDescriptionOverride && (
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.08em] bg-zinc-100 text-zinc-500 rounded">
                    Edited
                  </span>
                )}
              </div>
              <textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={50000}
                placeholder={task.originalBody ?? 'Add a personal note…'}
                className="w-full border border-zinc-300 bg-white py-2.5 px-3 text-[0.9rem] text-black outline-none transition-colors focus:border-black placeholder:text-zinc-400 resize-y"
              />
              {task.hasDescriptionOverride && task.originalBody && (
                <div className="mt-1.5">
                  <button
                    type="button"
                    onClick={() => setShowOriginal((v) => !v)}
                    className="text-[0.7rem] text-zinc-400 hover:text-zinc-600 underline cursor-pointer bg-transparent border-0 p-0"
                  >
                    {showOriginal ? 'Hide original' : 'Show original'}
                  </button>
                  {showOriginal && (
                    <p className="mt-1 text-[0.8rem] text-zinc-500 whitespace-pre-wrap border-l-2 border-zinc-200 pl-2">
                      {task.originalBody}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label htmlFor="edit-due" className="block text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-zinc-400 mb-1.5">
              Due date {isSyncItem ? '' : '(optional)'}
            </label>
            <input
              id="edit-due"
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              autoFocus={isSyncItem && !task.description}
              className="w-full border border-zinc-300 bg-white py-2.5 px-3 text-[0.9rem] text-black outline-none transition-colors focus:border-black placeholder:text-zinc-400"
            />
          </div>

          {/* Source link — only shown when a URL is available.
              TODO: add deep links when iOS/native support lands. */}
          {isSyncItem && sourceLabel && task.sourceUrl && (
            <a
              href={task.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={buildSourceLinkHandler(task.serviceId, task.sourceUrl) ?? undefined}
              className="inline-flex items-center gap-1.5 text-[0.75rem] text-zinc-500 hover:text-zinc-800 underline"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V7"/>
                <path d="M8 1h3m0 0v3m0-3L5 7"/>
              </svg>
              {sourceLabel}
            </a>
          )}

          {error && <p className="border-l-2 border-red-500 py-1 pl-3 text-[0.8rem] text-red-600">{error}</p>}

          <div className="flex gap-2 mt-1">
            <button
              type="submit"
              disabled={saving || (!isSyncItem && !title.trim())}
              className="flex-1 bg-black text-white py-3 px-4 text-[0.7rem] font-bold uppercase tracking-[0.12em] cursor-pointer transition-colors hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed border-0"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>

            {isSyncItem && task.hasUserDueAt && (
              <button
                type="button"
                disabled={saving}
                onClick={handleClearDate}
                className="w-auto px-4 py-3 border border-zinc-200 bg-white text-zinc-600 text-sm font-medium cursor-pointer transition-colors hover:border-zinc-400 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Clear
              </button>
            )}

            {!isSyncItem && (
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="w-auto px-4 py-3 border border-red-200 bg-white text-red-600 text-sm font-medium cursor-pointer transition-colors hover:border-red-500 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleting ? '…' : 'Delete'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

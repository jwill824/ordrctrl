'use client';

// T060 — EditTaskModal component
// Pre-filled title and due date, save and delete actions

import { useState, useEffect } from 'react';
import type { FeedItem } from '@/services/feed.service';

interface EditTaskModalProps {
  task: FeedItem;
  onSave: (id: string, fields: { title?: string; dueAt?: string | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}

export function EditTaskModal({ task, onSave, onDelete, onClose }: EditTaskModalProps) {
  const [title, setTitle] = useState(task.title);
  const [dueAt, setDueAt] = useState(
    task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 16) : ''
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when task changes
  useEffect(() => {
    setTitle(task.title);
    setDueAt(task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 16) : '');
  }, [task]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);
    setSaving(true);
    try {
      const isoDate = dueAt ? new Date(dueAt).toISOString() : null;
      await onSave(task.id, { title: title.trim(), dueAt: isoDate });
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

  return (
    // Backdrop
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
    >
      {/* Modal card */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-[24rem] p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[0.7rem] font-bold uppercase tracking-[0.1em] text-zinc-400">
            Edit task
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

          <div>
            <label htmlFor="edit-due" className="block text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-zinc-400 mb-1.5">Due date (optional)</label>
            <input
              id="edit-due"
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="w-full border border-zinc-300 bg-white py-2.5 px-3 text-[0.9rem] text-black outline-none transition-colors focus:border-black placeholder:text-zinc-400"
            />
          </div>

          {error && <p className="border-l-2 border-red-500 py-1 pl-3 text-[0.8rem] text-red-600">{error}</p>}

          <div className="flex gap-2 mt-1">
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="flex-1 bg-black text-white py-3 px-4 text-[0.7rem] font-bold uppercase tracking-[0.12em] cursor-pointer transition-colors hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed border-0"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={handleDelete}
              className="w-auto px-4 py-3 border border-red-200 bg-white text-red-600 text-sm font-medium cursor-pointer transition-colors hover:border-red-500 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {deleting ? '…' : 'Delete'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

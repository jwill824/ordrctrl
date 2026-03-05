'use client';

// T059 — AddTaskForm component
// Title (required), optional due date, submit action

import { useState } from 'react';

interface AddTaskFormProps {
  onSubmit: (title: string, dueAt?: string | null) => Promise<void>;
  onCancel: () => void;
}

export function AddTaskForm({ onSubmit, onCancel }: AddTaskFormProps) {
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);
    setLoading(true);
    try {
      // Convert local datetime string to ISO 8601
      const isoDate = dueAt ? new Date(dueAt).toISOString() : null;
      await onSubmit(title.trim(), isoDate);
      setTitle('');
      setDueAt('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-zinc-300 p-4 mb-4"
    >
      <div className="flex flex-col gap-3">
        <div>
          <label htmlFor="task-title" className="block text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-zinc-400 mb-1.5">
            Task
          </label>
          <input
            id="task-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            required
            maxLength={500}
            autoFocus
            className="w-full border border-zinc-300 bg-white py-2.5 px-3 text-[0.9rem] text-black outline-none transition-colors focus:border-black placeholder:text-zinc-400"
          />
        </div>

        <div>
          <label htmlFor="task-due" className="block text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-zinc-400 mb-1.5">
            Due date (optional)
          </label>
          <input
            id="task-due"
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="w-full border border-zinc-300 bg-white py-2.5 px-3 text-[0.9rem] text-black outline-none transition-colors focus:border-black placeholder:text-zinc-400"
          />
        </div>

        {error && <p className="border-l-2 border-red-500 py-1 pl-3 text-[0.8rem] text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button type="submit" disabled={loading || !title.trim()} className="flex-1 bg-black text-white py-3 px-4 text-[0.7rem] font-bold uppercase tracking-[0.12em] cursor-pointer transition-colors hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed border-0">
            {loading ? 'Adding…' : 'Add task'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 w-auto px-4 border border-zinc-300 bg-white py-[0.65rem] text-sm font-medium text-black cursor-pointer transition-colors hover:border-black hover:bg-zinc-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

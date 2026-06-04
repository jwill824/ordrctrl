'use client';

import { useState } from 'react';

interface QuickCreateSheetProps {
  onSubmit: (title: string, startAt: string, duration: number) => Promise<void>;
  onCancel: () => void;
  defaultStartAt: string;
  defaultDuration?: number;
}

function toDatetimeLocalValue(isoString: string): string {
  const d = new Date(isoString);
  // Format: YYYY-MM-DDTHH:mm (local time, no seconds)
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    '-' +
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate()) +
    'T' +
    pad(d.getHours()) +
    ':' +
    pad(d.getMinutes())
  );
}

export function QuickCreateSheet({
  onSubmit,
  onCancel,
  defaultStartAt,
  defaultDuration = 30,
}: QuickCreateSheetProps) {
  const [title, setTitle] = useState('');
  const [startAt, setStartAt] = useState(() => toDatetimeLocalValue(defaultStartAt));
  const [duration, setDuration] = useState(defaultDuration);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (duration < 1) return;
    setError(null);
    setLoading(true);
    try {
      const utcIso = new Date(startAt).toISOString();
      await onSubmit(title.trim(), utcIso, duration);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[40rem] bg-white border-t border-zinc-200 px-4 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
      >
        <div className="flex flex-col gap-3">
          <div>
            <label
              htmlFor="qcs-title"
              className="block text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-zinc-400 mb-1.5"
            >
              Task
            </label>
            <input
              id="qcs-title"
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
            <label
              htmlFor="qcs-start"
              className="block text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-zinc-400 mb-1.5"
            >
              Start time
            </label>
            <input
              id="qcs-start"
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="w-full border border-zinc-300 bg-white py-2.5 px-3 text-[0.9rem] text-black outline-none transition-colors focus:border-black"
            />
          </div>

          <div>
            <label
              htmlFor="qcs-duration"
              className="block text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-zinc-400 mb-1.5"
            >
              Duration (minutes)
            </label>
            <input
              id="qcs-duration"
              type="number"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              min={1}
              max={480}
              className="w-full border border-zinc-300 bg-white py-2.5 px-3 text-[0.9rem] text-black outline-none transition-colors focus:border-black"
            />
          </div>

          {error && (
            <p className="border-l-2 border-red-500 py-1 pl-3 text-[0.8rem] text-red-600">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || !title.trim() || duration < 1}
              className="flex-1 bg-black text-white py-3 px-4 text-[0.7rem] font-bold uppercase tracking-[0.12em] cursor-pointer transition-colors hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed border-0"
            >
              {loading ? 'Adding…' : 'Add to timeline'}
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
    </div>
  );
}

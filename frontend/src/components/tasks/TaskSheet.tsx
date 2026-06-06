'use client';

import { useState, useRef } from 'react';
import { TimeSlotPicker } from '@/components/tasks/TimeSlotPicker';
import { DurationPicker } from '@/components/tasks/DurationPicker';
import { timeToSlotValue, slotValueToMinutes } from '@/utils/timeSlots';
import { useTimeFormat } from '@/hooks/useTimeFormat';
import type { PlannerItem } from '@/hooks/usePlannerTimeline';

interface TaskSheetProps {
  task?: PlannerItem;
  defaultStartAt?: string;
  defaultDuration?: number;
  onSave: (title: string, startAt: string, durationMinutes: number, isAllDay: boolean) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel: () => void;
}

export function TaskSheet({
  task,
  defaultStartAt,
  defaultDuration = 30,
  onSave,
  onDelete,
  onCancel,
}: TaskSheetProps) {
  const isEditMode = !!task;
  const refStartAt = task?.startAt ?? defaultStartAt ?? new Date().toISOString();

  const { use12h, toggle: toggleTimeFormat } = useTimeFormat();

  const [title, setTitle] = useState(task?.title ?? '');
  const [slotValue, setSlotValue] = useState(() => timeToSlotValue(refStartAt));
  const [durationMinutes, setDurationMinutes] = useState(task?.durationMinutes ?? defaultDuration);
  const [isAllDay, setIsAllDay] = useState(task?.isAllDay ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const touchStartYRef = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientY - touchStartYRef.current;
    if (delta > 60) onCancel();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (!isAllDay && durationMinutes < 1) return;
    setError(null);
    setLoading(true);
    try {
      const refDate = new Date(refStartAt);
      const totalMinutes = slotValueToMinutes(slotValue);
      const newStartAt = new Date(refDate);
      newStartAt.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
      await onSave(title.trim(), newStartAt.toISOString(), durationMinutes, isAllDay);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = () => {
    setConfirmDelete(true);
  };

  const handleDeleteConfirm = async () => {
    if (!onDelete) return;
    setError(null);
    setLoading(true);
    try {
      await onDelete();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className="relative w-full max-w-[40rem] bg-white border-t border-zinc-200 rounded-t-xl px-4 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom))] shadow-xl"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Swipe handle */}
        <div className="w-10 h-1 rounded-full bg-zinc-300 mx-auto mb-4" />

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Title */}
          <div>
            <label
              htmlFor="ts-title"
              className="block text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-zinc-400 mb-1.5"
            >
              Task
            </label>
            <input
              id="ts-title"
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

          {/* All-day toggle */}
          <div className="flex items-center justify-between">
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-zinc-400">
              All day
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isAllDay}
              aria-label="Toggle all-day task"
              onClick={() => setIsAllDay((v) => !v)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                isAllDay ? 'bg-black' : 'bg-zinc-200'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                  isAllDay ? 'translate-x-[18px]' : 'translate-x-[3px]'
                }`}
              />
            </button>
          </div>

          {/* Time slot + duration (hidden when all-day) */}
          {!isAllDay && (
            <>
              {/* Start time / time slot picker */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-zinc-400">
                    Time slot
                  </label>
                  <button
                    type="button"
                    onClick={toggleTimeFormat}
                    className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] px-2 py-0.5 border border-zinc-200 bg-white text-zinc-500 hover:border-zinc-400 transition-colors"
                    aria-label={use12h ? 'Switch to 24-hour format' : 'Switch to 12-hour format'}
                  >
                    {use12h ? '12h' : '24h'}
                  </button>
                </div>
                <TimeSlotPicker value={slotValue} onChange={setSlotValue} durationMinutes={durationMinutes} use12h={use12h} />
              </div>

              {/* Duration picker */}
              <div>
                <label className="block text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-zinc-400 mb-1.5">
                  Duration
                </label>
                <DurationPicker value={durationMinutes} onChange={setDurationMinutes} />
              </div>
            </>
          )}

          {error && (
            <p className="border-l-2 border-red-500 py-1 pl-3 text-[0.8rem] text-red-600">
              {error}
            </p>
          )}

          {/* Save / Cancel */}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="flex-1 bg-black text-white py-3 px-4 text-[0.7rem] font-bold uppercase tracking-[0.12em] cursor-pointer transition-colors hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed border-0"
            >
              {loading ? 'Saving…' : isEditMode ? 'Save changes' : 'Add to timeline'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="shrink-0 px-4 border border-zinc-300 bg-white py-[0.65rem] text-sm font-medium text-black cursor-pointer transition-colors hover:border-black hover:bg-zinc-50"
            >
              Cancel
            </button>
          </div>

          {/* Delete (edit mode only) */}
          {isEditMode && !confirmDelete && (
            <button
              type="button"
              aria-label="Delete task"
              onClick={handleDeleteClick}
              className="w-full border border-red-200 text-red-600 bg-white py-2.5 text-[0.7rem] font-bold uppercase tracking-[0.12em] cursor-pointer transition-colors hover:border-red-400 hover:bg-red-50"
            >
              Delete
            </button>
          )}

          {/* Delete confirm step */}
          {isEditMode && confirmDelete && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={loading}
                className="flex-1 bg-red-600 text-white py-2.5 text-[0.7rem] font-bold uppercase tracking-[0.12em] cursor-pointer transition-colors hover:bg-red-700 disabled:opacity-40 border-0"
              >
                {loading ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="flex-1 border border-zinc-300 bg-white py-2.5 text-[0.7rem] font-medium text-black cursor-pointer transition-colors hover:border-black hover:bg-zinc-50"
              >
                Cancel
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

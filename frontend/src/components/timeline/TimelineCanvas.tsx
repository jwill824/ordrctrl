'use client';

import { useEffect, useRef } from 'react';
import type { PlannerItem } from '@/hooks/usePlannerTimeline';
import type { FeedItem } from '@/services/feed.service';
import { FeedItemRow } from '@/components/feed/FeedItem';
import { DraggableTimeBlock } from './DraggableTimeBlock';
import { WEEK_HOUR_MARKERS } from './timelineConstants';

const DAY_ABBRS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isToday(d: Date): boolean {
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export interface TimelineCanvasProps {
  columns: 1 | 7;
  hourHeight: number;
  now: Date;

  // Day mode data
  scheduled?: PlannerItem[];
  unscheduled?: FeedItem[];
  allDay?: FeedItem[];

  // Week mode data
  weekDays?: Date[];
  dayMap?: Map<string, PlannerItem[]>;
  onDayTap?: (date: Date) => void;

  // Drag callbacks (both modes)
  onReschedule?: (taskId: string, newStartAt: string) => Promise<void>;
  onResize?: (taskId: string, newDurationMinutes: number) => Promise<void>;
  onDragActiveChange?: (active: boolean) => void;
  onTap?: (item: PlannerItem) => void;

  // Day-mode actions
  onComplete?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onEdit?: (item: FeedItem) => void;

  // Source filter
  sourceFilter?: string | null;
  availableSources?: string[];
  onSourceFilterChange?: (source: string | null) => void;
}

export function TimelineCanvas({
  columns,
  hourHeight,
  now,
  scheduled = [],
  unscheduled = [],
  allDay = [],
  weekDays = [],
  dayMap = new Map(),
  onDayTap,
  onReschedule = async () => {},
  onResize = async () => {},
  onDragActiveChange,
  onTap,
  onComplete,
  onDismiss,
  onEdit,
  sourceFilter,
  availableSources,
  onSourceFilterChange,
}: TimelineCanvasProps) {
  const currentTimeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    currentTimeRef.current?.scrollIntoView({ block: 'center' });
  }, []);

  const isWeekMode = columns === 7;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowTop = (nowMinutes / 60) * hourHeight;
  const totalHeight = 24 * hourHeight;

  return (
    <div>
      {/* Source filter pills */}
      {availableSources && availableSources.length > 1 && onSourceFilterChange && (
        <div className="flex items-center gap-1.5 mb-4 flex-wrap">
          <button
            type="button"
            onClick={() => onSourceFilterChange(null)}
            className={`text-[0.65rem] font-semibold uppercase tracking-[0.08em] px-2 py-1 border transition-colors ${
              !sourceFilter
                ? 'border-black bg-black text-white'
                : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-400'
            }`}
          >
            All
          </button>
          {availableSources.map((src) => (
            <button
              key={src}
              type="button"
              onClick={() => onSourceFilterChange(src)}
              className={`text-[0.65rem] font-semibold uppercase tracking-[0.08em] px-2 py-1 border transition-colors ${
                sourceFilter === src
                  ? 'border-black bg-black text-white'
                  : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-400'
              }`}
            >
              {src}
            </button>
          ))}
        </div>
      )}

      {/* All-day banner (day mode only) */}
      {!isWeekMode && allDay.length > 0 && (
        <div className="mb-3 border border-zinc-100 bg-zinc-50 px-3 py-2">
          <div className="text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-zinc-400 mb-1.5">
            All day
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allDay.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-1.5 border border-zinc-200 bg-white px-2.5 py-1 text-[0.7rem] font-medium text-black"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-black shrink-0" />
                <span>{item.title}</span>
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(item)}
                    className="ml-1 text-zinc-400 hover:text-black transition-colors"
                    aria-label={`Edit ${item.title}`}
                  >
                    ✎
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Day mode ─────────────────────────────────────────────────────── */}
      {!isWeekMode && (
        <div className="flex overflow-x-hidden" style={{ height: totalHeight }}>
          {/* Time axis — fixed 48px width */}
          <div className="relative shrink-0" style={{ width: 48 }}>
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className="absolute left-0 right-0 border-t border-zinc-100"
                style={{ top: h * hourHeight }}
              >
                <span className="absolute right-2 top-[-0.6rem] text-[0.65rem] text-zinc-400 leading-none select-none">
                  {h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`}
                </span>
              </div>
            ))}
          </div>

          {/* Task column — flex-1 */}
          <div className="relative flex-1" style={{ height: totalHeight }}>
            {/* Current-time indicator */}
            <div
              ref={currentTimeRef}
              className="absolute left-0 right-0 z-10 pointer-events-none"
              style={{ top: nowTop }}
            >
              <div className="absolute left-0 right-2 h-px bg-red-500" />
              <div className="absolute left-[-4px] w-2 h-2 rounded-full bg-red-500 -translate-y-[3px]" />
            </div>

            {/* Scheduled task blocks */}
            {scheduled.map((item) => (
              <DraggableTimeBlock
                key={item.id}
                item={item}
                hourHeight={hourHeight}
                onReschedule={onReschedule}
                onResize={onResize}
                onDragActiveChange={onDragActiveChange}
                onTap={() => onTap?.(item)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Week mode ────────────────────────────────────────────────────── */}
      {isWeekMode && (
        <div className="flex" style={{ height: totalHeight }}>
          {weekDays.map((day, idx) => {
            const key = dayKey(day);
            const items = dayMap.get(key) ?? [];
            const today = isToday(day);
            const isFirst = idx === 0;

            return (
              <div
                key={key}
                className={[
                  'flex-1 transition-all duration-200 ease flex flex-col',
                  today ? 'bg-zinc-50' : '',
                  isFirst ? '' : 'border-l border-zinc-100',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {/* Column header */}
                <button
                  type="button"
                  onClick={() => onDayTap?.(day)}
                  className={[
                    'h-7 shrink-0 flex items-center justify-center text-[0.6rem] leading-tight border-t-2 w-full',
                    today
                      ? 'border-black font-bold text-black'
                      : 'border-transparent text-zinc-500 hover:text-black',
                  ].join(' ')}
                >
                  {DAY_ABBRS[day.getDay()]} {day.getDate()}
                </button>

                {/* Time axis + blocks */}
                <div className="relative flex-1">
                  {/* Sparse hour markers (labels on first column only) */}
                  {WEEK_HOUR_MARKERS.map((h) => (
                    <div
                      key={h}
                      className="absolute left-0 right-0 border-t border-zinc-100"
                      style={{ top: h * hourHeight }}
                    >
                      {isFirst && (
                        <span className="absolute left-0.5 top-[-0.55rem] text-[0.6rem] text-zinc-300 leading-none select-none">
                          {h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`}
                        </span>
                      )}
                    </div>
                  ))}

                  {/* Auto-scroll anchor in today column */}
                  {today && (
                    <div
                      ref={currentTimeRef}
                      className="absolute pointer-events-none"
                      style={{ top: nowTop }}
                    />
                  )}

                  {/* Task blocks */}
                  {items.map((item) => (
                    <DraggableTimeBlock
                      key={item.id}
                      item={item}
                      hourHeight={hourHeight}
                      compact
                      onReschedule={onReschedule}
                      onResize={onResize}
                      onDragActiveChange={onDragActiveChange}
                      onTap={() => onTap?.(item)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Unscheduled section (day mode only) */}
      {!isWeekMode && unscheduled.length > 0 && (
        <div className="mt-6">
          <div className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-zinc-400 pb-1 mb-1 border-b border-zinc-100">
            Unscheduled
          </div>
          {unscheduled.map((item) => (
            <FeedItemRow
              key={item.id}
              item={item}
              onComplete={onComplete ?? (() => {})}
              onDismiss={onDismiss}
              onClick={onEdit ? () => onEdit(item) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

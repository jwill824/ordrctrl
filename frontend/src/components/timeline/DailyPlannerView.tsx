'use client';

import { useEffect, useRef } from 'react';
import type { PlannerItem } from '@/hooks/usePlannerTimeline';
import type { FeedItem } from '@/services/feed.service';
import { FeedItemRow } from '@/components/feed/FeedItem';
import { DraggableTimeBlock } from './DraggableTimeBlock';
import { PX_PER_HOUR } from './timelineConstants';

interface DailyPlannerViewProps {
  scheduled: PlannerItem[];
  unscheduled: FeedItem[];
  now: Date;
  onComplete: (id: string) => void;
  onDismiss?: (id: string) => void;
  onEdit?: (item: FeedItem) => void;
  sourceFilter?: string | null;
  availableSources?: string[];
  onSourceFilterChange?: (source: string | null) => void;
  onReschedule?: (taskId: string, newStartAt: string) => Promise<void>;
  onResize?: (taskId: string, newDurationMinutes: number) => Promise<void>;
  onDragActiveChange?: (active: boolean) => void;
}

export function DailyPlannerView({
  scheduled,
  unscheduled,
  now,
  onComplete,
  onDismiss,
  onEdit,
  sourceFilter,
  availableSources,
  onSourceFilterChange,
  onReschedule = async () => {},
  onResize = async () => {},
  onDragActiveChange,
}: DailyPlannerViewProps) {
  const currentTimeRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to current time on mount
  useEffect(() => {
    currentTimeRef.current?.scrollIntoView({ block: 'center' });
  }, []);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowTop = (nowMinutes / 60) * PX_PER_HOUR;

  return (
    <div style={{ ['--hour-height' as string]: `${PX_PER_HOUR}px` }}>
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

      {/* 24-hour time axis */}
      <div
        className="relative w-full overflow-x-hidden"
        style={{ height: `${24 * PX_PER_HOUR}px` }}
      >
        {/* Hour markers */}
        {Array.from({ length: 24 }, (_, h) => (
          <div
            key={h}
            className="absolute left-0 right-0 border-t border-zinc-100"
            style={{ top: h * PX_PER_HOUR }}
          >
            <span className="absolute left-0 top-[-0.6rem] w-12 text-right pr-2 text-[0.65rem] text-zinc-400 leading-none select-none">
              {h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`}
            </span>
          </div>
        ))}

        {/* Current-time indicator */}
        <div
          ref={currentTimeRef}
          className="absolute left-0 right-0 z-10 pointer-events-none"
          style={{ top: nowTop }}
        >
          <div className="absolute left-12 right-0 h-px bg-red-500" />
          <div className="absolute left-11 w-2 h-2 rounded-full bg-red-500 -translate-y-[3px]" />
        </div>

        {/* Scheduled task blocks */}
        {scheduled.map((item) => (
          <DraggableTimeBlock
            key={item.id}
            item={item}
            hourHeight={PX_PER_HOUR}
            onReschedule={onReschedule}
            onResize={onResize}
            onDragActiveChange={onDragActiveChange}
          />
        ))}
      </div>

      {/* Unscheduled section */}
      {unscheduled.length > 0 && (
        <div className="mt-6">
          <div className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-zinc-400 pb-1 mb-1 border-b border-zinc-100">
            Unscheduled
          </div>
          {unscheduled.map((item) => (
            <FeedItemRow
              key={item.id}
              item={item}
              onComplete={onComplete}
              onDismiss={onDismiss}
              onClick={onEdit ? () => onEdit(item) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

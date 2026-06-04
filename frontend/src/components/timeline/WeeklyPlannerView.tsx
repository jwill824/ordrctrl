'use client';

import type { PlannerItem } from '@/hooks/usePlannerTimeline';
import { PlannerTimeBlock } from './PlannerTimeBlock';

const WEEKLY_HOUR_HEIGHT = 24;
const WEEK_COLUMN_TOTAL_HEIGHT = WEEKLY_HOUR_HEIGHT * 24;
const WEEK_HOUR_MARKERS = [0, 6, 12, 18];

const DAY_ABBRS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface WeeklyPlannerViewProps {
  weekDays: Date[];
  dayMap: Map<string, PlannerItem[]>;
  plannerDate: Date;
  onDayTap: (date: Date) => void;
  sourceFilter?: string | null;
  availableSources?: string[];
  onSourceFilterChange?: (source: string | null) => void;
}

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

export function WeeklyPlannerView({
  weekDays,
  dayMap,
  plannerDate,
  onDayTap,
  sourceFilter,
  availableSources,
  onSourceFilterChange,
}: WeeklyPlannerViewProps) {
  return (
    <div>
      {/* Source filter pills */}
      {availableSources && availableSources.length > 1 && onSourceFilterChange && (
        <div className="flex items-center gap-1.5 mb-4 flex-wrap">
          <button
            type="button"
            onClick={() => onSourceFilterChange(null)}
            className={`text-[0.65rem] font-bold uppercase tracking-[0.08em] px-2 py-1 border transition-colors ${
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
              className={`text-[0.65rem] font-bold uppercase tracking-[0.08em] px-2 py-1 border transition-colors ${
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

      {/* Horizontal scroll canvas */}
      <div
        className="flex overflow-x-auto"
        style={{
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {weekDays.map((day) => {
          const key = dayKey(day);
          const items = dayMap.get(key) ?? [];
          const today = isToday(day);

          return (
            <div
              key={key}
              className="flex-shrink-0 w-28"
              style={{ scrollSnapAlign: 'start' }}
            >
              {/* Column header */}
              <button
                type="button"
                onClick={() => onDayTap(day)}
                className={`w-full text-center py-2 text-[0.65rem] leading-tight ${
                  today ? 'font-bold underline text-black' : 'text-zinc-500'
                }`}
              >
                {DAY_ABBRS[day.getDay()]} {day.getDate()}
              </button>

              {/* Time axis */}
              <div
                className="relative border-l border-zinc-100"
                style={{ height: WEEK_COLUMN_TOTAL_HEIGHT }}
              >
                {/* Hour markers at 0, 6, 12, 18 */}
                {WEEK_HOUR_MARKERS.map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-zinc-100"
                    style={{ top: h * WEEKLY_HOUR_HEIGHT }}
                  >
                    <span className="absolute left-0.5 top-[-0.55rem] text-[0.6rem] text-zinc-300 leading-none select-none">
                      {h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`}
                    </span>
                  </div>
                ))}

                {/* Task blocks */}
                {items.map((item) => (
                  <PlannerTimeBlock
                    key={item.id}
                    item={item}
                    hourHeight={WEEKLY_HOUR_HEIGHT}
                    compact
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

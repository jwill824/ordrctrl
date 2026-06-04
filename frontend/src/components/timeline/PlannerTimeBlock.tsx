'use client';

import type { PlannerItem } from '@/hooks/usePlannerTimeline';
import { formatLocalTime } from '@/utils/dateUtils';

interface PlannerTimeBlockProps {
  item: PlannerItem;
  hourHeight: number;
  compact?: boolean;
}

export function PlannerTimeBlock({ item, hourHeight, compact = false }: PlannerTimeBlockProps) {
  const start = new Date(item.startAt!);
  const totalMinutes = start.getHours() * 60 + start.getMinutes();
  const top = (totalMinutes / 60) * hourHeight;
  const height = Math.max((item.durationMinutes / 60) * hourHeight, 24);

  return (
    <div
      className={`absolute border-l-2 border-black bg-white px-1 py-0.5 overflow-hidden ${
        compact ? 'left-0 right-0' : 'left-14 right-2 px-2 py-1'
      } ${item.completed ? 'opacity-40' : ''}`}
      style={{ top, height }}
    >
      <div className={`font-semibold text-black leading-tight truncate ${
        compact ? 'text-[0.6rem]' : 'text-[0.7rem]'
      } ${item.completed ? 'line-through' : ''}`}>
        {item.title}
      </div>
      {!compact && height >= 36 && (
        <div className="text-[0.65rem] text-zinc-400 leading-tight mt-0.5">
          {formatLocalTime(item.startAt!)}
          {item.endAt ? ` – ${formatLocalTime(item.endAt)}` : ''}
        </div>
      )}
    </div>
  );
}

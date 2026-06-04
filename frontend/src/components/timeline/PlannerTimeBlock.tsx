'use client';

import type { PlannerItem } from '@/hooks/usePlannerTimeline';
import { formatLocalTime } from '@/utils/dateUtils';

interface PlannerTimeBlockProps {
  item: PlannerItem;
  hourHeight: number;
}

export function PlannerTimeBlock({ item, hourHeight }: PlannerTimeBlockProps) {
  const start = new Date(item.startAt!);
  const totalMinutes = start.getHours() * 60 + start.getMinutes();
  const top = (totalMinutes / 60) * hourHeight;
  const height = Math.max((item.durationMinutes / 60) * hourHeight, 24);

  return (
    <div
      className={`absolute left-14 right-2 border-l-2 border-black bg-white px-2 py-1 overflow-hidden ${
        item.completed ? 'opacity-40' : ''
      }`}
      style={{ top, height }}
    >
      <div className={`text-[0.7rem] font-semibold text-black leading-tight truncate ${item.completed ? 'line-through' : ''}`}>
        {item.title}
      </div>
      {height >= 36 && (
        <div className="text-[0.65rem] text-zinc-400 leading-tight mt-0.5">
          {formatLocalTime(item.startAt!)}
          {item.endAt ? ` – ${formatLocalTime(item.endAt)}` : ''}
        </div>
      )}
    </div>
  );
}

'use client';

import type { PlannerItem } from '@/hooks/usePlannerTimeline';
import { formatLocalTime } from '@/utils/dateUtils';
import { BLOCK_MIN_HEIGHT } from './timelineConstants';

interface PlannerTimeBlockProps {
  item: PlannerItem;
  hourHeight: number;
  compact?: boolean;
  isDragging?: boolean;
}

export function PlannerTimeBlock({ item, hourHeight, compact = false, isDragging = false }: PlannerTimeBlockProps) {
  const start = new Date(item.startAt!);
  const totalMinutes = start.getHours() * 60 + start.getMinutes();
  const top = (totalMinutes / 60) * hourHeight;
  const height = Math.max((item.durationMinutes / 60) * hourHeight, BLOCK_MIN_HEIGHT);

  return (
    <div
      className={`absolute border-l-[3px] rounded-r shadow-sm overflow-hidden ${
        compact ? 'left-0 right-0 px-1 py-0.5' : 'left-0 right-2 px-2 py-1'
      } ${item.completed ? 'opacity-40' : ''}`}
      style={{
        top,
        height,
        borderColor: item.color,
        backgroundColor: item.color + '20',
        ...(!compact && !isDragging ? { transition: 'top 150ms ease, height 150ms ease' } : {}),
      }}
    >
      <div className={`font-semibold text-zinc-900 leading-tight truncate ${
        compact ? 'text-[0.6rem]' : 'text-[0.7rem]'
      } ${item.completed ? 'line-through' : ''}`}>
        {item.icon ? <span className="mr-0.5">{item.icon}</span> : null}
        {item.title}
      </div>
      {!compact && height >= 28 && (
        <div className="text-[0.65rem] text-zinc-400 leading-tight mt-0.5">
          {formatLocalTime(item.startAt!)}
          {item.endAt ? ` – ${formatLocalTime(item.endAt)}` : ''}
        </div>
      )}
    </div>
  );
}

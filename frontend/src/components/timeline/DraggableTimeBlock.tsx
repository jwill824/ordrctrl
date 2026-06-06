'use client';

import { useRef } from 'react';
import {
  useDragToReschedule,
  getHasTouched,
} from '@/hooks/useDragToReschedule';
import type { PlannerItem } from '@/hooks/usePlannerTimeline';
import { BLOCK_MIN_HEIGHT } from './timelineConstants';
import { formatLocalTime } from '@/utils/dateUtils';

// ---------------------------------------------------------------------------
// Props interface
// ---------------------------------------------------------------------------

export interface DraggableTimeBlockProps {
  item: PlannerItem;
  hourHeight: number;
  compact?: boolean;
  onReschedule: (taskId: string, newStartAt: string) => Promise<void>;
  onResize: (taskId: string, newDurationMinutes: number) => Promise<void>;
  onDragActiveChange?: (active: boolean) => void;
  onTap?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DraggableTimeBlock({
  item,
  hourHeight: _hourHeight,
  compact = false,
  onReschedule,
  onResize,
  onDragActiveChange,
  onTap,
}: DraggableTimeBlockProps) {
  const blockRef = useRef<HTMLDivElement>(null);

  // Guard: sync items (non-native) are not draggable
  const isNative = item.id.startsWith('native:');

  const { dragState, liveTop, liveHeight, revertTransition, startMove, startResize } =
    useDragToReschedule({ item, onReschedule, onResize, onDragActiveChange, onTap });

  // Derived state flags
  const isDragMove = dragState === 'drag-move';
  const isDragResize = dragState === 'drag-resize';
  const isReverting = dragState === 'reverting';
  const isErrorTint = dragState === 'error-tint';
  const isTouchDevice = getHasTouched();

  // -------------------------------------------------------------------------
  // Pointer handlers
  // -------------------------------------------------------------------------

  const handleMovePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isNative) return;
    if (!blockRef.current) return;
    startMove(e.pointerId, e.clientY, blockRef.current);
  };

  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!isNative) return;
    if (!blockRef.current) return;
    startResize(e.pointerId, e.clientY, blockRef.current);
  };

  // -------------------------------------------------------------------------
  // Styles
  // -------------------------------------------------------------------------

  const containerStyle: React.CSSProperties = {
    top: liveTop,
    height: liveHeight,
    zIndex: isDragMove ? 50 : isDragResize ? 20 : 10,
    touchAction: isDragMove || isDragResize ? 'none' : undefined,
    transition: isDragMove || isDragResize ? 'none' : (isReverting ? revertTransition : 'top 150ms ease, height 150ms ease'),
    cursor: isDragMove ? 'grabbing' : undefined,
    borderColor: isErrorTint ? '#F87171' : item.color,
    backgroundColor: item.color + '20',
  };

  const containerClasses = [
    'absolute border-l-[3px] rounded-r px-2 py-1 overflow-hidden shadow-sm group select-none cursor-grab',
    compact ? 'left-0 right-0' : 'left-14 right-2',
    isDragMove ? 'shadow-md opacity-90' : '',
    isDragResize ? 'shadow-sm' : '',
    item.completed ? 'opacity-40' : '',
  ]
    .filter(Boolean)
    .join(' ');

  // -------------------------------------------------------------------------
  // Time range display (same pattern as PlannerTimeBlock)
  // -------------------------------------------------------------------------
  const showTimeRange = !compact && liveHeight >= 36;

  return (
    <div
      ref={blockRef}
      className={containerClasses}
      style={containerStyle}
      onPointerDown={handleMovePointerDown}
      aria-label="drag to reschedule"
    >
      {/* Title */}
      <p
        className={`font-semibold text-zinc-900 leading-tight truncate ${
          compact ? 'text-[0.6rem]' : 'text-[0.7rem]'
        } ${item.completed ? 'line-through' : ''}`}
      >
        {item.icon ? <span className="mr-0.5">{item.icon}</span> : null}
        {item.title}
      </p>

      {/* Time range */}
      {showTimeRange && (
        <div className="text-[0.65rem] text-zinc-400 leading-tight mt-0.5">
          {formatLocalTime(item.startAt!)}
          {item.endAt ? ` – ${formatLocalTime(item.endAt)}` : ''}
        </div>
      )}

      {/* Completed overlay */}
      {item.completed && <div className="absolute inset-0 bg-white/40" />}

      {/* Resize handle — only for native items */}
      {isNative && (
        <div
          className="absolute bottom-0 left-0 right-0 h-5 flex items-end justify-center pb-1 cursor-ns-resize select-none"
          onPointerDown={handleResizePointerDown}
          role="slider"
          aria-label="Drag to resize duration"
          aria-valuemin={15}
          aria-valuemax={240}
          aria-valuenow={item.durationMinutes ?? 30}
          aria-valuetext={`${item.durationMinutes ?? 30} minutes`}
        >
          <div
            className={`w-8 h-1 rounded-full bg-blue-300 transition-opacity duration-150 ${
              isDragResize
                ? 'opacity-100'
                : isTouchDevice
                  ? 'opacity-60'
                  : 'opacity-0 group-hover:opacity-100'
            }`}
          />
        </div>
      )}
    </div>
  );
}

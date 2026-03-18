'use client';

// T009 — TimelineSwipeContainer
// Vanilla pointer-events swipe to switch between feed and timeline views.
// No new gesture libraries — uses only React pointer event handlers.

import { useRef, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { TimelineViewMode } from '@/types/timeline';

interface TimelineSwipeContainerProps {
  mode: TimelineViewMode;
  onModeChange: (mode: TimelineViewMode) => void;
  feedContent: ReactNode;
  timelineContent: ReactNode;
}

/** Minimum horizontal displacement (px) to trigger a view switch */
const SWIPE_THRESHOLD = 50;

/**
 * Lays feed and timeline panels side-by-side in a 200%-wide flex container.
 * A CSS translateX slides between them. Pointer events provide the swipe gesture.
 *
 * Guard rule: only activate horizontal tracking when
 *   Math.abs(deltaX) > Math.abs(deltaY)
 * so vertical scrolling inside the panels is not hijacked.
 */
export function TimelineSwipeContainer({
  mode,
  onModeChange,
  feedContent,
  timelineContent,
}: TimelineSwipeContainerProps) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Pointer-down starting position
  const startRef = useRef<{ x: number; y: number } | null>(null);
  // True once we've committed to a horizontal swipe gesture
  const horizontalRef = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    startRef.current = { x: e.clientX, y: e.clientY };
    horizontalRef.current = false;
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!startRef.current) return;

      const deltaX = e.clientX - startRef.current.x;
      const deltaY = e.clientY - startRef.current.y;

      // Wait for enough movement before deciding direction
      if (!horizontalRef.current) {
        if (Math.abs(deltaX) < 5 && Math.abs(deltaY) < 5) return;
        // Reject vertical-dominant movements to preserve scroll
        if (Math.abs(deltaX) <= Math.abs(deltaY)) return;
        horizontalRef.current = true;
        setIsDragging(true);
      }

      // Clamp: feed can only swipe left (→ timeline), timeline can only swipe right (→ feed)
      if (mode === 'feed' && deltaX > 0) {
        setDragX(0);
      } else if (mode === 'timeline' && deltaX < 0) {
        setDragX(0);
      } else {
        setDragX(deltaX);
      }
    },
    [mode]
  );

  const handlePointerUp = useCallback(() => {
    if (!horizontalRef.current) {
      startRef.current = null;
      return;
    }

    if (dragX < -SWIPE_THRESHOLD && mode === 'feed') {
      onModeChange('timeline');
    } else if (dragX > SWIPE_THRESHOLD && mode === 'timeline') {
      onModeChange('feed');
    }

    setDragX(0);
    setIsDragging(false);
    horizontalRef.current = false;
    startRef.current = null;
  }, [dragX, mode, onModeChange]);

  // feed panel = position 0, timeline panel = position -50% of inner (= -100% of outer)
  const basePercent = mode === 'timeline' ? -50 : 0;
  const transformValue = `calc(${basePercent}% + ${dragX}px)`;

  return (
    <div
      className="relative overflow-hidden w-full"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Inner container: 200% wide so each child panel fills the outer viewport */}
      <div
        className="flex w-[200%]"
        style={{
          transform: `translateX(${transformValue})`,
          transition: isDragging ? 'none' : 'transform 0.25s ease',
          willChange: 'transform',
        }}
      >
        {/* Feed panel — left half */}
        <div className="w-1/2 min-w-0">
          {feedContent}
        </div>

        {/* Timeline panel — right half */}
        <div className="w-1/2 min-w-0">
          {timelineContent}
        </div>
      </div>
    </div>
  );
}

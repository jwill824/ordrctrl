'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PX_PER_HOUR,
  SNAP_MINUTES,
  DRAG_INTENT_THRESHOLD_PX,
  MIN_DRAG_DURATION_MINUTES,
  BLOCK_MIN_HEIGHT,
} from '@/components/timeline/timelineConstants';
import type { PlannerItem } from '@/hooks/usePlannerTimeline';

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export type DragState =
  | 'idle'
  | 'drag-move'
  | 'drag-resize'
  | 'persisting'
  | 'reverting'
  | 'error-tint';

// ---------------------------------------------------------------------------
// Touch device detection — module-level, set on first touchstart
// ---------------------------------------------------------------------------

let hasTouched = false;
if (typeof window !== 'undefined') {
  window.addEventListener(
    'touchstart',
    () => {
      hasTouched = true;
    },
    { once: true, passive: true },
  );
}

export const getHasTouched = () => hasTouched;

// ---------------------------------------------------------------------------
// Pure snap helper — exported for consumers that need it directly
// ---------------------------------------------------------------------------

export const snapToGrid = (minutes: number): number =>
  Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;

// ---------------------------------------------------------------------------
// Internal snap + clamp helpers
// ---------------------------------------------------------------------------

function computeNewStart(originalStartMin: number, deltaY: number): number {
  const deltaMin = (deltaY / PX_PER_HOUR) * 60;
  const raw = originalStartMin + deltaMin;
  return Math.max(
    0,
    Math.min(snapToGrid(raw), 24 * 60 - MIN_DRAG_DURATION_MINUTES),
  );
}

function computeNewDuration(
  originalDurationMin: number,
  originalStartMin: number,
  deltaY: number,
): number {
  const deltaMin = (deltaY / PX_PER_HOUR) * 60;
  const raw = originalDurationMin + deltaMin;
  const snapped = Math.max(MIN_DRAG_DURATION_MINUTES, snapToGrid(raw));
  return Math.min(snapped, 24 * 60 - originalStartMin);
}

// ---------------------------------------------------------------------------
// Hook interface
// ---------------------------------------------------------------------------

export interface UseDragToRescheduleProps {
  item: PlannerItem;
  onReschedule: (taskId: string, newStartAt: string) => Promise<void>;
  onResize: (taskId: string, newDurationMinutes: number) => Promise<void>;
  onDragActiveChange?: (active: boolean) => void;
}

export interface UseDragToRescheduleReturn {
  dragState: DragState;
  liveTop: number;
  liveHeight: number;
  revertTransition: string;
  startMove: (pointerId: number, startY: number, blockEl: HTMLElement) => void;
  startResize: (pointerId: number, startY: number, blockEl: HTMLElement) => void;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function useDragToReschedule({
  item,
  onReschedule,
  onResize,
  onDragActiveChange,
}: UseDragToRescheduleProps): UseDragToRescheduleReturn {
  // Derive stable original values from item
  const originalStartMin = item.startAt
    ? new Date(item.startAt).getHours() * 60 + new Date(item.startAt).getMinutes()
    : 0;
  const originalTop = (originalStartMin / 60) * PX_PER_HOUR;
  const originalHeight = Math.max(
    BLOCK_MIN_HEIGHT,
    ((item.durationMinutes ?? 30) / 60) * PX_PER_HOUR,
  );

  // State
  const [dragState, setDragState] = useState<DragState>('idle');
  const [liveTop, setLiveTop] = useState(originalTop);
  const [liveHeight, setLiveHeight] = useState(originalHeight);
  const [revertTransition, setRevertTransition] = useState('');

  // Refs for latest drag state (avoids stale closures in event handlers)
  const dragStateRef = useRef<DragState>('idle');
  const abortControllerRef = useRef<AbortController | null>(null);
  const timer1Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timer2Ref = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers and active listeners on unmount
  useEffect(() => {
    return () => {
      if (timer1Ref.current != null) clearTimeout(timer1Ref.current);
      if (timer2Ref.current != null) clearTimeout(timer2Ref.current);
      abortControllerRef.current?.abort();
    };
  }, []);

  // -------------------------------------------------------------------------
  // startMove — called by the block element's onPointerDown
  // -------------------------------------------------------------------------
  const startMove = useCallback(
    (pointerId: number, startY: number, blockEl: HTMLElement) => {
      // Guard: no re-entry during in-flight API call (T-09-02)
      if (dragStateRef.current === 'persisting') return;

      blockEl.setPointerCapture(pointerId);

      const pointerDownTime = Date.now();
      let lastClientY = startY;

      // Per-drag AbortController so cleanup is easy
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const handlePointerMove = (e: Event) => {
        const pe = e as PointerEvent;
        if (pe.pointerId !== pointerId) return;

        lastClientY = pe.clientY;
        const deltaY = pe.clientY - startY;

        // Declare drag-move only after intent threshold is crossed
        if (Math.abs(deltaY) >= DRAG_INTENT_THRESHOLD_PX && dragStateRef.current === 'idle') {
          dragStateRef.current = 'drag-move';
          setDragState('drag-move');
          onDragActiveChange?.(true);
        }

        // Always update liveTop (snapped) so block tracks pointer
        const newStartMin = computeNewStart(originalStartMin, deltaY);
        setLiveTop((newStartMin / 60) * PX_PER_HOUR);
      };

      const handlePointerUp = (e: Event) => {
        const pe = e as PointerEvent;
        if (pe.pointerId !== pointerId) return;
        controller.abort();

        const deltaY = lastClientY - startY;
        const elapsed = Date.now() - pointerDownTime;

        // Tap disambiguation: tiny movement + short elapsed → no-op
        if (Math.abs(deltaY) < DRAG_INTENT_THRESHOLD_PX && elapsed < 200) {
          dragStateRef.current = 'idle';
          setDragState('idle');
          setLiveTop(originalTop);
          onDragActiveChange?.(false);
          return;
        }

        // If intent threshold was never crossed, cancel cleanly
        if (dragStateRef.current !== 'drag-move') {
          dragStateRef.current = 'idle';
          setDragState('idle');
          setLiveTop(originalTop);
          onDragActiveChange?.(false);
          return;
        }

        // Compute final snapped position
        const snappedStartMin = computeNewStart(originalStartMin, deltaY);
        const originalDate = new Date(item.startAt!);
        const newDate = new Date(originalDate);
        newDate.setHours(Math.floor(snappedStartMin / 60), snappedStartMin % 60, 0, 0);
        const newStartAt = newDate.toISOString();

        // Transition to persisting
        dragStateRef.current = 'persisting';
        setDragState('persisting');

        onReschedule(item.id, newStartAt)
          .then(() => {
            dragStateRef.current = 'idle';
            setDragState('idle');
            onDragActiveChange?.(false);
          })
          .catch(() => {
            dragStateRef.current = 'reverting';
            setDragState('reverting');
            setLiveTop(originalTop);
            setRevertTransition('all 0.3s ease');

            timer1Ref.current = setTimeout(() => {
              dragStateRef.current = 'error-tint';
              setDragState('error-tint');
              setRevertTransition('');

              timer2Ref.current = setTimeout(() => {
                dragStateRef.current = 'idle';
                setDragState('idle');
                onDragActiveChange?.(false);
              }, 1500);
            }, 300);
          });
      };

      const handlePointerCancel = (e: Event) => {
        const pe = e as PointerEvent;
        if (pe.pointerId !== pointerId) return;
        controller.abort();
        dragStateRef.current = 'idle';
        setDragState('idle');
        setLiveTop(originalTop);
        onDragActiveChange?.(false);
      };

      window.addEventListener('pointermove', handlePointerMove, {
        passive: false,
        signal: controller.signal,
      });
      window.addEventListener('pointerup', handlePointerUp, {
        signal: controller.signal,
      });
      window.addEventListener('pointercancel', handlePointerCancel, {
        signal: controller.signal,
      });
    },
    [item, onReschedule, onDragActiveChange, originalStartMin, originalTop],
  );

  // -------------------------------------------------------------------------
  // startResize — called by the resize handle's onPointerDown
  // -------------------------------------------------------------------------
  const startResize = useCallback(
    (pointerId: number, startY: number, blockEl: HTMLElement) => {
      // Guard: no re-entry during in-flight API call (T-09-02)
      if (dragStateRef.current === 'persisting') return;

      blockEl.setPointerCapture(pointerId);

      let lastClientY = startY;

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const handlePointerMove = (e: Event) => {
        const pe = e as PointerEvent;
        if (pe.pointerId !== pointerId) return;

        lastClientY = pe.clientY;
        const deltaY = pe.clientY - startY;

        // Declare drag-resize on first move (no intent threshold for resize)
        if (dragStateRef.current === 'idle') {
          dragStateRef.current = 'drag-resize';
          setDragState('drag-resize');
          onDragActiveChange?.(true);
        }

        const newDurationMin = computeNewDuration(
          item.durationMinutes ?? 30,
          originalStartMin,
          deltaY,
        );
        setLiveHeight((newDurationMin / 60) * PX_PER_HOUR);
      };

      const handlePointerUp = (e: Event) => {
        const pe = e as PointerEvent;
        if (pe.pointerId !== pointerId) return;
        controller.abort();

        if (dragStateRef.current !== 'drag-resize') {
          dragStateRef.current = 'idle';
          setDragState('idle');
          onDragActiveChange?.(false);
          return;
        }

        const deltaY = lastClientY - startY;
        const snappedDurationMin = computeNewDuration(
          item.durationMinutes ?? 30,
          originalStartMin,
          deltaY,
        );

        dragStateRef.current = 'persisting';
        setDragState('persisting');

        onResize(item.id, snappedDurationMin)
          .then(() => {
            dragStateRef.current = 'idle';
            setDragState('idle');
            onDragActiveChange?.(false);
          })
          .catch(() => {
            dragStateRef.current = 'reverting';
            setDragState('reverting');
            setLiveHeight(originalHeight);
            setRevertTransition('all 0.3s ease');

            timer1Ref.current = setTimeout(() => {
              dragStateRef.current = 'error-tint';
              setDragState('error-tint');
              setRevertTransition('');

              timer2Ref.current = setTimeout(() => {
                dragStateRef.current = 'idle';
                setDragState('idle');
                onDragActiveChange?.(false);
              }, 1500);
            }, 300);
          });
      };

      const handlePointerCancel = (e: Event) => {
        const pe = e as PointerEvent;
        if (pe.pointerId !== pointerId) return;
        controller.abort();
        dragStateRef.current = 'idle';
        setDragState('idle');
        setLiveHeight(originalHeight);
        onDragActiveChange?.(false);
      };

      window.addEventListener('pointermove', handlePointerMove, {
        passive: false,
        signal: controller.signal,
      });
      window.addEventListener('pointerup', handlePointerUp, {
        signal: controller.signal,
      });
      window.addEventListener('pointercancel', handlePointerCancel, {
        signal: controller.signal,
      });
    },
    [item, onResize, onDragActiveChange, originalStartMin, originalHeight],
  );

  return {
    dragState,
    liveTop,
    liveHeight,
    revertTransition,
    startMove,
    startResize,
  };
}

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDragToReschedule } from '@/hooks/useDragToReschedule';
import type { PlannerItem } from '@/hooks/usePlannerTimeline';

// Constants used in assertions — duplicated locally so tests are self-contained
const PX_PER_HOUR = 80;
const SNAP_MINUTES = 15;
const SNAP_PX = (SNAP_MINUTES / 60) * PX_PER_HOUR; // 20
const MIN_DRAG_DURATION_MINUTES = 15;

// Mock jsdom missing APIs — scoped to this suite (NOT in global setup.ts)
beforeEach(() => {
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Builds a minimal PlannerItem at a given local hour/minute
function makePlannerItem(
  startLocalHour: number,
  startLocalMinute: number,
  durationMinutes: number,
): PlannerItem {
  const startAt = new Date(2026, 5, 5, startLocalHour, startLocalMinute, 0).toISOString();
  const endAt = new Date(
    2026,
    5,
    5,
    startLocalHour,
    startLocalMinute + durationMinutes,
    0,
  ).toISOString();
  return {
    id: 'native:abc123',
    source: 'ordrctrl',
    serviceId: 'ordrctrl',
    itemType: 'task',
    title: 'Test Task',
    originalTitle: null,
    hasTitleOverride: false,
    dueAt: null,
    startAt,
    endAt,
    completed: false,
    completedAt: null,
    isDuplicateSuspect: false,
    dismissed: false,
    hasUserDueAt: false,
    isAllDay: false,
    originalBody: null,
    description: null,
    hasDescriptionOverride: false,
    descriptionOverride: null,
    descriptionUpdatedAt: null,
    sourceUrl: null,
    durationMinutes,
  };
}

// ---------------------------------------------------------------------------
// W0-A: snapToGrid math
// ---------------------------------------------------------------------------
describe('snapToGrid — nearest 15-minute interval', () => {
  it('W0-A-1: snapToGrid(0) → 0 (exact on grid)', () => {
    const item = makePlannerItem(9, 0, 30);
    const onReschedule = vi.fn().mockResolvedValue(undefined);
    const onResize = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDragToReschedule({ item, onReschedule, onResize }),
    );
    // Drag 0px → no movement → liveTop unchanged, confirming snapToGrid(0) = 0
    const blockEl = document.createElement('div');
    act(() => {
      result.current.startMove(1, 200, blockEl);
    });
    // pointermove 0px
    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointermove', { pointerId: 1, clientY: 200, bubbles: true }),
      );
    });
    // liveTop offset should be 0 (no change)
    expect(result.current.liveTop).toBe((9 * 60) / 60 * PX_PER_HOUR); // 720
  });

  it('W0-A-2: snapToGrid(15) → 15 (exactly on grid)', () => {
    // Moving exactly SNAP_PX (20px) should snap to +1 interval
    const item = makePlannerItem(9, 0, 30);
    const onReschedule = vi.fn().mockResolvedValue(undefined);
    const onResize = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDragToReschedule({ item, onReschedule, onResize }),
    );
    const blockEl = document.createElement('div');
    act(() => { result.current.startMove(1, 200, blockEl); });
    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointermove', { pointerId: 1, clientY: 200 + SNAP_PX, bubbles: true }),
      );
    });
    // liveTop should be 720 + 20 = 740
    expect(result.current.liveTop).toBe(720 + SNAP_PX);
  });

  it('W0-A-3: snapToGrid(7) → 0 (rounds down, below 0.5 interval)', () => {
    // Moving 7px → delta_min = (7/80)*60 = 5.25 min → round(5.25/15)*15 = 0
    const item = makePlannerItem(9, 0, 30);
    const onReschedule = vi.fn().mockResolvedValue(undefined);
    const onResize = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDragToReschedule({ item, onReschedule, onResize }),
    );
    const blockEl = document.createElement('div');
    act(() => { result.current.startMove(1, 200, blockEl); });
    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointermove', { pointerId: 1, clientY: 207, bubbles: true }),
      );
    });
    // snapToGrid(7px movement) → 0 offset → liveTop stays at 720
    expect(result.current.liveTop).toBe(720);
  });

  it('W0-A-4: snapToGrid(8) → 15 (rounds up, at/above 0.5 interval)', () => {
    // Moving 8px → delta_min = (8/80)*60 = 6.0 min → round(6/15)*15 = 0 (still below)
    // We need (8/80)*60 = 6 → round(6/15) = round(0.4) = 0 → 0 min
    // Actually per W0-A spec: snapToGrid(8) → 15. Let's check: maybe the snap is 8px of minutes
    // i.e. snapToGrid is called on raw minutes value = 8 → round(8/15)*15 = round(0.53)*15 = 1*15 = 15
    // So the test is about the pure snapToGrid function when called with the value 8 (minutes).
    // This means the hook should expose snapToGrid or we test via the composite behavior.
    // 8 minutes → round(8/15)*15 = 15 → 15/60*80 = 20px offset
    // We need a drag that results in 8 minutes delta:
    // 8min = (px/80)*60 → px = 8*80/60 ≈ 10.67px
    // We'll use 11px which gives (11/80)*60 = 8.25 min → round(8.25/15)*15 = round(0.55)*15 = 15
    const item = makePlannerItem(9, 0, 30);
    const onReschedule = vi.fn().mockResolvedValue(undefined);
    const onResize = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDragToReschedule({ item, onReschedule, onResize }),
    );
    const blockEl = document.createElement('div');
    act(() => { result.current.startMove(1, 200, blockEl); });
    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointermove', { pointerId: 1, clientY: 211, bubbles: true }),
      );
    });
    // 11px → 8.25min → snaps to 15min → 20px offset → liveTop = 740
    expect(result.current.liveTop).toBe(740);
  });

  it('W0-A-5: snapToGrid(22) → 15 (rounds down from 22 min)', () => {
    // 22min → round(22/15)*15 = round(1.47)*15 = 15 → 15/60*80 = 20px offset
    // 22min = (px/80)*60 → px = 22*80/60 ≈ 29.3px
    const item = makePlannerItem(9, 0, 30);
    const onReschedule = vi.fn().mockResolvedValue(undefined);
    const onResize = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDragToReschedule({ item, onReschedule, onResize }),
    );
    const blockEl = document.createElement('div');
    act(() => { result.current.startMove(1, 200, blockEl); });
    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointermove', { pointerId: 1, clientY: 229, bubbles: true }),
      );
    });
    // 29px → 21.75min → round(21.75/15)*15 = round(1.45)*15 = 1*15 = 15 → 20px offset
    expect(result.current.liveTop).toBe(740);
  });

  it('W0-A-6: snapToGrid(30) → 30 (exactly on 2nd interval)', () => {
    // 30min = 2 intervals → liveTop offset = 2*20 = 40px → 720+40 = 760
    const item = makePlannerItem(9, 0, 30);
    const onReschedule = vi.fn().mockResolvedValue(undefined);
    const onResize = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDragToReschedule({ item, onReschedule, onResize }),
    );
    const blockEl = document.createElement('div');
    act(() => { result.current.startMove(1, 200, blockEl); });
    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointermove', { pointerId: 1, clientY: 240, bubbles: true }),
      );
    });
    // 40px → 30min → round(30/15)*15 = 30 → 40px offset → 720+40 = 760
    expect(result.current.liveTop).toBe(760);
  });
});

// ---------------------------------------------------------------------------
// W0-B: drag 10px → snaps to 20px (1 interval)
// ---------------------------------------------------------------------------
describe('drag-move snap — W0-B: 10px drag snaps to 20px', () => {
  it('W0-B: drag 10px results in 20px offset (1 snap interval)', () => {
    // drag 10px → delta_min = (10/80)*60 = 7.5 min → round(7.5/15)*15 = round(0.5)*15
    // JavaScript banker's rounding: round(0.5) = 1 (in Math.round, 0.5 always rounds up)
    // So: Math.round(7.5/15) = Math.round(0.5) = 1 → 1*15 = 15min → 15/60*80 = 20px
    const item = makePlannerItem(9, 0, 60);
    const onReschedule = vi.fn().mockResolvedValue(undefined);
    const onResize = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDragToReschedule({ item, onReschedule, onResize }),
    );
    const blockEl = document.createElement('div');
    act(() => { result.current.startMove(1, 200, blockEl); });
    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointermove', { pointerId: 1, clientY: 210, bubbles: true }),
      );
    });
    // liveTop = original 720 + 20 (snapped from 10px input)
    expect(result.current.liveTop).toBe(740);
  });
});

// ---------------------------------------------------------------------------
// W0-C: boundary clamping
// ---------------------------------------------------------------------------
describe('boundary clamping — W0-C', () => {
  it('W0-C-1: drag past midnight clamps liveTop to 0', () => {
    // Item starts at 0:00 (top=0), drag -100px → would go to -100px → clamp to 0
    const item = makePlannerItem(0, 15, 30); // 00:15 → top = 20px
    const onReschedule = vi.fn().mockResolvedValue(undefined);
    const onResize = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDragToReschedule({ item, onReschedule, onResize }),
    );
    const blockEl = document.createElement('div');
    act(() => { result.current.startMove(1, 200, blockEl); });
    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointermove', { pointerId: 1, clientY: 100, bubbles: true }),
      );
    });
    // -100px drag → snapped delta would push top below 0 → clamp to 0
    expect(result.current.liveTop).toBe(0);
  });

  it('W0-C-2: drag past 23:45 clamps liveTop to 1900px', () => {
    // Item at 23:30 (minute=1410) → top = (1410/60)*80 = 1880px
    // Drag +100px → snapped would exceed 1900 → clamp to (1425/60)*80 = 1900
    const item = makePlannerItem(23, 30, 15);
    const onReschedule = vi.fn().mockResolvedValue(undefined);
    const onResize = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDragToReschedule({ item, onReschedule, onResize }),
    );
    const blockEl = document.createElement('div');
    act(() => { result.current.startMove(1, 200, blockEl); });
    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointermove', { pointerId: 1, clientY: 300, bubbles: true }),
      );
    });
    // clamp to max 1900px (23:45 = 1425 min)
    expect(result.current.liveTop).toBe(1900);
  });
});

// ---------------------------------------------------------------------------
// W0-D: resize snap and MIN_DRAG_DURATION_MINUTES floor
// ---------------------------------------------------------------------------
describe('resize snap — W0-D', () => {
  it('W0-D-1: resize +10px from 30min → snaps to 45min', () => {
    // original duration 30min → liveHeight = 40px
    // drag resize +10px → delta_min = (10/80)*60 = 7.5 → 30+7.5 = 37.5 → round(37.5/15)*15 = 45
    // → liveHeight = (45/60)*80 = 60px
    const item = makePlannerItem(9, 0, 30);
    const onReschedule = vi.fn().mockResolvedValue(undefined);
    const onResize = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDragToReschedule({ item, onReschedule, onResize }),
    );
    const blockEl = document.createElement('div');
    act(() => { result.current.startResize(1, 200, blockEl); });
    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointermove', { pointerId: 1, clientY: 210, bubbles: true }),
      );
    });
    // liveHeight = (45/60)*80 = 60px
    expect(result.current.liveHeight).toBe(60);
  });

  it('W0-D-2: resize -100px from 30min clamps to MIN_DRAG_DURATION_MINUTES (15min)', () => {
    // original duration 30min, drag resize -100px → would go to 30 - (100/80*60) = 30-75 = -45min
    // → clamp to max(15, snap) = 15min → liveHeight = (15/60)*80 = 20px
    const item = makePlannerItem(9, 0, 30);
    const onReschedule = vi.fn().mockResolvedValue(undefined);
    const onResize = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDragToReschedule({ item, onReschedule, onResize }),
    );
    const blockEl = document.createElement('div');
    act(() => { result.current.startResize(1, 200, blockEl); });
    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointermove', { pointerId: 1, clientY: 100, bubbles: true }),
      );
    });
    // clamp to min 15min → liveHeight = (15/60)*80 = 20px
    expect(result.current.liveHeight).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// W0-F: onReschedule called with (id, ISO string) on pointerUp
// ---------------------------------------------------------------------------
describe('persist callbacks — W0-F', () => {
  it('W0-F: onReschedule called with item.id and snapped ISO startAt on pointerUp', async () => {
    const item = makePlannerItem(9, 0, 60);
    const onReschedule = vi.fn().mockResolvedValue(undefined);
    const onResize = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDragToReschedule({ item, onReschedule, onResize }),
    );
    const blockEl = document.createElement('div');

    // Start drag at Y=200, move to Y=220 (delta=20px = 1 snap interval = 15 min)
    act(() => { result.current.startMove(1, 200, blockEl); });
    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointermove', { pointerId: 1, clientY: 220, bubbles: true }),
      );
    });
    // Release
    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointerup', { pointerId: 1, bubbles: true }),
      );
    });

    await waitFor(() => {
      expect(onReschedule).toHaveBeenCalledTimes(1);
    });

    const [calledId, calledIso] = onReschedule.mock.calls[0] as [string, string];
    expect(calledId).toBe('native:abc123');
    // New startAt should be 9:15 local = original + 15min
    const expectedMs =
      new Date(2026, 5, 5, 9, 0, 0).getTime() + 15 * 60 * 1000;
    expect(new Date(calledIso).getTime()).toBe(expectedMs);
  });
});

// ---------------------------------------------------------------------------
// W0-G: revert animation triggered on onReschedule rejection
// ---------------------------------------------------------------------------
describe('revert on rejection — W0-G', () => {
  it('W0-G: dragState transitions reverting→error-tint→idle on promise rejection', async () => {
    vi.useFakeTimers();

    const item = makePlannerItem(9, 0, 60);
    const onReschedule = vi.fn().mockRejectedValue(new Error('server error'));
    const onResize = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDragToReschedule({ item, onReschedule, onResize }),
    );
    const blockEl = document.createElement('div');

    act(() => { result.current.startMove(1, 200, blockEl); });
    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointermove', { pointerId: 1, clientY: 220, bubbles: true }),
      );
    });

    // Release → triggers onReschedule → will reject → dragState → 'reverting'
    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointerup', { pointerId: 1, bubbles: true }),
      );
    });

    // Wait for rejection to propagate
    await act(async () => {
      await Promise.resolve(); // flush microtasks
    });

    expect(result.current.dragState).toBe('reverting');

    // After 300ms revert animation → 'error-tint'
    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current.dragState).toBe('error-tint');

    // After 1500ms error tint → 'idle'
    act(() => { vi.advanceTimersByTime(1500); });
    expect(result.current.dragState).toBe('idle');

    vi.useRealTimers();
  });
});

describe('onTap callback', () => {
  // W0-K: short tap (< 8px, < 200ms) fires onTap once
  it('W0-K: short tap (< 8px, < 200ms) fires onTap once and does not call onReschedule', async () => {
    const onTap = vi.fn();
    const onReschedule = vi.fn().mockResolvedValue(undefined);
    const onResize = vi.fn().mockResolvedValue(undefined);
    const item = makePlannerItem(9, 0, 30);
    const { result } = renderHook(() =>
      useDragToReschedule({ item, onReschedule, onResize, onTap }),
    );
    const blockEl = document.createElement('div');
    act(() => { result.current.startMove(1, 200, blockEl); });
    // Immediate pointerUp with tiny movement (< 8px)
    act(() => {
      const upEvent = new PointerEvent('pointerup', { pointerId: 1, clientY: 203, bubbles: true });
      window.dispatchEvent(upEvent);
    });
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onReschedule).not.toHaveBeenCalled();
  });

  // W0-L: drag past threshold does NOT fire onTap
  it('W0-L: drag past threshold does not fire onTap', async () => {
    const onTap = vi.fn();
    const onReschedule = vi.fn().mockResolvedValue(undefined);
    const onResize = vi.fn().mockResolvedValue(undefined);
    const item = makePlannerItem(9, 0, 30);
    const { result } = renderHook(() =>
      useDragToReschedule({ item, onReschedule, onResize, onTap }),
    );
    const blockEl = document.createElement('div');
    act(() => { result.current.startMove(1, 200, blockEl); });
    // Move past intent threshold (> 8px)
    act(() => {
      const moveEvent = new PointerEvent('pointermove', { pointerId: 1, clientY: 240, bubbles: true });
      window.dispatchEvent(moveEvent);
    });
    act(() => {
      const upEvent = new PointerEvent('pointerup', { pointerId: 1, clientY: 240, bubbles: true });
      window.dispatchEvent(upEvent);
    });
    await waitFor(() => expect(onReschedule).toHaveBeenCalled());
    expect(onTap).not.toHaveBeenCalled();
  });

  // W0-M: hook works correctly when onTap is not provided (backward compatibility)
  it('W0-M: hook functions correctly when onTap is not provided', () => {
    const onReschedule = vi.fn().mockResolvedValue(undefined);
    const onResize = vi.fn().mockResolvedValue(undefined);
    const item = makePlannerItem(9, 0, 30);
    expect(() =>
      renderHook(() => useDragToReschedule({ item, onReschedule, onResize })),
    ).not.toThrow();
  });
});

// Phase 13 — RED tests for TimelineCanvas (CANVAS-01 through CANVAS-04)
// NOTE: Tests D–H are RED until Plan 02 creates TimelineCanvas.
// Test B is RED until Plan 02 changes PlannerTimeBlock threshold from 36 → 28.

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PlannerItem } from '@/hooks/usePlannerTimeline';
import { TimelineCanvas } from '@/components/timeline/TimelineCanvas';
import { PlannerTimeBlock } from '@/components/timeline/PlannerTimeBlock';
import { PX_PER_HOUR, BLOCK_MIN_HEIGHT, TIMELINE_HEIGHT } from '@/components/timeline/timelineConstants';

// jsdom doesn't implement scrollIntoView — mock it globally for this suite
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterAll(() => {
  vi.restoreAllMocks();
});

function makePlannerItem(
  startLocalHour: number,
  startLocalMinute: number,
  durationMinutes: number,
  overrides: Partial<PlannerItem> = {}
): PlannerItem {
  const startAt = new Date(2026, 5, 5, startLocalHour, startLocalMinute, 0).toISOString();
  const endAt = new Date(2026, 5, 5, startLocalHour, startLocalMinute + durationMinutes, 0).toISOString();
  return {
    id: 'test-1',
    source: 'test',
    serviceId: 'test',
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
    color: '#000000',
    icon: null,
    ...overrides,
  };
}

// ── timelineConstants (CANVAS-01 baseline) ───────────────────────────────────

describe('timelineConstants (CANVAS-01 baseline)', () => {
  // Test A — constants match spec
  it('Test A: PX_PER_HOUR=80, BLOCK_MIN_HEIGHT=24, TIMELINE_HEIGHT=1920', () => {
    expect(PX_PER_HOUR).toBe(80);
    expect(BLOCK_MIN_HEIGHT).toBe(24);
    expect(TIMELINE_HEIGHT).toBe(1920);
  });
});

// ── PlannerTimeBlock — 28px label-hide threshold (CANVAS-04 / D-13) ──────────

describe('PlannerTimeBlock — 28px label-hide threshold (CANVAS-04)', () => {
  // Test B — time label visible when block height ≈ 33px (>= 28 threshold)
  // hourHeight=80, durationMinutes=25 → height = (25/60)*80 ≈ 33.3px
  // Before fix (threshold=36): 33 < 36 → label hidden → RED
  // After fix (threshold=28): 33 >= 28 → label visible → GREEN
  it('Test B (CANVAS-04): time label visible when height ≈ 33px (>= 28 threshold)', () => {
    const item = makePlannerItem(9, 0, 25);
    const { container } = render(<PlannerTimeBlock item={item} hourHeight={80} compact={false} />);
    // The time label is a div with text-zinc-400 and text-[0.65rem] classes
    const timeLabel = container.querySelector('.text-zinc-400.leading-tight');
    expect(timeLabel).not.toBeNull();
  });

  // Test C — time label hidden when height < 28px (compact=false)
  // 5-min task → height = max((5/60)*80, 24) = max(6.7, 24) = 24px → 24 < 28 → hidden
  it('Test C (CANVAS-04): time label hidden when height < 28px', () => {
    const item = makePlannerItem(9, 0, 5);
    const { container } = render(<PlannerTimeBlock item={item} hourHeight={80} compact={false} />);
    const timeLabel = container.querySelector('.text-zinc-400.leading-tight');
    expect(timeLabel).toBeNull();
  });
});

// ── TimelineCanvas — day mode (CANVAS-01, CANVAS-02) ─────────────────────────

describe('TimelineCanvas — day mode (CANVAS-01, CANVAS-02)', () => {
  const now = new Date(2026, 5, 5, 9, 0, 0);

  // Test D (CANVAS-01): day mode renders without crashing
  it('Test D (CANVAS-01): renders in day mode (columns=1) without error', () => {
    expect(() =>
      render(
        <MemoryRouter>
          <TimelineCanvas
            columns={1}
            hourHeight={PX_PER_HOUR}
            now={now}
            scheduled={[]}
            onReschedule={vi.fn()}
            onResize={vi.fn()}
          />
        </MemoryRouter>
      )
    ).not.toThrow();
  });

  // Test E (CANVAS-02): 24 hour labels rendered in day mode
  it('Test E (CANVAS-02): renders 24 hour labels on the time axis in day mode', () => {
    render(
      <MemoryRouter>
        <TimelineCanvas
          columns={1}
          hourHeight={PX_PER_HOUR}
          now={now}
          scheduled={[]}
          onReschedule={vi.fn()}
          onResize={vi.fn()}
        />
      </MemoryRouter>
    );
    expect(screen.getByText('12am')).toBeTruthy();
    expect(screen.getByText('9am')).toBeTruthy();
    expect(screen.getByText('12pm')).toBeTruthy();
  });
});

// ── TimelineCanvas — week mode (CANVAS-01, CANVAS-02, CANVAS-03) ─────────────

describe('TimelineCanvas — week mode (CANVAS-03)', () => {
  const now = new Date(2026, 5, 5, 9, 0, 0); // Friday Jun 5 2026
  // 7-day week: Mon Jun 1 → Sun Jun 7 2026
  const weekDays = Array.from({ length: 7 }, (_, i) => new Date(2026, 5, 1 + i, 0, 0, 0));
  const dayMap = new Map<string, PlannerItem[]>();

  // Test F (CANVAS-03): week mode renders 7 day column headers
  it('Test F (CANVAS-03): renders 7 day column headers in week mode', () => {
    render(
      <MemoryRouter>
        <TimelineCanvas
          columns={7}
          hourHeight={40}
          now={now}
          weekDays={weekDays}
          dayMap={dayMap}
          onReschedule={vi.fn()}
          onResize={vi.fn()}
        />
      </MemoryRouter>
    );
    // Jun 1 = Mon, Jun 5 = Fri (today), Jun 7 = Sun
    expect(screen.getByText('Mon 1')).toBeTruthy();
    expect(screen.getByText('Fri 5')).toBeTruthy();
    expect(screen.getByText('Sun 7')).toBeTruthy();
  });

  // Test G (CANVAS-03): today column has today-highlight styling (bg-zinc-50)
  it('Test G (CANVAS-03): today column has bg-zinc-50 highlight', () => {
    render(
      <MemoryRouter>
        <TimelineCanvas
          columns={7}
          hourHeight={40}
          now={now}
          weekDays={weekDays}
          dayMap={dayMap}
          onReschedule={vi.fn()}
          onResize={vi.fn()}
        />
      </MemoryRouter>
    );
    // Jun 5 (Friday) is today — its column should have bg-zinc-50
    const todayColumns = document.querySelectorAll('.bg-zinc-50');
    expect(todayColumns.length).toBeGreaterThan(0);
  });
});

// ── TimelineCanvas — auto-scroll on mount (LAYOUT-03 retained in CANVAS) ─────

describe('TimelineCanvas — auto-scroll on mount (CANVAS-01 / LAYOUT-03)', () => {
  beforeEach(() => {
    vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Re-apply the global no-op after restoreAllMocks
    Element.prototype.scrollIntoView = vi.fn();
  });

  // Test H — auto-scroll fires on mount in day mode
  it('Test H (CANVAS auto-scroll): scrolls current time into view on mount', () => {
    const now = new Date(2026, 5, 5, 9, 0, 0);
    render(
      <MemoryRouter>
        <TimelineCanvas
          columns={1}
          hourHeight={PX_PER_HOUR}
          now={now}
          scheduled={[makePlannerItem(9, 0, 60)]}
          onReschedule={vi.fn()}
          onResize={vi.fn()}
        />
      </MemoryRouter>
    );
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
  });
});

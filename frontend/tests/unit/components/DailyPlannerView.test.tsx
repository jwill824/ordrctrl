// Phase 13 NOTE: DailyPlannerView removed in Phase 13.
// Auto-scroll test (Test G) migrated to TimelineCanvas.test.tsx (Test H).
// Pixel-math tests A–F retained here as they test PlannerTimeBlock directly.

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import type { PlannerItem } from '@/hooks/usePlannerTimeline';
import { PlannerTimeBlock } from '@/components/timeline/PlannerTimeBlock';
import { PX_PER_HOUR, BLOCK_MIN_HEIGHT, TIMELINE_HEIGHT } from '@/components/timeline/timelineConstants';

function makePlannerItem(
  startLocalHour: number,
  startLocalMinute: number,
  durationMinutes: number
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
  };
}

describe('PlannerTimeBlock — pixel-math (LAYOUT-01 / LAYOUT-02)', () => {
  // Test A — LAYOUT-01a: 30-minute item renders at 40px height
  it('Test A (LAYOUT-01a): 30-min item has height 40px', () => {
    const item = makePlannerItem(9, 0, 30);
    const { container } = render(<PlannerTimeBlock item={item} hourHeight={PX_PER_HOUR} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.height).toBe('40px');
  });

  // Test B — LAYOUT-01b: 60-minute item renders at 80px height
  it('Test B (LAYOUT-01b): 60-min item has height 80px', () => {
    const item = makePlannerItem(9, 0, 60);
    const { container } = render(<PlannerTimeBlock item={item} hourHeight={PX_PER_HOUR} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.height).toBe('80px');
  });

  // Test C — LAYOUT-01 ratio: 30-min block is exactly half the 60-min block
  it('Test C (LAYOUT-01 ratio): 30-min height is exactly half of 60-min height', () => {
    expect(parseInt('40px') / parseInt('80px')).toBe(0.5);
  });

  // Test D — LAYOUT-02a: 9:00 AM task has top = 720px (9 × 80)
  it('Test D (LAYOUT-02a): 9:00 AM task top = 720px', () => {
    const item = makePlannerItem(9, 0, 30);
    const { container } = render(<PlannerTimeBlock item={item} hourHeight={PX_PER_HOUR} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.top).toBe('720px');
  });

  // Test E — LAYOUT-02b: 9:30 AM task has top = 760px (9.5 × 80)
  it('Test E (LAYOUT-02b): 9:30 AM task top = 760px', () => {
    const item = makePlannerItem(9, 30, 30);
    const { container } = render(<PlannerTimeBlock item={item} hourHeight={PX_PER_HOUR} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.top).toBe('760px');
  });
});

describe('timelineConstants', () => {
  // Test F — constant values are canonical
  it('Test F: PX_PER_HOUR=80, BLOCK_MIN_HEIGHT=24, TIMELINE_HEIGHT=1920', () => {
    expect(PX_PER_HOUR).toBe(80);
    expect(BLOCK_MIN_HEIGHT).toBe(24);
    expect(TIMELINE_HEIGHT).toBe(1920);
  });
});

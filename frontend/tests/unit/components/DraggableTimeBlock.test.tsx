import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import type { PlannerItem } from '@/hooks/usePlannerTimeline';
import { DraggableTimeBlock } from '@/components/timeline/DraggableTimeBlock';

// Mock jsdom missing APIs — scoped to this suite (NOT in global setup.ts)
beforeEach(() => {
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const item: PlannerItem = {
  id: 'native:abc123',
  source: 'ordrctrl',
  serviceId: 'ordrctrl',
  itemType: 'task',
  title: 'Test Task',
  originalTitle: null,
  hasTitleOverride: false,
  dueAt: null,
  startAt: new Date(2026, 5, 5, 9, 0, 0).toISOString(),
  endAt: new Date(2026, 5, 5, 10, 0, 0).toISOString(),
  completed: false,
  completedAt: null,
  isDuplicateSuspect: false,
  dismissed: false,
  hasUserDueAt: false,
  originalBody: null,
  description: null,
  hasDescriptionOverride: false,
  descriptionOverride: null,
  descriptionUpdatedAt: null,
  sourceUrl: null,
  durationMinutes: 60,
};

// ---------------------------------------------------------------------------
// W0-E: resize handle renders with h-5 class (20px zone at bottom of block)
// ---------------------------------------------------------------------------
describe('DraggableTimeBlock — W0-E: resize handle', () => {
  it('W0-E: renders a resize handle element with h-5 class', () => {
    const { container } = render(
      <DraggableTimeBlock
        item={item}
        hourHeight={80}
        onReschedule={vi.fn().mockResolvedValue(undefined)}
        onResize={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    const resizeHandle = container.querySelector('.h-5');
    expect(resizeHandle).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// W0-H: setPointerCapture called on pointerDown on the block body
// ---------------------------------------------------------------------------
describe('DraggableTimeBlock — W0-H: setPointerCapture', () => {
  it('W0-H: setPointerCapture is called with pointerId on pointerDown (block body)', () => {
    const { container } = render(
      <DraggableTimeBlock
        item={item}
        hourHeight={80}
        onReschedule={vi.fn().mockResolvedValue(undefined)}
        onResize={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const blockEl = container.firstElementChild as HTMLElement;
    expect(blockEl).not.toBeNull();

    fireEvent.pointerDown(blockEl, { pointerId: 1, clientY: 200 });

    expect(Element.prototype.setPointerCapture).toHaveBeenCalledWith(1);
  });
});

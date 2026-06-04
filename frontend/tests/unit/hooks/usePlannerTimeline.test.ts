import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { usePlannerTimeline } from '@/hooks/usePlannerTimeline';
import type { FeedItem } from '@/services/feed.service';

afterEach(() => {
  cleanup();
});

function makeItem(overrides: Partial<FeedItem> & { id: string }): FeedItem {
  return {
    source: 'native',
    serviceId: 'native',
    itemType: 'task',
    title: 'Task',
    originalTitle: null,
    hasTitleOverride: false,
    dueAt: null,
    startAt: null,
    endAt: null,
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
    ...overrides,
  };
}

const scheduledA = makeItem({
  id: 'a',
  title: 'Task A',
  startAt: '2026-06-03T09:00:00.000Z',
  endAt: '2026-06-03T10:00:00.000Z',
});

const scheduledB = makeItem({
  id: 'b',
  title: 'Task B',
  startAt: '2026-06-03T08:00:00.000Z',
  endAt: '2026-06-03T08:30:00.000Z',
});

const unscheduledC = makeItem({ id: 'c', title: 'Task C' });

describe('usePlannerTimeline', () => {
  it('returns empty arrays for empty input', () => {
    const { result } = renderHook(() => usePlannerTimeline({ items: [] }));
    expect(result.current.scheduled).toEqual([]);
    expect(result.current.unscheduled).toEqual([]);
  });

  it('splits items with startAt+endAt into scheduled and the rest into unscheduled', () => {
    const { result } = renderHook(() =>
      usePlannerTimeline({ items: [scheduledA, unscheduledC] })
    );
    expect(result.current.scheduled).toHaveLength(1);
    expect(result.current.scheduled[0].id).toBe('a');
    expect(result.current.unscheduled).toHaveLength(1);
    expect(result.current.unscheduled[0].id).toBe('c');
  });

  it('sorts scheduled items by startAt ascending', () => {
    const { result } = renderHook(() =>
      usePlannerTimeline({ items: [scheduledA, scheduledB] })
    );
    expect(result.current.scheduled[0].id).toBe('b');
    expect(result.current.scheduled[1].id).toBe('a');
  });

  it('computes durationMinutes correctly from endAt - startAt', () => {
    const { result } = renderHook(() =>
      usePlannerTimeline({ items: [scheduledA, scheduledB] })
    );
    // scheduledA: 09:00–10:00 = 60 min
    const a = result.current.scheduled.find((i) => i.id === 'a')!;
    expect(a.durationMinutes).toBe(60);
    // scheduledB: 08:00–08:30 = 30 min
    const b = result.current.scheduled.find((i) => i.id === 'b')!;
    expect(b.durationMinutes).toBe(30);
  });

  it('filters items by sourceFilter (serviceId match)', () => {
    const nativeItem = makeItem({
      id: 'd',
      title: 'Native',
      serviceId: 'native',
      startAt: '2026-06-03T10:00:00.000Z',
      endAt: '2026-06-03T11:00:00.000Z',
    });
    const otherItem = makeItem({
      id: 'e',
      title: 'Other',
      serviceId: 'linear',
      source: 'linear',
      startAt: '2026-06-03T10:00:00.000Z',
      endAt: '2026-06-03T11:00:00.000Z',
    });
    const { result } = renderHook(() =>
      usePlannerTimeline({ items: [nativeItem, otherItem], sourceFilter: 'native' })
    );
    expect(result.current.scheduled).toHaveLength(1);
    expect(result.current.scheduled[0].id).toBe('d');
  });

  it('filters items by sourceFilter (source match)', () => {
    const itemA = makeItem({
      id: 'f',
      title: 'F',
      source: 'todoist',
      serviceId: 'todoist-1',
    });
    const itemB = makeItem({ id: 'g', title: 'G', source: 'native', serviceId: 'native' });
    const { result } = renderHook(() =>
      usePlannerTimeline({ items: [itemA, itemB], sourceFilter: 'todoist' })
    );
    expect(result.current.unscheduled).toHaveLength(1);
    expect(result.current.unscheduled[0].id).toBe('f');
  });

  it('returns a now Date from useLiveDate', () => {
    const before = Date.now();
    const { result } = renderHook(() => usePlannerTimeline({ items: [] }));
    const after = Date.now();
    expect(result.current.now.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.current.now.getTime()).toBeLessThanOrEqual(after);
  });

  it('treats item with startAt but no endAt as unscheduled', () => {
    const partialItem = makeItem({
      id: 'h',
      startAt: '2026-06-03T09:00:00.000Z',
      endAt: null,
    });
    const { result } = renderHook(() => usePlannerTimeline({ items: [partialItem] }));
    expect(result.current.scheduled).toHaveLength(0);
    expect(result.current.unscheduled).toHaveLength(1);
  });
});

import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useWeeklyPlanner } from '@/hooks/useWeeklyPlanner';
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
    isAllDay: false,
    originalBody: null,
    description: null,
    hasDescriptionOverride: false,
    descriptionOverride: null,
    descriptionUpdatedAt: null,
    sourceUrl: null,
    ...overrides,
  };
}

// Monday 2026-06-01 00:00:00 local — used as weekStart across tests
// Using noon UTC so the date is stable regardless of local offset
const WEEK_START = new Date(2026, 5, 1, 0, 0, 0, 0); // June 1 2026 local midnight

describe('useWeeklyPlanner', () => {
  it('returns empty dayMap (all empty arrays) and 7 weekDays for empty items', () => {
    const { result } = renderHook(() =>
      useWeeklyPlanner({ items: [], weekStart: WEEK_START })
    );
    expect(result.current.weekDays).toHaveLength(7);
    let totalItems = 0;
    for (const bucket of result.current.dayMap.values()) {
      totalItems += bucket.length;
    }
    expect(totalItems).toBe(0);
    expect(result.current.dayMap.size).toBe(7);
  });

  it('weekDays array has correct dates for a given weekStart', () => {
    const { result } = renderHook(() =>
      useWeeklyPlanner({ items: [], weekStart: WEEK_START })
    );
    const days = result.current.weekDays;
    expect(days[0].getFullYear()).toBe(2026);
    expect(days[0].getMonth()).toBe(5); // June (0-indexed)
    expect(days[0].getDate()).toBe(1);
    expect(days[6].getFullYear()).toBe(2026);
    expect(days[6].getMonth()).toBe(5);
    expect(days[6].getDate()).toBe(7);
    for (let i = 1; i < 7; i++) {
      expect(days[i].getDate()).toBe(days[i - 1].getDate() + 1);
    }
  });

  it('buckets items into correct day columns by local startAt date', () => {
    // June 2 and June 5 — within the week of June 1–7
    const itemDay2 = makeItem({
      id: 'a',
      // Use a time that stays on June 2 regardless of UTC offset: noon local = noon UTC-ish
      startAt: '2026-06-02T15:00:00.000Z',
      endAt: '2026-06-02T16:00:00.000Z',
    });
    const itemDay5 = makeItem({
      id: 'b',
      startAt: '2026-06-05T09:00:00.000Z',
      endAt: '2026-06-05T10:00:00.000Z',
    });

    const { result } = renderHook(() =>
      useWeeklyPlanner({ items: [itemDay2, itemDay5], weekStart: WEEK_START })
    );

    const { dayMap, weekDays } = result.current;

    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const day2Key = fmt(weekDays[1]);
    const day5Key = fmt(weekDays[4]);

    expect(dayMap.get(day2Key)?.map((i) => i.id)).toEqual(['a']);
    expect(dayMap.get(day5Key)?.map((i) => i.id)).toEqual(['b']);
  });

  it('items without startAt or endAt are excluded from dayMap', () => {
    const noStart = makeItem({ id: 'x', startAt: null, endAt: null });
    const noEnd = makeItem({ id: 'y', startAt: '2026-06-03T10:00:00.000Z', endAt: null });

    const { result } = renderHook(() =>
      useWeeklyPlanner({ items: [noStart, noEnd], weekStart: WEEK_START })
    );

    let total = 0;
    for (const bucket of result.current.dayMap.values()) total += bucket.length;
    expect(total).toBe(0);
  });

  it('items outside the week are not placed in any bucket', () => {
    const outsideItem = makeItem({
      id: 'z',
      startAt: '2026-06-10T09:00:00.000Z',
      endAt: '2026-06-10T10:00:00.000Z',
    });

    const { result } = renderHook(() =>
      useWeeklyPlanner({ items: [outsideItem], weekStart: WEEK_START })
    );

    let total = 0;
    for (const bucket of result.current.dayMap.values()) total += bucket.length;
    expect(total).toBe(0);
  });

  it('sourceFilter excludes non-matching items', () => {
    const nativeItem = makeItem({
      id: 'n',
      source: 'native',
      serviceId: 'native',
      startAt: '2026-06-03T09:00:00.000Z',
      endAt: '2026-06-03T10:00:00.000Z',
    });
    const linearItem = makeItem({
      id: 'l',
      source: 'linear',
      serviceId: 'linear',
      startAt: '2026-06-03T11:00:00.000Z',
      endAt: '2026-06-03T12:00:00.000Z',
    });

    const { result } = renderHook(() =>
      useWeeklyPlanner({ items: [nativeItem, linearItem], weekStart: WEEK_START, sourceFilter: 'native' })
    );

    let total = 0;
    for (const bucket of result.current.dayMap.values()) total += bucket.length;
    expect(total).toBe(1);

    let found = false;
    for (const bucket of result.current.dayMap.values()) {
      if (bucket.some((i) => i.id === 'n')) found = true;
      expect(bucket.some((i) => i.id === 'l')).toBe(false);
    }
    expect(found).toBe(true);
  });

  it('items on day boundaries land in correct bucket', () => {
    // Test 23:59 local and 00:00 local for June 3
    // June 3 23:59 local — use a UTC time that remains June 3 in most timezones
    const lateNight = makeItem({
      id: 'late',
      // 23:59 UTC — will be June 3 local in UTC and UTC+ zones, UTC-1+ would put at June 3 22:59
      startAt: '2026-06-03T23:59:00.000Z',
      endAt: '2026-06-04T00:29:00.000Z',
    });
    // June 4 00:00 local — use noon UTC for June 4 (safe across all offsets)
    const earlyMorning = makeItem({
      id: 'early',
      startAt: '2026-06-04T12:00:00.000Z',
      endAt: '2026-06-04T13:00:00.000Z',
    });

    const { result } = renderHook(() =>
      useWeeklyPlanner({ items: [lateNight, earlyMorning], weekStart: WEEK_START })
    );

    const { dayMap, weekDays } = result.current;

    // earlyMorning (noon UTC June 4) must be in June 4 bucket regardless of offset
    const day4Key = `${weekDays[3].getFullYear()}-${String(weekDays[3].getMonth() + 1).padStart(2, '0')}-${String(weekDays[3].getDate()).padStart(2, '0')}`;
    const day4Bucket = dayMap.get(day4Key) ?? [];
    expect(day4Bucket.some((i) => i.id === 'early')).toBe(true);

    // lateNight item must land in exactly one bucket (not duplicated)
    let lateNightCount = 0;
    for (const bucket of dayMap.values()) {
      lateNightCount += bucket.filter((i) => i.id === 'late').length;
    }
    expect(lateNightCount).toBe(1);
  });

  it('computes durationMinutes correctly', () => {
    const item = makeItem({
      id: 'dur',
      startAt: '2026-06-03T09:00:00.000Z',
      endAt: '2026-06-03T10:30:00.000Z',
    });

    const { result } = renderHook(() =>
      useWeeklyPlanner({ items: [item], weekStart: WEEK_START })
    );

    let found: number | undefined;
    for (const bucket of result.current.dayMap.values()) {
      const match = bucket.find((i) => i.id === 'dur');
      if (match) found = match.durationMinutes;
    }
    expect(found).toBe(90);
  });

  it('items within same day bucket are sorted by startAt ascending', () => {
    const itemB = makeItem({
      id: 'b',
      startAt: '2026-06-03T14:00:00.000Z',
      endAt: '2026-06-03T15:00:00.000Z',
    });
    const itemA = makeItem({
      id: 'a',
      startAt: '2026-06-03T08:00:00.000Z',
      endAt: '2026-06-03T09:00:00.000Z',
    });

    const { result } = renderHook(() =>
      useWeeklyPlanner({ items: [itemB, itemA], weekStart: WEEK_START })
    );

    const { weekDays } = result.current;
    const day3Key = `${weekDays[2].getFullYear()}-${String(weekDays[2].getMonth() + 1).padStart(2, '0')}-${String(weekDays[2].getDate()).padStart(2, '0')}`;
    const bucket = result.current.dayMap.get(day3Key) ?? [];
    expect(bucket[0].id).toBe('a');
    expect(bucket[1].id).toBe('b');
  });
});

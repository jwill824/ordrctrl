# S04: Weekly Horizontal-Scroll View — Research

**Date:** 2026-06-03
**Researcher:** Auto-mode scout

## Summary

S04 builds a weekly planner view that renders 7 narrow day-columns on a horizontal-scroll canvas, reusing `PlannerTimeBlock` from S02. The four key architectural questions — how to extend the view mode enum, how to organize multi-day data without a new API endpoint, how "tap a day" navigates, and how to prevent scroll conflicts — all have clean, low-risk answers given the existing codebase shape. The main complexity is date management (which day the user is anchored on) and the CSS horizontal-scroll strategy on mobile.

## Recommendation

**Data:** No new backend endpoint needed. The existing feed already contains all `startAt`/`endAt` items. A new frontend-only hook `useWeeklyPlanner` takes the existing `items: FeedItem[]`, accepts a `weekStart: Date` parameter, and returns a `Map<string, PlannerItem[]>` keyed by `YYYY-MM-DD` (one entry per day). Filter logic is identical to `usePlannerTimeline` but partitioned by local calendar date of `startAt`.

**View mode:** Add `'week'` to `TimelineViewMode`. The segmented control in `FeedPage` gains a fourth button (`Week`). Persisted to `UserSettings.feedViewMode` via the existing `updateUserSettings` path (requires updating the type union in `user.service.ts`).

**Layout:** `WeeklyPlannerView` renders an outer `overflow-x-auto` / `scroll-snap-type: x mandatory` container with 7 day-column `divs` of fixed narrow width. Each column contains a compressed daily timeline (smaller `HOUR_HEIGHT`, e.g. 24px vs 64px) with `PlannerTimeBlock` instances. Tap on the day-column header sets `selectedDay` state in `FeedPage` and switches `viewMode` to `'planner'`.

**Build order:** Hook first (pure logic, testable) → `WeeklyPlannerView` component → wire into `FeedPage` (enum + segmented control + state) → polish (current-day highlight, "today" anchor on mount).

---

## Implementation Landscape

### View Mode Extension

`TimelineViewMode` in `frontend/src/types/timeline.ts` is:

```ts
export type TimelineViewMode = 'feed' | 'timeline' | 'planner';
```

Add `'week'` to make it `'feed' | 'timeline' | 'planner' | 'week'`.

`UserSettings.feedViewMode` in `frontend/src/services/user.service.ts` currently has the union hardcoded as `'feed' | 'timeline' | 'planner'` — must be updated to match, or changed to `TimelineViewMode` (import-based).

The segmented control in `FeedPage` iterates `(['feed', 'timeline', 'planner'] as TimelineViewMode[])` — add `'week'` to that array. Label can be shortened: `Feed`, `List`, `Day`, `Week` (or keep current label strategy).

No backend change is needed for the view mode persistence — the `settings: Json?` field on the `User` model already stores arbitrary JSON.

### Data Architecture

**No new API endpoint is needed.** The existing `/api/feed` response already contains all items with `startAt`/`endAt`. The backend `buildFeed` function fetches tasks without a date-range filter; all scheduled items for all future days are already included.

New hook `useWeeklyPlanner`:

- Input: `{ items: FeedItem[], weekStart: Date, sourceFilter?: string | null }`
- Logic: filter to items with `startAt !== null && endAt !== null`, compute `durationMinutes`, then bucket by `toLocalMidnight(item.startAt).toISOString().slice(0, 10)` (the `YYYY-MM-DD` key)
- Output: `{ dayMap: Map<string, PlannerItem[]>, weekDays: Date[] }` — `weekDays` is the 7 `Date` objects for Mon–Sun (or Sun–Sat, TBD) derived from `weekStart`

`weekStart` state lives in `FeedPage`. Initialize to the Monday of the current week. The `WeeklyPlannerView` component receives `weekDays`, `dayMap`, and callbacks but does not own date state.

`usePlannerTimeline` does NOT need modification — it remains the single-day hook for the daily planner view.

### Day Column Component

New component: `frontend/src/components/timeline/WeeklyPlannerView.tsx`

Layout structure:

```
<div>  {/* outer wrapper — source filter pills, week navigation */}
  <div class="overflow-x-auto scroll-snap-type-x-mandatory ...">
    {weekDays.map(day => (
      <DayColumn key={...} date={day} items={dayMap.get(dateKey) ?? []} onDayTap={...} />
    ))}
  </div>
</div>
```

`DayColumn` (internal sub-component of `WeeklyPlannerView`, not a separate file):

- Fixed width (e.g. `w-28` or `w-32`) with `flex-shrink-0`
- Narrow `HOUR_HEIGHT` — recommend `24` (vs 64 in daily view). This means 24 hours = 576px total height. At 24px/hr, a 30-min block is 12px tall — use the existing `Math.max(..., 24)` floor in `PlannerTimeBlock` to keep tiny blocks tappable.
- Column header: day-of-week abbreviation + date number (e.g. "Tue 3"), tappable — calls `onDayTap(date)`
- Hour markers: every 6 hours (0, 6, 12, 18) to reduce noise in narrow columns — drawn as thin dividers with small labels
- `PlannerTimeBlock` reused with `hourHeight={WEEKLY_HOUR_HEIGHT}` (24). The `left-14` offset in `PlannerTimeBlock` is hardcoded — need to either override via a prop or restyle for narrow columns. The block currently uses `left-14 right-2`. For weekly view the full column width is ~112px so `left-0 right-0` with no label offset makes more sense. This requires either a `compact` prop on `PlannerTimeBlock` or a separate `CompactTimeBlock` variant.

**Decision point for planner:** Add an optional `compact?: boolean` prop to `PlannerTimeBlock` that suppresses the hour-label left-margin (`left-14` → `left-0`) and always suppresses the time sublabel. This avoids a separate component while keeping the interface clean.

### Day Navigation

FeedPage currently has no `selectedDate` concept — `DailyPlannerView` always shows "today" by filtering the current-day data implicitly via `usePlannerTimeline` (it does not filter by date at all — it shows ALL scheduled items from the feed regardless of date).

**Required change:** `DailyPlannerView` needs a `targetDate` prop so it can display a specific day. Currently the daily planner shows all scheduled items. For S04, tapping a day column must navigate to that specific day's daily view.

Two options:

1. Pass `targetDate: Date` to `DailyPlannerView` and have `usePlannerTimeline` filter by local calendar day of `startAt`. FeedPage holds `[plannerDate, setPlannerDate]` state. When `viewMode === 'week'` and user taps a day, set `plannerDate` to that day and set `viewMode` to `'planner'`.
2. Use a URL search param (`?plannerDate=2026-06-05`) for deep-link support.

Recommendation: Option 1 (React state only) — simpler for S04, URL linking is S06+ polish territory. `plannerDate` defaults to `new Date()`. When switching back to `'week'` mode, `plannerDate` is ignored.

`usePlannerTimeline` must gain date-filtering: add optional `targetDate?: Date` param. If provided, filter scheduled items where `toLocalMidnight(item.startAt).getTime() === toLocalMidnight(targetDate.toISOString()).getTime()`. This is backward-compatible (no `targetDate` = no date filter = current behavior).

### Horizontal Scroll Strategy

The page wrapper in `FeedPage` already uses:

```html
<div class="flex-1 overflow-y-auto overflow-x-hidden touch-pan-y">
```

The `overflow-x-hidden` on the page wrapper will **clip** the weekly view's horizontal scroll. This must be changed: when `viewMode === 'week'`, the outer scroll container needs `overflow-x-auto` instead, OR the `WeeklyPlannerView` must be positioned to break out of the max-width `<main>` constraint.

**Recommended approach:** Render `WeeklyPlannerView` outside the `max-w-[40rem] px-5` main wrapper — give it full viewport width. The weekly view inner scroll container uses:

```css
overflow-x: auto;
scroll-snap-type: x mandatory;
-webkit-overflow-scrolling: touch;  /* Capacitor/Safari */
display: flex;
```

Each `DayColumn` has `scroll-snap-align: start` and `flex-shrink: 0`.

This keeps the page-level `touch-pan-y` intact while allowing horizontal scroll within `WeeklyPlannerView` via its own `overflow-x-auto` container. The trick is that the page outer div only clips `overflow-x-hidden` for items inside `<main>` — a sibling `div` at the same flex-child level of the outer container can use its own overflow.

**Alternative (simpler):** Conditionally remove `overflow-x-hidden` from the page scroll container when `viewMode === 'week'`. Since the `<main>` already constrains width for other views, toggling this class is safe.

The `overflow-x-hidden` → `overflow-x-auto` toggle on the outer `div` based on `viewMode === 'week'` is the cleanest single-line fix.

### Files to Create/Change

- `frontend/src/types/timeline.ts` — add `'week'` to `TimelineViewMode`
- `frontend/src/services/user.service.ts` — add `'week'` to `feedViewMode` union in `UserSettings`
- `frontend/src/hooks/usePlannerTimeline.ts` — add optional `targetDate?: Date` param; filter scheduled items to matching local calendar day when provided
- `frontend/src/hooks/useWeeklyPlanner.ts` — **new file** — takes `items`, `weekStart`, `sourceFilter`; returns `{ dayMap: Map<string, PlannerItem[]>, weekDays: Date[] }`
- `frontend/src/components/timeline/PlannerTimeBlock.tsx` — add optional `compact?: boolean` prop; when true use `left-0 right-0` instead of `left-14 right-2`, always suppress time sub-label
- `frontend/src/components/timeline/WeeklyPlannerView.tsx` — **new file** — full horizontal-scroll weekly layout with `DayColumn` sub-component
- `frontend/src/components/timeline/index.ts` — export `WeeklyPlannerView`
- `frontend/src/app/feed/page.tsx` — add `'week'` to segmented control array; add `plannerDate` state; add `weekStart` state; add `useWeeklyPlanner` call; wire `WeeklyPlannerView` in the render conditional; pass `plannerDate`/`targetDate` to `DailyPlannerView`; fix outer container `overflow-x` class when `viewMode === 'week'`
- `frontend/tests/unit/hooks/useWeeklyPlanner.test.ts` — **new file** — unit tests: empty week, items bucketed by correct day, items on day boundaries, `weekDays` array length and correct dates, `sourceFilter` pass-through
- `frontend/tests/unit/hooks/usePlannerTimeline.test.ts` (already exists at `frontend/tests/unit/usePlannerTimeline.test.ts`) — add test cases for `targetDate` filtering

### Risks

1. **Scroll conflict (medium):** The `overflow-x-hidden touch-pan-y` on the page wrapper could fight the inner horizontal scroll in Capacitor's WKWebView. Must verify with `scroll-snap` + `-webkit-overflow-scrolling: touch` in the column container. The page-level `touch-pan-y` should still allow vertical scroll outside the weekly view while horizontal swipe inside triggers column scrolling — but this needs manual device testing. The toggle approach (changing outer container overflow class when in week mode) is the safest hedge.

2. **PlannerTimeBlock left-offset (low):** The hardcoded `left-14` assumes a time-axis gutter. In narrow day columns there is no room for an axis label alongside each block. The `compact` prop approach is safe but requires verifying the visual result at 112px column width. The minimum block height floor of 24px already in `PlannerTimeBlock` covers the short-duration case.

3. **usePlannerTimeline date filtering (low):** The daily planner currently shows all scheduled items regardless of date. If a user has multi-day data, the daily view might already look wrong (showing items from other days). The `targetDate` addition fixes this for both S04 navigation and correctness of the existing daily view — low risk, clear improvement.

4. **weekStart initialization (low):** The week anchor (start of current week) requires a consistent "what is day 0" convention. Use Monday as week start (ISO week). Utility function `getWeekStart(date: Date): Date` → returns Monday of that date's ISO week. Lives in `dateUtils.ts`.

5. **No new backend needed (confirmed low risk):** The existing feed already returns all items. If a user has a very large number of scheduled items across many weeks (unlikely at personal planner scale), frontend filtering is fast enough. No pagination concern.

### Verification

```bash

# TypeScript check

cd /Users/jeff.williams/Developer/personal/ordrctrl/frontend && npx tsc --noEmit

# Unit tests (hook logic)

cd /Users/jeff.williams/Developer/personal/ordrctrl/frontend && npx vitest run tests/unit/hooks/useWeeklyPlanner.test.ts
cd /Users/jeff.williams/Developer/personal/ordrctrl/frontend && npx vitest run tests/unit/usePlannerTimeline.test.ts

# Run all frontend unit tests

cd /Users/jeff.williams/Developer/personal/ordrctrl/frontend && npx vitest run tests/unit

# Manual browser check: navigate to /feed, switch to Week view, verify:

# 1. 7 day columns visible with horizontal scroll

# 2. Task blocks appear in correct day column

# 3. Tap day header → switches to daily planner for that day

# 4. Current day highlighted

# 5. Scroll does not hijack page vertical scroll

# 6. Works in mobile viewport (375px width) with 2-3 columns visible at once

```

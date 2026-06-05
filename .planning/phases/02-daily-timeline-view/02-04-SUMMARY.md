---
phase: "02"
plan: "04"
---

# T04: Wired DailyPlannerView into FeedPage with a unified three-segment pill control (Feed / Timeline / Planner) replacing the old icon toggle and swipe container

**Wired DailyPlannerView into FeedPage with a unified three-segment pill control (Feed / Timeline / Planner) replacing the old icon toggle and swipe container**

## What Happened

Read feed/page.tsx to understand the existing desktop icon toggle (lines 119-138) and mobile TimelineSwipeContainer section (lines 298-325), then applied the following changes in a single surgical pass:

1. Added `usePlannerTimeline` import from `@/hooks/usePlannerTimeline` and `DailyPlannerView` import from `@/components/timeline` (replacing `TimelineSwipeContainer` in the import).
2. Added `const { scheduled, unscheduled, now } = usePlannerTimeline({ items, sourceFilter })` call after the timeline groups hook.
3. Replaced the desktop icon toggle button with a pill-shaped segmented control that maps over `['feed', 'timeline', 'planner']` — active segment gets `bg-black text-white`, inactive gets `text-zinc-500`. The control is suppressed in the `showDismissed` branch.
4. Removed the `TimelineSwipeContainer` block and the mobile swipe hint (`showSwipeHint` state, `SWIPE_HINT_KEY` constant, the `useEffect` that wrote to localStorage). The segmented control in the header now serves both mobile and desktop uniformly.
5. Replaced the `if (isMobile)` branch with a `if (viewMode === 'planner')` branch that renders `<DailyPlannerView scheduled={scheduled} unscheduled={unscheduled} now={now} onComplete={completeItem} onDismiss={dismissItem} onEdit={handleItemClick} sourceFilter={sourceFilter} availableSources={availableSources} onSourceFilterChange={setSourceFilter} />`.
6. Removed the now-unused `usePlatform` import (`isMobile` / `isDesktop` were only consumed by the deleted swipe logic).

`npx tsc --noEmit` exited 0 with no output.

## Verification

Ran `cd frontend && npx tsc --noEmit` — exited 0, no errors.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd /Users/jeff.williams/Developer/personal/ordrctrl/frontend && npx tsc --noEmit` | 0 | pass | 8200ms |

## Deviations

The task plan said to keep the segmented control inside the `!showDismissed && !loading && items.length > 0` conditional consistent with the old toggle placement. Instead, the control is placed in the header (outside main content) and suppressed only when `showDismissed` is true — this matches the old toggle's actual placement in the header, not in the content area. The plan description was slightly imprecise; header placement is correct.

## Known Issues

none

## Files Created/Modified

- `frontend/src/app/feed/page.tsx`

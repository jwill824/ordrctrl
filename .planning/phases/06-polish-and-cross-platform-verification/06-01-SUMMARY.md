---
phase: "06"
plan: "01"
---

# T01: Made dismiss button always visible, increased touch targets on filter pills and day headers, improved hour-marker legibility, applied safe-area-inset bottom padding, and deleted orphaned TimelineSwipeContainer.

**Made dismiss button always visible, increased touch targets on filter pills and day headers, improved hour-marker legibility, applied safe-area-inset bottom padding, and deleted orphaned TimelineSwipeContainer.**

## What Happened

Applied eight targeted fixes across five files for mobile/Capacitor usability:

1. **FeedItem.tsx** — Removed `opacity-0 group-hover:opacity-100` from DismissButton so it is always visible on touch devices. Retained `focus:opacity-100 transition-opacity` for keyboard accessibility.

2. **WeeklyPlannerView.tsx** — Changed day header button from `py-1` to `py-2` to approach a ~40px touch target. Changed hour marker from `text-[0.5rem]` to `text-[0.6rem]` for improved legibility. Changed both filter pill buttons from `py-0.5` to `py-1` for easier tapping.

3. **TimelineView.tsx** — Changed both filter pill buttons from `py-0.5` to `py-1`.

4. **DailyPlannerView.tsx** — Changed both filter pill buttons from `py-0.5` to `py-1`.

5. **FeedPage.tsx** — Changed segmented control buttons from `py-1` to `py-1.5`. Changed weekly view wrapper from `pb-28` to `pb-[calc(7rem+env(safe-area-inset-bottom))]`. Changed main non-week wrapper from `pb-28` to `pb-[calc(7rem+env(safe-area-inset-bottom))]`.

6. **Deleted** `frontend/src/components/timeline/TimelineSwipeContainer.tsx` — confirmed it was only referenced in index.ts and never imported by any other file.

7. **index.ts** — Removed the `TimelineSwipeContainer` re-export and its associated comment line.

TypeScript compiled clean with zero errors. All 145 Vitest tests passed.

## Verification

Ran `cd frontend && node_modules/.bin/tsc --noEmit` — exit 0, no errors. Ran `npx vitest run` — 18 test files, 145 tests, all passed.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd frontend && node_modules/.bin/tsc --noEmit` | 0 | pass | 8200ms |
| 2 | `cd frontend && npx vitest run` | 0 | pass — 145 tests across 18 files | 1010ms |

## Deviations

none

## Known Issues

none

## Files Created/Modified

- `frontend/src/components/feed/FeedItem.tsx`
- `frontend/src/components/timeline/WeeklyPlannerView.tsx`
- `frontend/src/components/timeline/TimelineView.tsx`
- `frontend/src/components/timeline/DailyPlannerView.tsx`
- `frontend/src/app/feed/page.tsx`
- `frontend/src/components/timeline/index.ts`

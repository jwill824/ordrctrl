---
phase: 07-navigation-restructure
plan: "02"
subsystem: frontend/navigation
tags: [navigation, refactor, mobile, layout]
dependency_graph:
  requires:
    - 07-01-PLAN.md  # AppShell + nested route wiring
  provides:
    - FeedPage stripped of standalone chrome (Day/Week toggle only)
    - InboxPage stripped of standalone header
    - FAB/toast offsets correct for 56px mobile tab bar
  affects:
    - frontend/src/app/feed/page.tsx
    - frontend/src/components/inbox/InboxPage.tsx
tech_stack:
  added: []
  patterns:
    - React fragment as component root (content fragments inside AppShell <main>)
    - PlannerViewMode narrowed union type (Extract<TimelineViewMode, 'planner' | 'week'>)
    - Responsive bottom offset: calc(5rem+env(safe-area-inset-bottom)) md:bottom-6
key_files:
  modified:
    - frontend/src/app/feed/page.tsx
    - frontend/src/components/inbox/InboxPage.tsx
decisions:
  - "Removed refresh button from FeedPage (was in removed header); refreshing state retained for sync status display"
  - "Kept FeedEmptyState and isEmpty logic — still meaningful in planner view with no tasks"
  - "setWeekStart declared but never called (pre-existing state) — left unchanged per plan"
  - "Day/Week toggle uses setViewMode directly (not handleModeChange) matching plan spec"
metrics:
  duration: "9 minutes"
  completed: "2026-06-05"
  tasks_completed: 3
  files_modified: 2
---

# Phase 07 Plan 02: Strip Page Chrome + Fix Offsets — Summary

**One-liner:** Stripped h-[100dvh] wrappers and standalone headers from FeedPage and InboxPage; narrowed viewMode to Day/Week pill toggle; fixed FAB/toast bottom offsets to 5rem above safe-area for 56px tab bar clearance.

## What Was Built

### Wave 3A — FeedPage refactor (`feat(07): strip FeedPage chrome + Day/Week toggle`)
**Commit:** `2ddfc12`

- **Removed** `h-[100dvh] bg-white flex flex-col pt-[env(safe-area-inset-top)] overflow-hidden` outer wrapper div
- **Removed** entire `<header>` block: ordrctrl wordmark, 5-mode segmented control, inbox icon link, AccountMenu
- **Removed** imports: `useTimeline`, `useInboxCount`, `AccountMenu`, `TimelineView`
- **Removed** unused variables: `timelineGroups`, `datedItems`, `undatedItems`, `nativeItems`, `isOffline`, `lastSyncAt`, `refresh`
- **Added** `type PlannerViewMode = Extract<TimelineViewMode, 'planner' | 'week'>` — narrowed state from 5 modes to 2
- **Changed** `useState<TimelineViewMode>('feed')` → `useState<PlannerViewMode>('planner')`
- **Updated** settings rehydration: guards `stored === 'planner' || stored === 'week'`; legacy 'feed'/'timeline'/'list' default to 'planner'
- **Added** 44px Day/Week pill toggle sub-header strip (renders only when `!showDismissed`)
- **Removed** feed, timeline, list rendering branches; only DailyPlannerView and WeeklyPlannerView remain
- **Fixed** inner padding: `pb-[calc(7rem+env(safe-area-inset-bottom))]` → `pb-4` (AppShell `<main>` owns tab-bar clearance)
- Component now returns `<>...</>` React fragment

### Wave 3B — InboxPage refactor (`feat(07): strip InboxPage standalone header`)
**Commit:** `6725145`

- **Removed** `h-[100dvh] bg-white flex flex-col pt-[env(safe-area-inset-top)] overflow-hidden` outer wrapper
- **Removed** standalone `<header>` block: ordrctrl wordmark + `<a href="/feed">← Back to feed</a>`
- **Removed** intermediate `<div className="flex-1 overflow-y-auto overflow-x-hidden touch-pan-y">` scroll wrapper
- Component now returns clean `<main className="max-w-[40rem] w-full mx-auto px-5 pt-6 pb-4">` directly
- All existing content (title row, refresh button, section groups, loading/empty/error states) unchanged

### Wave 4A — FAB and toast bottom offsets (`fix(07): FAB and toast offsets clear 56px tab bar`)
**Commit:** `bc4a52c`

- **FAB button:** `bottom-[calc(1.5rem+env(safe-area-inset-bottom))]` → `bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6`
- **Cleared-completed toast:** same replacement
- **Undo toast:** same replacement
- `md:bottom-6` collapses the extra offset on desktop where the bottom tab bar does not exist

## Verification Results

```
✓ npx tsc --noEmit                                    # no errors
✓ grep -c "pb-[calc(7rem" src/app/feed/page.tsx       # 0
✓ grep -c "bottom-[calc(1.5rem" src/app/feed/page.tsx # 0
✓ grep -rn "h-[100dvh]" feed/page.tsx InboxPage.tsx   # no matches
✓ grep -c "Back to feed" InboxPage.tsx                # 0
✓ npm test -- --run                                   # 21 files, 164 tests, all passed
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed `refresh` from useFeed destructuring**
- **Found during:** Wave 3A
- **Issue:** `refresh` was only called in the removed header's refresh button; leaving it in the destructuring would leave it unused
- **Fix:** Removed `refresh` from the `useFeed` destructure list (kept `refreshing` which is still used in sync status display)
- **Files modified:** `frontend/src/app/feed/page.tsx`
- **Commit:** 2ddfc12

**2. [Rule 1 - Bug] Removed `isOffline` and `lastSyncAt` variables**
- **Found during:** Wave 3A
- **Issue:** Both were only passed to the removed `TimelineView` component (inside `timelineJsx`); became dead code
- **Fix:** Removed the `// ── Offline detection (T013) ──` block entirely
- **Files modified:** `frontend/src/app/feed/page.tsx`
- **Commit:** 2ddfc12

## Known Stubs

None — all content is wired to real data sources. FeedPage renders DailyPlannerView/WeeklyPlannerView with live hooks. InboxPage renders InboxGroups from `useInbox()`.

## Threat Flags

None — this plan only removes UI chrome and fixes CSS offsets; no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- `frontend/src/app/feed/page.tsx` — FOUND ✓
- `frontend/src/components/inbox/InboxPage.tsx` — FOUND ✓
- Commit `2ddfc12` (Wave 3A) — FOUND ✓
- Commit `6725145` (Wave 3B) — FOUND ✓
- Commit `bc4a52c` (Wave 4A) — FOUND ✓
- TypeScript: clean (0 errors)
- Tests: 164/164 passing

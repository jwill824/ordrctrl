# S02: Daily Timeline View — Research

**Date:** 2026-06-03
**Researcher:** Auto-mode

---

## Summary

S02 builds the spatial daily timeline — a vertical time axis where native tasks appear as absolutely-positioned blocks, sized by duration. The codebase already has a sophisticated `TimelineView` component, but it renders **bucketed lists** (Overdue / Today / This Week / Later / Unscheduled), not a spatial time axis. The existing infrastructure — `TimelineSwipeContainer`, `useTimeline`, `useFeed`, `useLiveDate`, `dateUtils` — provides the scaffolding and patterns to wire into, but the spatial planner UI must be built from scratch.

The data model prerequisite is complete: S01 delivered `startAt` (DateTime?) and `duration` (Int?, minutes) on NativeTask, with `endAt` computed in API responses. The `FeedItem` interface already carries `startAt: string | null` and `endAt: string | null`. Everything the spatial timeline needs exists in the data layer.

The key risk in S02 is **view mode expansion**: the current `TimelineViewMode = 'feed' | 'timeline'` type and `UserSettings.feedViewMode` only know two modes. Adding the spatial planner mode (`'planner'`) requires threading a new value through the type, the user settings service, the settings API, and the FeedPage toggle/swipe logic — without breaking existing `'feed'` and `'timeline'` mode behavior. The `TimelineSwipeContainer` also currently handles only a two-panel swap and will need to be extended or bypassed for a three-mode world.

---

## Recommendation

Build in this order:

1. **Extend `TimelineViewMode`** to `'feed' | 'timeline' | 'planner'` — update the type, `UserSettings`, `user.service.ts`, and the backend settings route/schema. This is the structural unlock for everything else.
2. **Add the `usePlannerTimeline` hook** — transforms `FeedItem[]` into two arrays: `scheduled` (items with `startAt != null`) sorted by `startAt`, and `unscheduled` (items with `startAt == null`). This is pure logic, easily testable, no UI dependencies.
3. **Build `PlannerTimeBlock` component** — the individual positioned task block (title, time label, absolute top/height from duration). CSS custom property `--hour-height: 64px` on the container controls scale.
4. **Build `DailyPlannerView` component** — the 24-hour scrollable canvas with hour markers and the `PlannerTimeBlock` components. Includes the unscheduled section below the time axis.
5. **Wire `DailyPlannerView` into `FeedPage`** — add the 'planner' case alongside the existing 'feed'/'timeline' toggle/swipe logic. Replace the mobile swipe hint copy. Replace the desktop icon toggle to cycle through three modes.
6. **Extend `tasks.service.ts`** — add `startAt` and `duration` to `NativeTask` type and `createTask`/`updateTask` calls (currently omits them with `startAt: null` hardcoded in the type).

The CSS positioning math is simple:

- `top = (startAt.getHours() * 60 + startAt.getMinutes()) / 60 * hourHeight`
- `height = max(duration / 60 * hourHeight, minBlockHeight)` where `minBlockHeight = 24px`
- Container height = `24 * hourHeight`

---

## Implementation Landscape

### Key Files to Change

| File | What changes |
|---|---|
| `frontend/src/types/timeline.ts` | Add `'planner'` to `TimelineViewMode` |
| `frontend/src/services/user.service.ts` | Add `'planner'` to `feedViewMode` union |
| `frontend/src/services/tasks.service.ts` | Update `NativeTask` type: `startAt: string \| null`, `endAt: string \| null`, `duration: number \| null`; update `createTask`/`updateTask` signatures |
| `frontend/src/hooks/usePlannerTimeline.ts` | **New** — splits FeedItems into scheduled/unscheduled, sorts by startAt |
| `frontend/src/components/timeline/PlannerTimeBlock.tsx` | **New** — individual task block with time label, absolute positioning |
| `frontend/src/components/timeline/DailyPlannerView.tsx` | **New** — 24-hour scrollable canvas, hour markers, unscheduled section |
| `frontend/src/components/timeline/index.ts` | Export `DailyPlannerView` |
| `frontend/src/app/feed/page.tsx` | Add `'planner'` mode handling: toggle logic, swipe container, desktop render |

### Existing Infrastructure to Reuse

**`useTimeline`** — pattern for useMemo-based data transformation hook. `usePlannerTimeline` follows the same shape but produces two flat arrays instead of bucketed groups.

**`useLiveDate`** — already imported in `useTimeline`; re-use in `usePlannerTimeline` so the "current time indicator" line updates every 60s.

**`dateUtils.ts`** — `formatLocalTime(iso)` for block time labels, `toLocalMidnight(iso)` already handles timezone-aware date normalization. No new date utilities needed.

**`TimelineSwipeContainer`** — currently a fixed two-panel (feed / timeline) swipe container. For three modes, the simplest approach is: keep the swipe container for the feed↔planner transition on mobile, retire the swipe container as a three-panel system (too complex). Add a segmented control for mobile mode switching above the content instead (per MEM004 — segmented control, not swipe gesture, for all view toggles).

**`FeedPage` view mode state** — already loads/saves `feedViewMode` via `getUserSettings`/`updateUserSettings`. Just needs the `'planner'` value accepted everywhere.

**Visual theme** — Tailwind-only, no component library. Follow existing `TimelineGroup` and `FeedItemRow` patterns for consistent visual language. The dark border-left accents, `text-[0.7rem] font-bold uppercase tracking-[0.1em]` labels, and `border-zinc-100` dividers are the established motif.

### `FeedItem` type — already has what we need

```typescript
// In feed.service.ts — fields already present:
startAt: string | null;
endAt: string | null;
// duration is NOT in FeedItem — it is computed into endAt by the backend
// For block height: derive duration from endAt - startAt when both are present
```

**Important:** `FeedItem` does not carry `duration` directly — the backend computes `endAt` from `startAt + duration`. For rendering block height, derive duration as `(new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000` minutes when both are non-null. This is the source-of-truth for block sizing. Alternatively, add `duration` to `FeedItem` directly from the API (the backend already includes it for native tasks in `feed.service.ts` toFeedItem()). Check the actual API response shape — adding `duration` to `FeedItem` type is a one-line change if the field is already in the JSON.

### `tasks.service.ts` — `NativeTask` type is stale

```typescript
// Current (stale after S01):
export interface NativeTask {
  startAt: null;      // ← hardcoded null
  endAt: null;        // ← hardcoded null
  // missing: duration
}
```

This must be updated to:

```typescript
export interface NativeTask {
  startAt: string | null;
  endAt: string | null;
  duration: number | null;
}
```

And `createTask` / `updateTask` signatures must accept `startAt` and `duration` parameters.

### ViewMode Expansion — Key Constraint

The `TimelineViewMode` type is used in:

1. `frontend/src/types/timeline.ts` — type definition
2. `frontend/src/services/user.service.ts` — `feedViewMode` field
3. `frontend/src/app/feed/page.tsx` — `useState<TimelineViewMode>`, toggle handler, swipe container prop

The backend `user.service.ts` also stores `feedViewMode` — check whether it validates the enum. If it does, `'planner'` must be added there too. From S01's patterns, the backend uses Zod for validation.

### Segmented Control for View Toggle

Per MEM004, the decided pattern for all view toggles is a segmented control. The current desktop toggle is an icon button cycling `feed ↔ timeline`. For S02, this should become a three-segment pill: **Feed | Timeline | Planner** — or more specifically the labels chosen during implementation. Mobile should also show this segmented control (replacing or supplementing the swipe container).

The existing mobile swipe gesture (in `TimelineSwipeContainer`) conflicts with the decided pattern. MEM004 explicitly says swipe conflicts with horizontal-scroll weekly view and potential future drag-to-reschedule. The swipe container should be retired in favor of the segmented control for S02.

### Current Time Indicator

A horizontal line at the current time on the time axis (like Google Calendar's red line) is straightforward: use `useLiveDate()` to get the current time, compute `top` using the same formula as task blocks, render a `position: absolute` `<div>` with `border-top: 1px solid red`.

### Unscheduled Section

Tasks with `startAt == null` cannot be positioned on the time axis. They render in a distinct section **below** the 24-hour time axis — a labeled list section using the existing `FeedItemRow` component. No new component needed for unscheduled items.

### Hour Height

Set `--hour-height` at 64px (configurable). This gives 24 * 64 = 1536px total height — scrollable on mobile. A 30-minute task block is 32px tall, which is touch-target-safe (≥ 32px). A 15-minute block is 16px — too small; use `max(computed, 24px)` for minimum block height with overflow handling.

### Backend: UserSettings feedViewMode validation

Check `backend/src/api/user.routes.ts` (or equivalent) for the `feedViewMode` Zod schema. If it's a `z.enum(['feed', 'timeline'])`, add `'planner'` there. This is a one-line backend change; the Prisma schema likely stores it as a plain string, so no migration needed.

---

## Natural Seams (Task Breakdown for Planner)

1. **T01 — Type and service expansion** — Extend `TimelineViewMode`, update `NativeTask` type and task service signatures, add `'planner'` to `UserSettings`/backend validation. Pure TypeScript changes, no UI.
2. **T02 — `usePlannerTimeline` hook** — Pure logic hook, unit-testable. Splits FeedItems into scheduled/unscheduled, sorts by startAt.
3. **T03 — `PlannerTimeBlock` + `DailyPlannerView` components** — The spatial canvas: hour markers, absolutely-positioned task blocks, current time indicator, unscheduled section below.
4. **T04 — Wire into FeedPage** — Replace swipe container with segmented control, add `'planner'` rendering branch, persist new mode to settings.
5. **T05 — Manual browser verification** — Start Vite dev server, create a task with startAt+duration via API (or use existing test data), verify block appears at correct position, toggle works, unscheduled section shows.

---

## Verification Commands

```bash

# TypeScript check — zero new errors

cd frontend && npx tsc --noEmit

# Vite dev server

cd frontend && npm run dev

# Backend (needed for API calls during manual verification)

cd backend && npm run dev
```

For manual verification: create a native task with `startAt` and `duration` via curl:

```bash
curl -X POST http://localhost:4000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Test task","startAt":"2026-06-03T14:00:00.000Z","duration":60}'

# Should appear as a 1-hour block at 2pm on the timeline

```

---

## Risks and Constraints

- **Swipe container retirement on mobile** — The `TimelineSwipeContainer` is used for mobile. Removing it in favor of a segmented control is a deliberate UX change (correct per MEM004) but requires updating the swipe hint logic and the `isMobile` branch in FeedPage.
- **Backend `feedViewMode` enum** — If the backend validates `feedViewMode` with Zod enum, saving `'planner'` will fail until the backend is updated. This is a simple one-line change but is a cross-layer dependency T01 must address.
- **`FeedItem.duration` availability** — Verify whether the feed API JSON includes `duration` for native tasks. If not, derive from `endAt - startAt`. Either way, document the approach clearly in the hook.
- **Timezone correctness** — `startAt` is stored as UTC. Block positioning must use local time (not UTC hours). Use `new Date(startAt).getHours()` (local), not `.getUTCHours()`.
- **Tasks spanning midnight** — Clip to visible day boundary per the milestone context. Show a continuation indicator (e.g. "→ continues") at the bottom edge if the task extends past midnight. Deferred detail.

---

## Files Not Requiring Changes

- `backend/prisma/schema.prisma` — no migration needed; `feedViewMode` stored as String
- `frontend/src/hooks/useFeed.ts` — no changes; already returns `startAt`/`endAt` in FeedItems
- `frontend/src/hooks/useTimeline.ts` — no changes; bucketed list view unchanged
- `frontend/src/components/timeline/TimelineView.tsx` — no changes; still used for `'timeline'` mode
- `frontend/src/components/timeline/TimelineGroup.tsx` — no changes
- `frontend/src/utils/dateUtils.ts` — no changes; `formatLocalTime` and `toLocalMidnight` cover what's needed

# S05: Quick-Create on Timeline — Research

**Date:** 2026-06-03
**Researcher:** Auto-mode scout

## Summary

S05 adds a low-friction path to create a scheduled task directly from the DailyPlannerView (planner mode). The recommended UX is a FAB that pre-fills `startAt` to the current time, opening a slim bottom-sheet-style panel for title + optional time/duration overrides. The task appears immediately on the timeline via an optimistic insert into feed state, following the same pattern already used in `useFeed` for `dismissItem`, `completeItem`, and `setUserDueAt`. The key risk is the ID mismatch between the optimistic placeholder (a synthetic temp-id) and the server-assigned UUID, which requires a clean replace-on-confirm step.

## Recommendation

**Affordance:** FAB only (not tap-on-timeline). Rationale below.

**Form pattern:** Slide-up bottom-sheet panel (fixed-position, slides up from bottom edge, dismissable by cancel or backdrop tap). NOT a modal overlay or inline form.

**Build order:**

1. Extend `useNativeTasks` to accept `startAt`/`duration` and return the created `NativeTask`.
2. Add optimistic-insert logic in `useFeed` (new `optimisticAddItem` internal action).
3. Build `QuickCreateSheet` component (title, startAt datetime-local, duration number input).
4. Wire FAB in `DailyPlannerView` (or in `FeedPage` when `viewMode === 'planner'`).
5. Connect optimistic insert + real create + replace-on-confirm in the planner-mode FAB handler.
6. Add inline error toast inside `QuickCreateSheet` on failure, keeping form populated.

## Implementation Landscape

### Existing Task Creation Flow

The current creation flow: FAB in `FeedPage` → sets `showAddForm = true` → renders `AddTaskForm` inline at the top of the content scroll area → calls `useNativeTasks.create(title, dueAt)` → `tasksService.createTask(title, dueAt)` → `reloadFeed()` (full server round-trip).

Key gaps for S05:

- `AddTaskForm` only accepts title + optional due date. It has no `startAt` or `duration` fields.
- `useNativeTasks.create` signature is `(title, dueAt?)` — no `startAt` or `duration`.
- `tasksService.createTask` already accepts `startAt` and `duration` as optional params (API already supports it).
- There is NO optimistic update on task creation today — the feed reloads from server after create.
- The existing FAB is hidden when `showAddForm` is true; it is NOT mode-aware (shows in feed, timeline, and planner modes equally).

### Quick-Create Affordance

**Recommendation: FAB only.**

Tap-on-timeline is technically feasible (the canvas is a `relative` div, `onClick` with `clientY → top offset / HOUR_HEIGHT` would give the tapped hour), but it has significant friction problems:

- The canvas is narrow (left-14 gutter takes ~56px, task blocks overlap the tappable area).
- Accidentally tapping a task block vs. the canvas background is error-prone.
- Touch targets on a 64px-per-hour grid are 64px tall for full hours but sub-row taps would require a precision most fingers can't reliably hit.
- FAB is the established pattern in this app and works well for mobile WebView (Capacitor/Tauri).

**FAB behaviour change for planner mode:** When `viewMode === 'planner'`, the FAB click should open the new `QuickCreateSheet` pre-populated with `startAt = now` (rounded to nearest 15 min) and a default `duration = 30`. The existing `showAddForm` / `AddTaskForm` path remains unchanged for feed/timeline modes. This is a conditional in `FeedPage`'s FAB `onClick` handler.

### Form/Sheet UI

**Component:** `QuickCreateSheet` — a new component at `frontend/src/components/tasks/QuickCreateSheet.tsx`.

**Presentation:** Fixed-position panel pinned to the bottom of the viewport, slides up from the bottom edge, full device width, max-w matching the rest of the app (40rem centered). Uses `pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]` for safe-area compliance.

**Fields:**

1. **Title** (required) — text input, autoFocus, same styling as `AddTaskForm`.
2. **Start time** — `datetime-local` input, pre-filled with `now` rounded to nearest 15 min converted via `toLocalDateTimeInput`.
3. **Duration** — numeric input (minutes), default 30, min 1, max 480. Plain `<input type="number">`.
4. **Submit** — "Add to timeline" button (same black/white style as existing buttons).
5. **Cancel** — closes sheet, discards form.

Error display: inline `border-l-2 border-red-500` paragraph below the fields, matching `AddTaskForm` and `EditTaskModal` conventions. Form stays populated on error so the user can retry.

### Optimistic Update Strategy

`useFeed` already has optimistic updates for several mutations (complete, dismiss, setUserDueAt, setTitleOverride). Task creation currently does NOT use optimistic updates — it calls `reloadFeed()` after create, which causes a visible flicker/delay before the new block appears on the timeline.

**Recommended pattern** (matching existing useFeed optimistic style):

1. Before calling the API, construct a synthetic `FeedItem` from the form values:
   - `id`: `optimistic:${Date.now()}` (temp ID, never sent to server)
   - `source`: `'ordrctrl'`, `serviceId`: `'ordrctrl'`
   - `startAt`: ISO string (from form), `endAt`: computed as `startAt + duration * 60000`
   - `duration`: from form (minutes)
   - `title`: from form
   - `completed: false`, all other fields nulled/defaulted

2. Call `setData(prev => ({ ...prev, items: [optimisticItem, ...prev.items] }))` immediately.

3. Call `tasksService.createTask(title, null, startAt, duration)`.

4. On success: replace the optimistic item with the real server response, mapped to `FeedItem` shape. The server returns a `NativeTask`; map it to FeedItem format (same as `reloadFeed` would do, but inline).

5. On failure: remove the optimistic item from `data.items` (revert), set inline error in `QuickCreateSheet` (keep form open).

**Implementation note:** The optimistic-create logic belongs in `useFeed` as a new exported function (e.g. `createScheduledTask`), not in `useNativeTasks`, so it has direct access to `setData` state. Alternatively, extend `useNativeTasks` to return the created `NativeTask` and handle the optimistic insert in `FeedPage` via a wrapper — this is simpler but less cohesive. The `useFeed`-owned approach is preferred for consistency with existing patterns.

**NativeTask → FeedItem mapping:** `NativeTask` is missing several `FeedItem` fields. The mapping for an optimistic/newly-created ordrctrl task:

```
{
  id: `native:${task.id}`,
  source: 'ordrctrl',
  serviceId: 'ordrctrl',
  itemType: 'task',
  title: task.title,
  originalTitle: null,
  hasTitleOverride: false,
  dueAt: task.dueAt,
  startAt: task.startAt,
  endAt: task.endAt,
  completed: task.completed,
  completedAt: task.completedAt,
  isDuplicateSuspect: false,
  dismissed: false,
  hasUserDueAt: false,
  originalBody: null,
  description: null,
  hasDescriptionOverride: false,
  descriptionOverride: null,
  descriptionUpdatedAt: null,
  sourceUrl: null,
}
```

This mapping should live as a helper `nativeTaskToFeedItem(task: NativeTask): FeedItem` in a shared location (e.g. `frontend/src/utils/feedItemUtils.ts` or inline in the service).

### API Integration

`tasksService.createTask` already accepts `(title, dueAt?, startAt?, duration?)`. No backend changes needed.

Key constraint: `startAt` must be a UTC ISO 8601 string with Z suffix — Zod `.datetime()` on the backend requires it. The `datetime-local` input gives a local time string like `2026-06-03T14:30`; conversion: `new Date(localString).toISOString()` produces the correct UTC ISO with Z suffix.

Default values passed to `createTask`:

- `dueAt`: `null`
- `startAt`: `new Date(roundedLocalTimeString).toISOString()` (UTC Z-suffix)
- `duration`: integer minutes from form (e.g. 30)

### Files to Create/Change

- `frontend/src/components/tasks/QuickCreateSheet.tsx` — NEW: bottom-sheet quick-create form with title, startAt, duration fields; accepts `onSubmit(title, startAt, duration)` and `onCancel` props; manages its own loading/error state; pre-fills startAt and duration from props.

- `frontend/src/hooks/useFeed.ts` — ADD `createScheduledTask(title, startAt, duration)` function: performs optimistic insert, calls `tasksService.createTask`, replaces on success, reverts on failure. Export it from the hook return.

- `frontend/src/hooks/useNativeTasks.ts` — EXTEND `create` signature to `(title, dueAt?, startAt?, duration?)`, passing through the new fields to `tasksService.createTask`.

- `frontend/src/services/tasks.service.ts` — No changes needed (already accepts startAt/duration).

- `frontend/src/app/feed/page.tsx` — MODIFY FAB `onClick`: when `viewMode === 'planner'`, open `QuickCreateSheet` instead of `AddTaskForm`. Add `showQuickCreate` state (boolean) alongside existing `showAddForm`. Render `<QuickCreateSheet>` when `showQuickCreate && viewMode === 'planner'`. Pass the new `createScheduledTask` from `useFeed` into the sheet's `onSubmit`.

- `frontend/src/components/timeline/DailyPlannerView.tsx` — No changes required for MVP; the FAB lives in `FeedPage` and the planner view already receives the correct `scheduled` array from `usePlannerTimeline` (which reads from `useFeed` data).

- `frontend/src/utils/feedItemUtils.ts` — NEW (small): `nativeTaskToFeedItem` helper used by `useFeed.createScheduledTask` to map server response to `FeedItem`.

- `frontend/src/components/timeline/index.ts` — No changes needed.

### Risks

**1. Optimistic temp-ID collision:** The temp ID `optimistic:${Date.now()}` must be replaced cleanly with the server-assigned `native:${uuid}` before any other mutation can target the new item. If the sheet closes before the API responds and the user quickly taps the block, they could try to edit/complete an item with a temp ID that the server doesn't know about. Mitigation: keep the sheet open (loading state) until the API confirms, OR replace the id synchronously on success before allowing interaction (using a `replacing` flag on the optimistic item).

**2. startAt timezone conversion:** The `datetime-local` HTML input on iOS WebView (Capacitor) rounds to the minute and uses device local time. `new Date(localString).toISOString()` handles conversion correctly because JavaScript `Date` treats `datetime-local` strings as local time when they lack a timezone suffix. This is the existing pattern in `AddTaskForm` and `EditTaskModal` — no new risk.

**3. Duration min-1 backend constraint:** Backend Zod schema has `duration: z.number().int().min(1)`. The form input must enforce min=1. A duration of 0 will cause a 422 from the API. Mitigation: form validation — disable submit if duration < 1.

**4. PlannerTimeBlock overlap:** When two tasks overlap on the timeline (same or adjacent startAt), their absolute-positioned blocks stack on top of each other. S05 does not need to resolve this (existing known limitation), but the newly-created block will render on top (z-index default stack order). Acceptable for now.

**5. FAB visibility while sheet is open:** The existing FAB is hidden when `showAddForm` is true. The same logic should hide the FAB when `showQuickCreate` is true to prevent double-opening.

### Verification

```bash

# TypeScript compile check

cd /Users/jeff.williams/Developer/personal/ordrctrl/frontend
npx tsc --noEmit

# Unit tests

npx vitest run

# Dev server smoke test

# 1. Open app in browser, switch to Planner mode

# 2. Tap FAB — QuickCreateSheet should open pre-filled with current time, 30min duration

# 3. Enter a title, submit — block should appear immediately on timeline at correct position

# 4. Verify block height = (30/60) * 64 = 32px (minimum rendered height is 24px per PlannerTimeBlock)

# 5. Reload feed — block should persist (server-confirmed)

# 6. Test failure path: kill backend, try to create — sheet should show inline error, stay open

# 7. Confirm Feed and Timeline modes still use AddTaskForm (no regression)

```

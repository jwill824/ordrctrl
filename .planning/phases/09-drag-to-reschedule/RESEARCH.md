# Phase 09: Drag to Reschedule — Research

**Researched:** 2026-06-05
**Domain:** Pointer-event drag interaction, React state management, optimistic UI mutation
**Confidence:** HIGH

---

## Summary

Phase 09 adds draggable task blocks to the daily timeline. Users drag vertically to reschedule
(change `startAt`) and drag the bottom resize handle to change `durationMinutes`, with 15-minute
snapping on both gestures. All interactions use unified pointer events (covers touch + mouse).
Changes persist to the backend via `PATCH /api/tasks/:id` with optimistic local state and
revert-on-failure.

**The architecture is fully designed** in the approved `09-UI-SPEC.md`. This research confirms
the exact code paths and gaps the planner must bridge. No technology uncertainty remains — every
component, hook, API endpoint, and test file has been inspected.

**Primary recommendation:** Implement the drag hook as a pure state machine (`useDragToReschedule`)
fed by pointer-event handlers. Keep the optimistic update in the `DraggableTimeBlock` component's
local state (liveTop/liveHeight). Wire the persist callback through `DailyPlannerView` props,
implemented in `feed/page.tsx` using existing `useNativeTasks.update` (after expanding it to
accept `startAt`/`duration` fields).

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DRAG-01 | User can drag a task block vertically to change its `startAt`, snapping to 15-minute intervals | `useDragToReschedule` hook + snap formula verified against `PX_PER_HOUR=80` |
| DRAG-02 | User can drag the bottom edge of a task block to resize its `durationMinutes`, snapping to 15-minute intervals | Resize handle zone spec (20px) confirmed; resize snap uses same formula |
| DRAG-03 | Drag/resize changes persist to backend on release with optimistic update and revert-on-failure | PATCH `/api/tasks/:id` exists and accepts `startAt` + `duration`; revert pattern uses CSS transition on `top`/`height` |
| DRAG-04 | Interactions handle both touch (Capacitor) and mouse (Tauri) via unified pointer event handlers | No pointer events used anywhere in codebase today — clean slate; `setPointerCapture` pattern fully specified in UI-SPEC |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Drag gesture recognition / snap math | Frontend (hook) | — | Pure pixel→time arithmetic; no DOM reads during drag |
| Block visual states during drag | Frontend (component) | — | React local state drives inline `style` overrides |
| Scroll-container touch-action toggle | Frontend (DailyPlannerView) | — | Owned by the scroll container parent, not the block |
| Persist mutation (startAt/duration) | Frontend (feed/page.tsx callback) | Backend API | `feed/page.tsx` owns all API callbacks today |
| Revert animation on failure | Frontend (component) | — | CSS transition on `top`/`height` in local state |
| API endpoint (PATCH /tasks/:id) | Backend API | — | Already exists and already accepts `startAt`/`duration` |

---

## Standard Stack

### Core (No New Dependencies)

This phase introduces **zero new npm packages**. [VERIFIED: 09-UI-SPEC.md Registry Safety section]
All functionality uses:

| Tool | Version | Purpose |
|------|---------|---------|
| Pointer Events API | Browser native | Unified touch+mouse drag handling |
| React `useState` / `useRef` | Project already uses React 18 | Drag state machine, ref-based Y tracking |
| CSS transitions | Browser native | Revert animation (top/height 300ms ease-out) |
| `tasksService.updateTask` | Already exists in codebase | PATCH to backend on release |

---

## Package Legitimacy Audit

**No packages to install.** This phase is zero-dependency — all drag logic is implemented with
native browser pointer events and existing React/TypeScript patterns.

**Packages removed due to slopcheck verdict:** none
**Packages flagged as suspicious:** none

---

## Architecture Patterns

### System Architecture Diagram

```
User pointer event (touch / mouse)
       │
       ▼
DraggableTimeBlock.tsx
  onPointerDown (block body) ──────────────────────┐
  onPointerDown (resize zone) ────────────────────┐│
       │                                           ││
       ▼                                           ││
useDragToReschedule.ts                             ││
  startMove(pointerId, startY, item) ←─────────────┘│
  startResize(pointerId, startY, item) ←────────────┘
       │
       │  pointermove (document, passive:false)
       │    → snap arithmetic → liveTop / liveHeight
       │
       │  pointerup / pointercancel (document)
       │    → commit → call onReschedule(id, newStartAt)
       │                 or onResize(id, newDurationMinutes)
       │
       ▼
DailyPlannerView.tsx
  onReschedule prop ─────────────────────────────────┐
  onResize prop ─────────────────────────────────────┤
                                                     │
                                                     ▼
feed/page.tsx
  handleReschedule(id, newStartAt)
  handleResize(id, newDurationMinutes)
       │
       ├─ optimistic: none at feed level
       │   (DraggableTimeBlock holds liveTop/liveHeight during drag)
       │
       ▼
useNativeTasks.update(id, { startAt, duration })
       │
       ▼
tasksService.updateTask(id, { startAt, duration })
       │
       ▼
PATCH /api/tasks/:id  { startAt: ISO8601, duration: minutes }
       │
  success → reloadFeed() (re-fetches items, timeline re-renders at canonical position)
  failure → DraggableTimeBlock.onReschedule/onResize throws
            → useDragToReschedule triggers revert animation (top/height CSS transition 300ms)
            → error-tint state (border-red-400) for 1500ms
```

### Recommended Project Structure (new files only)

```
frontend/src/
├── hooks/
│   └── useDragToReschedule.ts          # NEW — pure drag state machine
├── components/timeline/
│   ├── DraggableTimeBlock.tsx          # NEW — enhanced block with drag states
│   ├── timelineConstants.ts            # MODIFY — add 5 Phase 09 constants
│   ├── DailyPlannerView.tsx            # MODIFY — swap block component, add touchAction prop
│   └── index.ts                        # MODIFY — export DraggableTimeBlock
frontend/tests/unit/
├── hooks/
│   └── useDragToReschedule.test.ts     # NEW — snap math unit tests
├── components/
│   ├── DraggableTimeBlock.test.tsx     # NEW — drag state rendering tests
│   └── DailyPlannerView.test.tsx       # MODIFY — add onReschedule/onResize props to Test G render
```

---

## Exact Files That Need to Change

[VERIFIED: codebase grep]

### Files to CREATE

**1. `frontend/src/hooks/useDragToReschedule.ts`**
- Does NOT exist anywhere in the codebase
- Returns: `{ dragState, liveTop, liveHeight, startMove, startResize, onPointerMove, onPointerUp, onPointerCancel }`
- `dragState: 'idle' | 'drag-move' | 'drag-resize' | 'persisting' | 'reverting' | 'error-tint'`
- Calls `onReschedule` / `onResize` on `pointerUp`; handles revert on promise rejection
- Manages two `setTimeout` calls: one for 300ms revert-end → enter error-tint, one for 1500ms error-tint-end → idle

**2. `frontend/src/components/timeline/DraggableTimeBlock.tsx`**
- Does NOT exist anywhere in the codebase
- Imports `useDragToReschedule`
- Props: `{ item: PlannerItem, hourHeight: number, compact?: boolean, onReschedule: (id, newStartAt) => Promise<void>, onResize: (id, newDurationMinutes) => Promise<void> }`
- Renders all 6 drag states defined in UI-SPEC section 2 (idle, drag-move, drag-resize, persisting, reverting, error-tint)
- Includes resize handle per UI-SPEC section 3
- `group` class on container for group-hover pill behavior

### Files to MODIFY

**3. `frontend/src/components/timeline/timelineConstants.ts`**
- Current contents (all 4 lines):
  ```ts
  export const PX_PER_HOUR = 80;
  export const BLOCK_MIN_HEIGHT = 24;
  export const TIMELINE_HOURS = 24;
  export const TIMELINE_HEIGHT = TIMELINE_HOURS * PX_PER_HOUR; // 1920
  ```
- Add:
  ```ts
  export const SNAP_MINUTES = 15;
  export const SNAP_PX = (SNAP_MINUTES / 60) * PX_PER_HOUR;   // 20px
  export const DRAG_INTENT_THRESHOLD_PX = 8;
  export const RESIZE_HANDLE_HEIGHT_PX = 20;
  export const MIN_DRAG_DURATION_MINUTES = 15;
  ```

**4. `frontend/src/components/timeline/DailyPlannerView.tsx`**
- Current: renders `<PlannerTimeBlock key={item.id} item={item} hourHeight={PX_PER_HOUR} />`
  in a `.map()` loop. No mutation callbacks.
- Changes:
  - Import `DraggableTimeBlock` instead of `PlannerTimeBlock`
  - Add `onReschedule: (taskId: string, newStartAt: string) => Promise<void>` prop
  - Add `onResize: (taskId: string, newDurationMinutes: number) => Promise<void>` prop
  - Add `isDragActive?: boolean` prop (passed from parent when any drag is active) — OR lift drag-active state via a callback prop `onDragActiveChange: (active: boolean) => void`
  - Swap render: `<DraggableTimeBlock ... onReschedule={onReschedule} onResize={onResize} />`
  - Add `touchAction` toggle on the inner scroll container — **but NOTE**: the scroll container is in `feed/page.tsx`, not in `DailyPlannerView`. See "Critical Architecture Note" below.

**5. `frontend/src/hooks/useNativeTasks.ts`**
- Current `update` signature: `async (id: string, fields: { title?: string; dueAt?: string | null })`
- `tasksService.updateTask` already accepts `{ title?, dueAt?, startAt?, duration? }` [VERIFIED: tasks.service.ts]
- Change: expand `fields` type to include `startAt?: string | null; duration?: number | null`
- This is needed so `feed/page.tsx` can call `update(id, { startAt, duration })` via the established pattern

**6. `frontend/src/app/feed/page.tsx`**
- Current: calls `DailyPlannerView` with NO reschedule/resize callbacks
- Changes:
  - Add `handleReschedule(taskId: string, newStartAt: string): Promise<void>` — calls `update(taskId, { startAt: newStartAt })` then `reloadFeed()`
  - Add `handleResize(taskId: string, newDurationMinutes: number): Promise<void>` — converts minutes to `duration`, calls `update(taskId, { duration })` then `reloadFeed()`
  - Pass `onReschedule={handleReschedule}` and `onResize={handleResize}` to `<DailyPlannerView>`
  - The `update` function is already available via `const { create, update, remove } = useNativeTasks(reloadFeed)` (line already in file)

**7. `frontend/src/components/timeline/index.ts`**
- Add: `export { DraggableTimeBlock } from './DraggableTimeBlock';`

### Tests to MODIFY

**8. `frontend/tests/unit/components/DailyPlannerView.test.tsx`**
- Test G renders `DailyPlannerView` with `scheduled` items. After the swap to `DraggableTimeBlock`,
  `onReschedule` and `onResize` become required props on `DailyPlannerView`.
- Tests A–F render `PlannerTimeBlock` directly — these are UNAFFECTED (PlannerTimeBlock stays).
- Test G must add: `onReschedule={vi.fn()} onResize={vi.fn()}` to the `DailyPlannerView` render call.

---

## Critical Architecture Note: `touchAction` Toggle Location

[VERIFIED: DailyPlannerView.tsx, feed/page.tsx codebase read]

The UI-SPEC states: "Add `touchAction` toggle on `DailyPlannerView`'s scroll container div."
**However,** `DailyPlannerView` does NOT own the scroll container. The scroll container is in
`feed/page.tsx`:

```tsx
// feed/page.tsx line ~134
<div className={`flex-1 overflow-y-auto ... touch-pan-y`}>
```

`DailyPlannerView` renders inside this container. The `touch-pan-y` class on the container
will interfere with drag gestures on mobile — it must become `touch-action: none` when a drag
is active.

**Resolution options:**

1. **Lift drag-active state via prop callback (recommended for simplicity):**
   - `DailyPlannerView` receives `onDragActiveChange: (active: boolean) => void` prop
   - `feed/page.tsx` has `const [isDragActive, setIsDragActive] = useState(false)`
   - The scroll container gets `style={{ touchAction: isDragActive ? 'none' : 'auto' }}`

2. **`DraggableTimeBlock` directly calls `document.body.style.touchAction`:**
   - Simpler — no prop threading required
   - Slightly more impure (component touches global DOM state)
   - Used by many drag implementations in practice

3. **`setPointerCapture` alone (no touchAction needed):**
   - `setPointerCapture` routes events to the element even when pointer leaves
   - Combined with `e.preventDefault()` in `pointermove`, this may be sufficient
   - Risk: the browser may still scroll if `touch-pan-y` is active on a parent

**Planner should decide:** Option 1 (prop callback) is cleanest; Option 2 is simpler to implement.
Both are valid. The UI-SPEC example uses a shared `isDragActive` lifted state approach.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Snap rounding | Custom floor/ceil logic | `Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES` (1 line) | Rounding semantics are trivial but the formula is given exactly in UI-SPEC |
| Pointer capture loss on fast swipe | Re-attach document listeners | `element.setPointerCapture(event.pointerId)` | Browser routes all pointer events to the capturing element |
| Scroll vs drag conflict | Platform detection + branching | `e.preventDefault()` in `pointermove` + `{ passive: false }` listener | Single unified path, no platform branching |
| Persist debouncing | Timer-based batching | None needed — fire API on `pointerUp` only (not on every snap) | One PATCH per completed gesture |

---

## Common Pitfalls

### Pitfall 1: `passive: true` in `pointermove` listener
**What goes wrong:** Chrome defaults `pointermove` to passive. If you add the listener without
`{ passive: false }`, `e.preventDefault()` silently fails, and the page scrolls during drag.
**Why it happens:** Chrome optimizes scroll performance by assuming move handlers don't call preventDefault.
**How to avoid:** Always add: `document.addEventListener('pointermove', handler, { passive: false })`
**Warning signs:** Scroll and drag happen simultaneously on mobile.

### Pitfall 2: Forgetting to remove document-level listeners on cleanup
**What goes wrong:** `pointermove` and `pointerup` listeners accumulate on document across
multiple drag sessions. The hook fires stale closures with wrong state.
**Why it happens:** Listeners added in `onPointerDown` must be removed in `onPointerUp` / `onPointerCancel`
AND in a `useEffect` cleanup.
**How to avoid:** Use `useEffect` to return a cleanup function that removes all document listeners.
Or use the `AbortController` pattern: `controller.abort()` in cleanup.
**Warning signs:** Multiple PATCH calls fire on a single pointer release.

### Pitfall 3: Tap vs drag ambiguity breaks Phase 10
**What goes wrong:** Every `pointerDown` → `pointerUp` with minimal movement fires a drag sequence
instead of a tap, preventing Phase 10's edit-sheet from ever opening.
**Why it happens:** Without the 8px intent threshold, every touch triggers drag mode.
**How to avoid:** Only enter `drag-move` state after pointer moves ≥ `DRAG_INTENT_THRESHOLD_PX` (8px).
Fire a "tap" callback on `pointerUp` if movement was < 8px AND elapsed < 200ms. Leave the tap
callback as a no-op in Phase 09 (Phase 10 wires it).
**Warning signs:** Blocks never open an edit sheet in Phase 10.

### Pitfall 4: Non-native tasks (sync items) receiving drag callbacks
**What goes wrong:** `item.id` may start with `sync:` for integration-sourced items. These items
are NOT stored in the `tasks` table and calling `PATCH /api/tasks/:id` with a sync ID returns 404.
**Why it happens:** `DailyPlannerView` renders ALL `PlannerItem` items including sync items.
**How to avoid:** In `DraggableTimeBlock` or in the `onReschedule`/`onResize` callback, guard:
```ts
if (!item.id.startsWith('native:')) return; // or show a no-op drag for sync items
```
OR in `handleReschedule`/`handleResize` in `feed/page.tsx`: check `item.source === 'ordrctrl'`
before calling `update`.
**Warning signs:** 404 errors on drag release for Google Calendar / Gmail items.

### Pitfall 5: Midnight overflow (task dragged past 23:45)
**What goes wrong:** User drags a 1-hour task to 23:30 → end time = 00:30 next day → backend
stores invalid same-day range.
**Why it happens:** The snap clamp must enforce `snappedStart + duration ≤ 1440 minutes`.
**How to avoid:** After snapping, re-clamp:
```ts
const maxStart = 24 * 60 - MIN_DRAG_DURATION_MINUTES; // 23:45 = 1425
const clampedStart = Math.min(snappedStart, maxStart);
// For resize: clamp end ≤ 1440
const maxDuration = 24 * 60 - originalStartMinutes;
const clampedDuration = Math.min(snappedDuration, maxDuration);
```
**Warning signs:** Tasks appear on next day after dragging near midnight.

### Pitfall 6: `reloadFeed()` race condition with multiple rapid drags
**What goes wrong:** User completes two rapid drag operations. The first `reloadFeed()` returns
after the second drag starts, overwriting the optimistic local state.
**Why it happens:** `reloadFeed()` in `useFeed` replaces all `items` state from the API response,
which triggers `usePlannerTimeline` to recompute — including re-computing the block position from
the (now-updated) `item.startAt` in the API response.
**How to avoid:** Since `DraggableTimeBlock` holds `liveTop`/`liveHeight` in local state only
during an active drag, and resets to `item`-derived values on idle, the reload overwriting items
is fine — it just means the block snaps to canonical API state. This is acceptable behavior.
The only risk is a reload returning mid-drag with stale data. Mitigation: suppress `reloadFeed`
while `dragState !== 'idle'` (optional; the UI-SPEC doesn't require it).

### Pitfall 7: `DailyPlannerView.test.tsx` Test G fails after prop addition
**What goes wrong:** Test G renders `DailyPlannerView` but `onReschedule`/`onResize` are now
required props — TypeScript will error at build time.
**Why it happens:** Adding required props to `DailyPlannerView` breaks existing tests.
**How to avoid:** Update Test G to pass `onReschedule={vi.fn()} onResize={vi.fn()}`. Also
consider making the new props optional (`onReschedule?: ...`) with a no-op default, which would
make the test require no change — but optional callbacks hide mistakes.
**Recommended:** Make props required in `DraggableTimeBlock`, optional with no-op defaults in
`DailyPlannerView` (pass-through pattern). This matches the PlannerTimeBlock kept for compact/week
where drag is not needed.

---

## Code Examples

### Snap Calculation (pure arithmetic)
```ts
// Source: 09-UI-SPEC.md Section 5 — Snap Calculation
import { SNAP_MINUTES, PX_PER_HOUR, MIN_DRAG_DURATION_MINUTES } from './timelineConstants';

const snapToGrid = (minutes: number): number =>
  Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;

// Drag-move: new start time from pixel delta
const deltaMinutes = (currentY - pointerStartY) / PX_PER_HOUR * 60;
const rawNewStart = originalStartMinutes + deltaMinutes;
const snappedStart = Math.max(0, Math.min(
  snapToGrid(rawNewStart),
  24 * 60 - MIN_DRAG_DURATION_MINUTES  // clamp to 23:45 max start
));
const newTop = (snappedStart / 60) * PX_PER_HOUR;

// Drag-resize: new duration from pixel delta
const rawNewDuration = originalDurationMinutes + deltaMinutes;
const snappedDuration = Math.max(MIN_DRAG_DURATION_MINUTES, snapToGrid(rawNewDuration));
const newHeight = Math.max(BLOCK_MIN_HEIGHT, (snappedDuration / 60) * PX_PER_HOUR);
```

### Pointer Event Setup Pattern
```ts
// Source: 09-UI-SPEC.md Section 6 — Pointer Event Strategy
function startMove(e: React.PointerEvent, blockEl: HTMLElement) {
  blockEl.setPointerCapture(e.pointerId);
  pointerStartY.current = e.clientY;
  // ...set dragState = 'drag-move'

  document.addEventListener('pointermove', handlePointerMove, { passive: false });
  document.addEventListener('pointerup', handlePointerUp);
  document.addEventListener('pointercancel', handlePointerCancel);
}

function handlePointerMove(e: PointerEvent) {
  e.preventDefault(); // required — suppresses scroll during drag
  // ...snap math
}

// Cleanup — always remove in cleanup
function cleanup() {
  document.removeEventListener('pointermove', handlePointerMove);
  document.removeEventListener('pointerup', handlePointerUp);
  document.removeEventListener('pointercancel', handlePointerCancel);
}
```

### Revert Animation
```ts
// Source: 09-UI-SPEC.md Section 7 — Optimistic Update + Revert Flow
async function handlePointerUp() {
  cleanup();
  const snappedStartAt = computeNewStartAt(snappedStart);
  setDragState('persisting');
  try {
    await onReschedule(item.id, snappedStartAt);
    setDragState('idle');
  } catch {
    // Revert: animate back to original position
    setLiveTop(originalTop.current);
    setLiveHeight(originalHeight.current);
    setRevertTransition('top 300ms ease-out, height 300ms ease-out');
    setDragState('reverting');
    setTimeout(() => {
      setRevertTransition('');
      setDragState('error-tint');
      setTimeout(() => setDragState('idle'), 1500);
    }, 300);
  }
}
```

### Backend PATCH Call (existing service)
```ts
// Source: frontend/src/services/tasks.service.ts (verified)
// updateTask already accepts startAt and duration — no backend changes needed
await tasksService.updateTask(taskId, {
  startAt: newStartAt,          // ISO 8601 string
  duration: newDurationMinutes, // integer minutes
});
// The backend strips "native:" prefix internally
```

### useNativeTasks.update expansion (minimal change)
```ts
// Source: frontend/src/hooks/useNativeTasks.ts (current)
// Current: fields: { title?: string; dueAt?: string | null }
// New:
const update = useCallback(
  async (id: string, fields: {
    title?: string;
    dueAt?: string | null;
    startAt?: string | null;   // ADD
    duration?: number | null;  // ADD
  }) => {
    await tasksService.updateTask(id, fields);
    await onRefresh();
  },
  [onRefresh]
);
```

### Sync-item guard in feed/page.tsx callbacks
```ts
// Source: codebase analysis — sync items have id starting with "sync:"
// [ASSUMED] — guard pattern inferred from existing source-check patterns in codebase

const handleReschedule = useCallback(async (taskId: string, newStartAt: string) => {
  if (!taskId.startsWith('native:')) return; // sync items not updatable via tasks API
  await update(taskId, { startAt: newStartAt });
}, [update]);

const handleResize = useCallback(async (taskId: string, newDurationMinutes: number) => {
  if (!taskId.startsWith('native:')) return;
  await update(taskId, { duration: newDurationMinutes });
}, [update]);
```

---

## API Contract (Verified)

[VERIFIED: backend/src/api/tasks.routes.ts]

**Endpoint:** `PATCH /api/tasks/:id`

**Request body** (Zod-validated inline schema in tasks.routes.ts — NOT the `tasks.schemas.ts` file):
```ts
{
  title?: string        // min 1, max 500
  dueAt?: string | null // ISO 8601 datetime
  startAt?: string | null // ISO 8601 datetime ← DRAG-03 uses this
  duration?: number | null  // integer minutes ← DRAG-03 uses this
}
```

**Important discrepancy:** `backend/src/api/schemas/tasks.schemas.ts` does NOT include `startAt`
or `duration` in its exported `updateTaskSchema`. However, the ACTUAL validator in
`tasks.routes.ts` is a **separate, inline Zod schema** that DOES include both fields. The
exported schemas file is unused by the route handler. The backend is already correct.

**No backend changes required for Phase 09.**

**`duration` vs `durationMinutes`:** The backend field is `duration` (integer minutes). The
frontend `PlannerItem` and UI-SPEC use `durationMinutes`. Convert at the callsite:
```ts
await update(taskId, { duration: newDurationMinutes }); // pass as 'duration'
```

---

## Existing Codebase State

[VERIFIED: codebase grep]

| Question | Answer |
|----------|--------|
| Does `useDragToReschedule` hook exist? | **No** — does not exist anywhere |
| Does `DraggableTimeBlock` component exist? | **No** — does not exist anywhere |
| Does any drag code exist in the codebase? | **No** — zero pointer event handlers in any `.tsx` file |
| Does `setPointerCapture` appear anywhere? | **No** — clean slate |
| Does `usePlannerTimeline` have mutation functions? | **No** — read-only hook, returns `{ scheduled, unscheduled, now }` |
| Does `DailyPlannerView` have reschedule/resize props? | **No** — current props: `scheduled, unscheduled, now, onComplete, onDismiss, onEdit, sourceFilter, availableSources, onSourceFilterChange` |
| Does `tasks.service.updateTask` accept `startAt`/`duration`? | **Yes** — service already accepts these fields |
| Does the backend PATCH endpoint accept `startAt`/`duration`? | **Yes** — inline Zod schema in tasks.routes.ts |
| Does `useNativeTasks.update` accept `startAt`/`duration`? | **No** — currently only `{ title?, dueAt? }` |
| Does `feed/page.tsx` pass any mutation callbacks to `DailyPlannerView`? | **No** — only `onComplete`, `onDismiss`, `onEdit` |
| Is `touch-pan-y` class on the scroll container? | **Yes** — `feed/page.tsx` line with `className="flex-1 overflow-y-auto ... touch-pan-y"` |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate touch/mouse event handlers | Unified pointer events (`onPointerDown`) | ~2020 (Pointer Events Level 2) | No platform branching needed |
| `getBoundingClientRect()` on every move | Record `startY` once on `pointerDown`, compute delta | Always best practice | Zero DOM reads during drag = smooth 60fps |
| `requestAnimationFrame` for drag updates | Direct state update in `pointermove` | React 18 concurrent mode | React batches updates; RAF adds latency |
| Draggable libraries (react-dnd, @dnd-kit) | Native pointer events | Project decision | Zero deps; simpler for 1D vertical-only drag |

**Deprecated/outdated:**
- `TouchEvent` / `MouseEvent` dual handlers: replaced by `PointerEvent` — do not use separate touch/mouse branches

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 1.3.1 + @testing-library/react |
| Config file | `frontend/vitest.config.ts` |
| Setup file | `frontend/tests/unit/setup.ts` (extends jest-dom matchers, auto-cleanup) |
| Quick run command | `cd frontend && npm test` (runs `vitest run`) |
| Full suite command | `cd frontend && npm test` (22 test files, 171 tests, ~2s) |

**jsdom limitation:** `setPointerCapture` is not implemented in jsdom. In unit tests, mock it:
```ts
// In test setup or per-test beforeEach
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();
```

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DRAG-01 | `snapToGrid(minutes)` returns nearest 15-min interval | unit | `npm test -- useDragToReschedule` | ❌ Wave 0 |
| DRAG-01 | Drag 10px → snaps to 20px (1 interval) | unit | `npm test -- useDragToReschedule` | ❌ Wave 0 |
| DRAG-01 | Start clamped at midnight (0) and 23:45 | unit | `npm test -- useDragToReschedule` | ❌ Wave 0 |
| DRAG-02 | Resize delta → snapped duration ≥ 15 min | unit | `npm test -- useDragToReschedule` | ❌ Wave 0 |
| DRAG-02 | Resize handle renders with `h-5` class | unit | `npm test -- DraggableTimeBlock` | ❌ Wave 0 |
| DRAG-03 | `onReschedule` called with snapped ISO startAt on pointerUp | unit | `npm test -- useDragToReschedule` | ❌ Wave 0 |
| DRAG-03 | Revert animation triggered on `onReschedule` rejection | unit | `npm test -- useDragToReschedule` | ❌ Wave 0 |
| DRAG-04 | `setPointerCapture` called on pointerDown | unit | `npm test -- DraggableTimeBlock` | ❌ Wave 0 |
| existing | DailyPlannerView Test G (LAYOUT-03 auto-scroll) | unit | `npm test -- DailyPlannerView` | ✅ needs props update |

### Sampling Rate
- **Per task commit:** `cd frontend && npm test`
- **Per wave merge:** `cd frontend && npm test` (full suite, ~2s)
- **Phase gate:** Full suite green (171 + new tests) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/hooks/useDragToReschedule.test.ts` — covers DRAG-01, DRAG-02, DRAG-03 snap arithmetic + revert
- [ ] `tests/unit/components/DraggableTimeBlock.test.tsx` — covers DRAG-02 handle render, DRAG-04 setPointerCapture
- [ ] `tests/unit/components/DailyPlannerView.test.tsx` — update Test G to add `onReschedule={vi.fn()} onResize={vi.fn()}`

---

## Security Domain

**No new security surface introduced.** This phase adds UI interaction only. The PATCH endpoint
already existed with full auth guard (`requireAuth`). The `startAt` and `duration` fields were
already in the backend schema. No new endpoints, no new auth flows.

| ASVS Category | Applies | Control |
|---------------|---------|---------|
| V4 Access Control | yes (existing) | `requireAuth` in tasks.routes.ts already guards PATCH |
| V5 Input Validation | yes (existing) | Zod schema in tasks.routes.ts validates startAt (ISO8601) and duration (int, min 1) |
| All others | no | N/A for a drag UI feature |

---

## Environment Availability

No external dependencies. The backend and frontend dev servers are the only dependencies
(already operational — Phase 08 verified in this same environment).

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Vitest | Unit tests | ✓ | 1.3.1 | — |
| jsdom | Unit test environment | ✓ | (via vitest config) | — |
| Backend dev server | Manual verification | ✓ | (Phase 08 verified) | — |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Sync items have IDs starting with `sync:` and native tasks start with `native:` | Code Examples — sync guard | If prefix convention differs, guard must change; look at `nativeTaskToFeedItem` in feedItemUtils.ts for the exact prefix logic |
| A2 | `document.body`-level touchAction alternative is viable for suppressing scroll | Critical Architecture Note | If iOS Safari still scrolls despite `e.preventDefault()`, may need the prop-callback approach |
| A3 | `DraggableTimeBlock` `onReschedule`/`onResize` props should be optional in `DailyPlannerView` | Exact Files / Pitfall 7 | If made required, Phase 09 test updates become mandatory; if optional, risk of silent no-ops in tests |

---

## Open Questions (RESOLVED)

1. **`touchAction` toggle placement — scroll container is in `feed/page.tsx`, not in `DailyPlannerView`**
   - What we know: The scroll div `<div className="flex-1 overflow-y-auto ... touch-pan-y">` is in `feed/page.tsx`, above `DailyPlannerView` in the tree.
   - What's unclear: Should we thread `isDragActive` state up via a callback prop, or use a body-level `document.body.style.touchAction` side effect in the hook?
   - Recommendation: Planner should pick Option 1 (callback prop) for architectural cleanliness, as `feed/page.tsx` already has `useState` for many concerns. Add `onDragActiveChange: (active: boolean) => void` prop to `DailyPlannerView`.
   - **RESOLVED: Option 1 (callback prop)** — Plan 09-04 implements `onDragActiveChange` → `isDragActive` state in `feed/page.tsx` → inline `touchAction` style on scroll container.

2. **Should `DailyPlannerView.onReschedule`/`onResize` be required or optional props?**
   - What we know: `DraggableTimeBlock` needs these callbacks to function. `PlannerTimeBlock` (kept for week view) does not have them.
   - What's unclear: Whether to make them required (TypeScript enforced) or optional with no-op defaults.
   - Recommendation: Make them **required** on `DraggableTimeBlock`, **optional with no-op defaults** on `DailyPlannerView`. This avoids prop-drill TypeScript errors in the existing test while keeping type safety at the component level.
   - **RESOLVED: Required on `DraggableTimeBlock`, optional with no-op defaults on `DailyPlannerView`** — Plan 09-04 implements this pattern.

3. **Should `usePlannerTimeline` expose the mutation, or should `feed/page.tsx` own it directly?**
   - What we know: `usePlannerTimeline` is a pure read/compute hook with no state ownership. `feed/page.tsx` already owns `useNativeTasks` and `reloadFeed`.
   - What's unclear: The UI-SPEC says to add mutation to `usePlannerTimeline`, but the hook doesn't own items.
   - Recommendation: Add the mutation to **`useNativeTasks.update`** (1-line type change) and call it directly from **`feed/page.tsx`** callbacks. This follows the established pattern (`create`/`update`/`remove` already in useNativeTasks). The `usePlannerTimeline` hook stays a pure read hook.
   - **RESOLVED: Mutation owned by `useNativeTasks.update` + `feed/page.tsx` callbacks** — Plan 09-02 Task 1 expands the type; Plan 09-04 Task 2 wires the callbacks.

---

## Sources

### Primary (HIGH confidence)
- `frontend/src/components/timeline/DailyPlannerView.tsx` — current component shape
- `frontend/src/hooks/usePlannerTimeline.ts` — current hook interface
- `frontend/src/hooks/useNativeTasks.ts` — current update signature
- `frontend/src/services/tasks.service.ts` — updateTask service signature
- `backend/src/api/tasks.routes.ts` — PATCH endpoint schema (inline Zod)
- `frontend/tests/unit/components/DailyPlannerView.test.tsx` — existing tests
- `frontend/vitest.config.ts` — test framework configuration
- `.planning/phases/09-drag-to-reschedule/09-UI-SPEC.md` — approved design contract

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — phase history and accumulated decisions
- `.planning/REQUIREMENTS.md` — DRAG-01 through DRAG-04 requirement definitions

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps, all existing code verified by direct read
- Architecture: HIGH — all file contents read, call chains traced
- Pitfalls: HIGH — based on pointer event behavior (well-understood), sync item IDs (inferred from feedItemUtils naming)
- Test strategy: HIGH — vitest config and existing tests directly read

**Research date:** 2026-06-05
**Valid until:** Stable (no external dependencies; valid until files change)

# Phase 10: Tap to Edit + Quick-Create UX - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver mobile-native task editing and creation UX: a unified TaskSheet (renamed from QuickCreateSheet) that handles both creating and editing scheduled tasks, with a scroll-wheel time picker (scrollable list of 15-min time slots) and a duration stepper. Tap-to-edit opens the sheet from a task block via an `onTap` callback wired into the drag hook.

</domain>

<decisions>
## Implementation Decisions

### TaskSheet (renamed from QuickCreateSheet)
- **D-01:** Rename `QuickCreateSheet` → `TaskSheet`. The component handles both create mode and edit mode via an optional `task` prop (pre-fills form when present).
- **D-02:** Sheet fields: **title, startAt (via time picker), duration (via stepper)**. Only these three fields — full task model shown, not dueAt or completed toggle.
- **D-03:** Delete button shown in edit mode only, behind a **confirm step** ("Are you sure?") — not single-tap red confirmation.
- **D-04:** Sheet animates as a **slide up from bottom**, consistent with current QuickCreateSheet behavior.
- **D-05:** Sheet dismisses via **both** backdrop tap and swipe-down gesture (either closes it without saving).

### Scroll-wheel Time Picker
- **D-06:** Use a **library** (react-mobile-picker or similar) — not a custom build.
- **D-07:** Time picker is a **single scrollable column of time slots** in 15-minute increments — NOT separate hour/minute columns. Full day range: 12:00 AM through 11:45 PM.
- **D-08:** 24-hour display format (0:00–23:45), with 15-min steps matching the snap grid.

### Duration Stepper
- **D-09:** Duration input uses a stepper (+ / − buttons) in **15-minute increments**, displaying the selected duration as a live label (e.g. "30 min"). Spec: QC-02.

### Sheet State Ownership
- **D-10:** Extract sheet state into a **`useTaskSheet` custom hook** — encapsulates open/close state and the task being edited (null = create mode, PlannerItem = edit mode). The hook is called from `feed/page.tsx` and wired down to the planner.

### Tap Detection Wiring
- **D-11:** Add an **`onTap` callback** to `useDragToReschedule` (and expose it via `DraggableTimeBlock`) that fires when the pointer up meets the existing tap criteria (< 8px movement, < 200ms elapsed). Remove reliance on `onClick` for edit triggering.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/REQUIREMENTS.md` §EDIT — EDIT-01, EDIT-02 (tap-to-edit sheet)
- `.planning/REQUIREMENTS.md` §QC — QC-01, QC-02 (time picker and duration stepper)

### Existing Components to Modify
- `frontend/src/components/tasks/QuickCreateSheet.tsx` — rename to TaskSheet; replace datetime-local input and number input with new picker/stepper
- `frontend/src/components/timeline/DraggableTimeBlock.tsx` — add `onTap` prop; thread through to hook
- `frontend/src/components/timeline/DailyPlannerView.tsx` — wire `onEdit` → `onTap` via DraggableTimeBlock; swap `onClick` for `onTap`

### Existing Hooks
- `frontend/src/hooks/useDragToReschedule.ts` — add `onTap?: () => void` callback; fire in the existing tap-cancel branch (< DRAG_INTENT_THRESHOLD_PX, < 200ms)
- `frontend/src/app/feed/page.tsx` — consume `useTaskSheet` hook; replace `showQuickCreate` state with hook return values

### Timeline Constants
- `frontend/src/components/timeline/timelineConstants.ts` — `DRAG_INTENT_THRESHOLD_PX = 8`, `SNAP_MINUTES = 15`

### Phase Roadmap
- `.planning/ROADMAP.md` §Phase 10 — Goal, Requirements, Success Criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `QuickCreateSheet` (→ TaskSheet): Form structure, submit handler, optimistic flow, error display — keep all, replace inputs only
- `useDragToReschedule`: Tap detection already exists at line ~179 (`Math.abs(deltaY) < DRAG_INTENT_THRESHOLD_PX && elapsed < 200`) — hook needs one new `onTap` prop and one call site
- `DraggableTimeBlock`: Already has `onDragActiveChange`, pattern for prop threading established
- `DailyPlannerView`: Already has `onEdit?: (item: FeedItem) => void` at line 16 — the external interface exists, needs to call `onTap` internally

### Established Patterns
- Optimistic PATCH + revert-on-failure: established in Phase 09 (`onReschedule`, `onResize`). Edit-save follows the same pattern via existing task update service.
- Tailwind utility classes in `className` only — no `@apply`, no inline styles except runtime-dynamic values
- Custom hooks own state; service functions are pure API wrappers (no state)
- `touchAction: 'none'` toggle via `isDragActive` in `feed/page.tsx` — must remain unbroken by TaskSheet changes

### Integration Points
- `useTaskSheet` hook connects to existing `feed/page.tsx` state management
- TaskSheet save path → existing PATCH `/tasks/:id` endpoint (same as drag-reschedule)
- TaskSheet create path → existing POST `/tasks` endpoint (unchanged from QuickCreateSheet)
- `onTap` in DraggableTimeBlock → `useTaskSheet.openEdit(item)` in DailyPlannerView

</code_context>

<specifics>
## Specific Ideas

- **Structured-style time picker**: User explicitly referenced Structured's single-column scrollable time list as the target UX. Not split hour/minute columns — a single list where each row is a formatted time (e.g. "9:00", "9:15", "9:30"). The picker scrolls to the task's current startAt on open.
- **Library for time picker**: User prefers using a library (react-mobile-picker or equivalent) over a custom build.
- **Recurrence feature**: User has a specific vision for a future recurrence phase — Apple Reminders–style repeat rules, including "repeat on the 1st Sunday every month" and "every Monday and Wednesday at 8:00 AM and 10:00 PM". This is NOT in Phase 10 scope.

</specifics>

<deferred>
## Deferred Ideas

### Recurrence / Repeating Tasks
A dedicated recurrence phase requested by user with specific requirements:
- Apple Reminders–style repeat rules (e.g. "repeat on the 1st Sunday every month")
- Multi-day multi-time rules (e.g. "Every Monday and Wednesday at 8:00 AM and 10:00 PM")
- Requires schema additions to `NativeTask` (recurrence rules, parent/child task relationships)
- Belongs in its own phase after the core editing UX is stable

</deferred>

---

*Phase: 10-tap-to-edit-quick-create*
*Context gathered: 2026-06-05*

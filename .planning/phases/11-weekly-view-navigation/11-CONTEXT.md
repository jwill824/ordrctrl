# Phase 11: Weekly View Navigation - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Add prev/next week navigation and a Today button to the existing WeeklyPlannerView — letting users move between any week (past or future) and return to the current week in one tap. The `weekStart` state already exists in `feed/page.tsx`; this phase wires UI controls to it and polishes the weekly view header.

</domain>

<decisions>
## Implementation Decisions

### Navigation Control Architecture
- **D-01:** Pass `onPrevWeek`, `onNextWeek`, and `onToday` callbacks as props into `WeeklyPlannerView`. State ownership (`weekStart`, `setWeekStart`) stays in `feed/page.tsx`.
- **D-02:** `WeeklyPlannerView` owns its own header row with the navigation controls — not lifted to the tab/page header bar.

### Navigation Header Layout
- **D-03:** Standard calendar nav row layout: `← | center label/Today | →`. Left arrow, center content, right arrow — all in one row.
- **D-04:** The center of the nav row shows either the date range label (when on current week) OR the "Today" button (when not on the current week). Today replaces the label when weekOffset ≠ 0.

### Week Label Format
- **D-05:** Center label shows a date range: `Jun 1–7` or `Jun 30 – Jul 6` (adjusts when range spans month boundary). Anchors to Monday–Sunday per the existing `getWeekStart` ISO week convention.

### Today Button Behavior
- **D-06:** Today button is always visible — tapping it when already on the current week is a no-op.
- **D-07:** When on the current week, Today is visually muted (e.g. `text-zinc-300`) to signal it is already active. When on a different week, Today renders at normal weight/color.

### Data Fetching
- **D-08:** Week navigation is client-side only — updating `weekStart` triggers `useWeeklyPlanner` to re-filter existing `items` from `useFeed`. No new API call on week change.
- **D-09:** Navigating back to the current week via Today does NOT trigger a data refresh — it only resets `weekStart` to `getWeekStart(new Date())`.

### Transition Animation
- **D-10:** Instant swap — `weekStart` updates and columns re-render immediately. No slide animation in Phase 11. (Deferred to visual polish if desired later.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/REQUIREMENTS.md` §WEEK — WEEK-01, WEEK-02 (prev/next navigation, Today button)
- `.planning/ROADMAP.md` §Phase 11 — Goal, Dependencies, Success Criteria

### Existing Components to Modify
- `frontend/src/components/timeline/WeeklyPlannerView.tsx` — add `onPrevWeek`, `onNextWeek`, `onToday` props; render nav header row
- `frontend/src/app/feed/page.tsx` — wire `setWeekStart` to new callback props passed into WeeklyPlannerView

### Existing Hooks
- `frontend/src/hooks/useWeeklyPlanner.ts` — no changes needed; already accepts `weekStart` prop
- `frontend/src/utils/dateUtils.ts` — `getWeekStart(date)` (ISO Monday start), `addDays(date, n)` — use `addDays(weekStart, 7)` and `addDays(weekStart, -7)` for prev/next

### Prior Phase Context
- `.planning/phases/10-tap-to-edit-quick-create/10-CONTEXT.md` — established TouchAction pattern and `useFeed` data model

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WeeklyPlannerView` (`.../components/timeline/WeeklyPlannerView.tsx`): Already renders 7 columns with source filter pills. Nav header row is additive — insert above the existing filter pills and horizontal scroll canvas.
- `useWeeklyPlanner` hook: Pure memoized computation over `(items, weekStart, sourceFilter)` — no changes needed. Already handles week boundary correctly.
- `getWeekStart` + `addDays` (`frontend/src/utils/dateUtils.ts`): `getWeekStart` computes ISO Monday. `addDays(weekStart, ±7)` is the correct prev/next computation.
- `feed/page.tsx` line 85: `weekStart` state initialized to `getWeekStart(new Date())`. `setWeekStart` exists, just not called from any UI.

### Established Patterns
- **Props-down callbacks**: `onDragActiveChange`, `onTap`, `onEdit`, `onReschedule`, `onResize` — all established in prior phases. Adding `onPrevWeek` / `onNextWeek` / `onToday` follows the same pattern.
- **Tailwind utility classes only** — no `@apply`, no inline `style={{}}` except runtime-dynamic values.
- **`touchAction: 'none'` toggle** in `feed/page.tsx` (via `isDragActive`) must remain unbroken — WeeklyPlannerView changes don't touch drag state.
- **Week starts Monday** (ISO) per `getWeekStart` — day column headers (Sun–Sat) must stay consistent with this.

### Integration Points
- `feed/page.tsx` → `WeeklyPlannerView`: pass `onPrevWeek={() => setWeekStart(addDays(weekStart, -7))}`, `onNextWeek={() => setWeekStart(addDays(weekStart, 7))}`, `onToday={() => setWeekStart(getWeekStart(new Date()))}`
- `WeeklyPlannerView`: accept the three callbacks + derive "is current week" from comparing `weekStart` to `getWeekStart(new Date())` for Today button muting
- No backend changes needed

</code_context>

<specifics>
## Specific Ideas

- **Standard calendar nav row**: User confirmed the `← | label | →` layout explicitly — standard iOS/Android calendar header pattern.
- **Today replaces label**: When navigating away from the current week, the center of the nav row becomes a "Today" button. When on the current week, the center shows the date range and Today is muted.
- **Muted Today on current week**: Use `text-zinc-300` (or similar) to signal "already here" — no hidden or disabled state, just visual feedback.

</specifics>

<deferred>
## Deferred Ideas

### Transition Animation
Slide left/right animation when navigating prev/next week was discussed and deferred — instant swap is sufficient for Phase 11. Could be added in Phase 12 (visual polish) or a dedicated animation pass.

### Scroll Position Reset
Whether the horizontal scroll position should reset to Monday when changing weeks was identified but not discussed — left to planner's discretion (likely reset to scroll-start).

### Week Offset Limit
No explicit cap on how far users can navigate — left to planner's discretion (likely no limit for a personal app).

</deferred>

---

*Phase: 11-weekly-view-navigation*
*Context gathered: 2026-06-06*

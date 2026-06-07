# Phase 13: Unified TimelineCanvas - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace `DailyPlannerView` and `WeeklyPlannerView` with a single `TimelineCanvas` component. Day/Week toggle in `feed/page.tsx` passes a `columns` prop (1 or 7) — no component swap. The canvas has a fixed-width time axis pinned to the left, task columns filling the remaining width, and a shared `hourHeight` prop that callers set per mode. Week mode renders 7 viewport-fit columns with `DraggableTimeBlock` support and a today-column highlight.

</domain>

<decisions>
## Implementation Decisions

### Canvas Layout Architecture
- **D-01:** `TimelineCanvas` is a flex-row layout: a fixed ~48px left column for the time axis (hour labels), then `columns` task columns (each `flex-1`) filling the remaining width. No horizontal scroll in either mode.
- **D-02:** The time axis column renders all 24 hour labels vertically (same labels as the current `DailyPlannerView` axis). This is the single shared axis for all column counts.
- **D-03:** The task columns area is a relative container sized to `24 * hourHeight` pixels, with each column absolutely or flex-positioned side by side.

### Week Column Layout
- **D-04:** In week mode (`columns = 7`), all 7 columns are always visible at once — viewport-fit. Each column is `flex-1` of the width remaining after the time axis. No `overflow-x-auto` in week mode.
- **D-05:** In day mode (`columns = 1`), the single task column fills the full width after the time axis — identical behavior to the current `DailyPlannerView` minus the left-14 offset (which was the manual axis indent).

### hourHeight
- **D-06:** `TimelineCanvas` accepts `hourHeight` as a required prop — callers set it. `feed/page.tsx` passes `PX_PER_HOUR` (80) for day mode and `40` for week mode. The `WEEKLY_HOUR_HEIGHT` constant in `WeeklyPlannerView` is removed.
- **D-07:** Agent's discretion: 40px/hr for week mode (user said "you decide" between 40 and 48). At 40px/hr, full day = 960px (modest vertical scroll), a 30-min block = 20px (just below the 28px label-hide threshold for 30-min tasks — acceptable; 60-min blocks = 40px show the time label).

### Drag in Week Mode
- **D-08:** `TimelineCanvas` uses `DraggableTimeBlock` in **all** column counts, including week mode (7 columns). There is no separate non-draggable path for week.
- **D-09:** `DraggableTimeBlock` already handles touch and mouse pointer events. The `RESIZE_HANDLE_HEIGHT_PX` (20px) may need to be reduced for week mode narrow columns — agent's discretion on whether to scale the handle.

### Today Column Highlight
- **D-10:** In week mode, the today column gets: (1) `bg-zinc-50` background tint on the full column height, and (2) a `border-t-2 border-black` top border on the column header area. The header text is bold (as already implemented).
- **D-11:** In day mode (single column), no today highlight is shown — the existing red current-time indicator line already serves that purpose.

### Block Label Degradation (CANVAS-04)
- **D-12:** The existing `compact` prop on `PlannerTimeBlock` controls the layout (smaller text, tighter padding). In week mode, `TimelineCanvas` always passes `compact={true}` to `DraggableTimeBlock`/`PlannerTimeBlock`.
- **D-13:** The 28px threshold from CANVAS-04 is the height below which the time label is hidden. The current `PlannerTimeBlock` already hides the time label when `height < 36` — reduce this threshold to 28px in Phase 13 to match the requirement.

### Day/Week Toggle Animation (CANVAS-05)
- **D-14:** The 200ms column expand/collapse animation is a CSS transition on the task columns container. When `columns` prop changes (1 → 7 or 7 → 1), the individual column widths transition via `transition-all duration-200 ease`. This is applied on each column element (`flex-1` with `transition-all`).

### Week Nav Header
- **D-15:** The week navigation controls (prev/next/Today/date range) from `WeeklyPlannerView` move to the **caller** (`feed/page.tsx`). `TimelineCanvas` renders only the canvas — no nav header. The caller renders the nav above the canvas when in week mode. This keeps `TimelineCanvas` a pure rendering component.

### Column Headers
- **D-16:** In week mode, each column has a header row showing `DAY_ABBR DATE` (e.g., `Mon 9`). These headers live inside `TimelineCanvas` (not the caller) as they are part of the column structure. Height: same as current weekly headers (~28px).
- **D-17:** In day mode (`columns = 1`), no column header is shown — the planner date context comes from the page.

### Auto-scroll and Current-Time Indicator
- **D-18:** Auto-scroll to current time on mount (from `DailyPlannerView`) is retained in `TimelineCanvas` — it fires in both day and week modes.
- **D-19:** The red current-time indicator line (horizontal line + dot) is shown in day mode only. In week mode, the today column tint (D-10) provides the temporal anchor.

### Agent's Discretion
- hourHeight exact value for week mode: 40px/hr (user deferred to agent on 40 vs 48).
- Resize handle scaling in narrow week columns: agent to decide whether to keep 20px handle height or reduce.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/REQUIREMENTS.md` §CANVAS — CANVAS-01, CANVAS-02, CANVAS-03, CANVAS-04, CANVAS-05
- `.planning/ROADMAP.md` §Phase 13 — Goal, Dependencies, Success Criteria

### Components Being Replaced
- `frontend/src/components/timeline/DailyPlannerView.tsx` — being replaced; source of auto-scroll, current-time indicator, unscheduled section, all-day banner patterns to preserve
- `frontend/src/components/timeline/WeeklyPlannerView.tsx` — being replaced; source of week nav header, column header patterns to preserve

### Components to Modify
- `frontend/src/components/timeline/PlannerTimeBlock.tsx` — update 28px label-hide threshold (D-13); `compact` prop stays
- `frontend/src/components/timeline/DraggableTimeBlock.tsx` — used in all columns in new canvas; check resize handle for narrow columns (D-09)
- `frontend/src/components/timeline/timelineConstants.ts` — add `WEEKLY_HOUR_HEIGHT = 40` constant; `WEEKLY_HOUR_MARKERS` may change
- `frontend/src/components/timeline/index.ts` — export `TimelineCanvas`, remove `DailyPlannerView`/`WeeklyPlannerView` exports

### Feed Page (Wiring Point)
- `frontend/src/app/feed/page.tsx` — replace `DailyPlannerView`/`WeeklyPlannerView` conditional with single `TimelineCanvas`; pass `columns={viewMode === 'week' ? 7 : 1}` and appropriate `hourHeight`; move week nav header rendering here (D-15)

### Hooks
- `frontend/src/hooks/usePlannerTimeline.ts` — `PlannerItem` type; no changes expected but verify `weekDays` / `dayMap` wiring from `useWeeklyPlanner`
- `frontend/src/hooks/useWeeklyPlanner.ts` — still called from `feed/page.tsx`; passes data into `TimelineCanvas`

### Prior Phase Context
- `.planning/phases/11-weekly-view-navigation/11-CONTEXT.md` — week nav decisions (D-15 reverses nav ownership to caller)
- `.planning/phases/12-timeline-visual-polish/12-CONTEXT.md` — block color/icon/shadow/animation decisions (all apply to the new canvas)
- `.planning/phases/09-drag-to-reschedule/09-CONTEXT.md` — DraggableTimeBlock pattern (D-08 extends to week mode)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DraggableTimeBlock`: Handles all drag interactions (reschedule + resize + tap). Already pointer-event agnostic. Used in unified canvas for all columns.
- `PlannerTimeBlock`: Rendering-only. Accepts `hourHeight`, `compact`, `isDragging`, `item` (with `color`, `icon`). Minor threshold change (36px → 28px) for label hide.
- `timelineConstants.ts`: `PX_PER_HOUR = 80`, `BLOCK_MIN_HEIGHT = 24`, `SNAP_MINUTES`, `SNAP_PX`. Add `WEEKLY_HOUR_HEIGHT = 40`.
- `getWeekStart`, `addDays`, `formatWeekRange` (`dateUtils.ts`): reused for column headers and week nav.
- `DAY_ABBRS = ['Sun', 'Mon', ...]` — currently in `WeeklyPlannerView.tsx`, move to `TimelineCanvas` or a shared constant.

### Established Patterns
- **Flex-row layout for axis + content**: `DailyPlannerView` already uses `left-14` offset for task blocks to clear the 48px axis. New canvas makes this structural (flex column) rather than positional offset.
- **`compact` prop**: Gates text size, padding, and time-label visibility. Already correct for week use.
- **`transition: 'top 150ms ease, height 150ms ease'`** in `PlannerTimeBlock` for daily non-drag state. Retained.
- **`isDragActive` in `feed/page.tsx`**: Suppresses scroll during drag. Must remain wired when `TimelineCanvas` is in day mode.
- **All-day banner + unscheduled section**: Currently in `DailyPlannerView`. These are day-mode-only features. `TimelineCanvas` can accept optional `allDay` and `unscheduled` props rendered outside the canvas grid (above and below).

### Integration Points
- `feed/page.tsx` → `TimelineCanvas`: pass `columns`, `hourHeight`, `scheduled` (day) or `dayMap`/`weekDays` (week), `now`, drag callbacks, source filter props, `allDay`, `unscheduled`.
- The unified data interface challenge: daily uses `scheduled: PlannerItem[]`; weekly uses `dayMap: Map<string, PlannerItem[]>`. `TimelineCanvas` can accept `dayMap` always and derive the single-column case internally (`dayMap` with one entry for today), or accept both and switch. Agent's discretion.
- Source filter pills: Currently duplicated in both views. In `TimelineCanvas`, render them once (above the axis+columns area).

</code_context>

<specifics>
## Specific Ideas

- **Viewport-fit week columns**: User explicitly confirmed all 7 columns always visible — no horizontal scroll. At 430px mobile width with ~48px axis, each column is ~54px. This is the primary constraint driving CANVAS-04 compact degradation.
- **Neutral today highlight**: `bg-zinc-50` tint + `border-t-2 border-black` — stays within ordrctrl's zinc/black identity rather than introducing a blue column accent.
- **Drag everywhere**: User explicitly wants full `DraggableTimeBlock` support in week mode. Narrow columns mean the resize handle affordance needs to work in ~54px width.
- **hourHeight is caller's responsibility**: The canvas is purely a rendering component for a given hourHeight — it doesn't decide its own scale. This makes it reusable and testable.

</specifics>

<deferred>
## Deferred Ideas

### Current-time indicator in week mode
Adding a horizontal current-time line across the today column in week mode was considered but deferred — the `bg-zinc-50` tint already anchors "today" visually. Could be added in a future polish phase if desired.

### Resize handle scaling for narrow week columns
Whether to reduce `RESIZE_HANDLE_HEIGHT_PX` from 20px to a smaller value for compact week columns was left to agent's discretion. If drag-resize in week mode proves fiddly, a follow-on patch can adjust.

</deferred>

---

*Phase: 13-unified-timelinecanvas*
*Context gathered: 2026-06-06*

# Phase 12: Timeline Visual Polish - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Add `color` and `icon` fields to task data, render color-coded timeline blocks with a left accent + fill, let users set color from a palette in the create/edit sheet, add drop shadow elevation to blocks, and animate block position/height changes on save/release. Applies to both native tasks (via `NativeTask` schema fields) and integration items (via new `SyncOverride` enum values).

</domain>

<decisions>
## Implementation Decisions

### Color Palette
- **D-01:** Color picker in `TaskSheet` has two parts: (1) a row of 8 fixed swatches, and (2) a custom hex text input for overrides. Both write to the same `color` field (hex string).
- **D-02:** 8-color palette uses Tailwind 500-weight defaults: zinc (`#71717A`), red (`#EF4444`), orange (`#F97316`), amber (`#F59E0B`), green (`#22C55E`), blue (`#3B82F6`), violet (`#8B5CF6`), rose (`#F43F5E`).
- **D-03:** Default color for new native tasks with no color set: **blue `#3B82F6`** — assigned at creation in the route handler (no client-side random logic needed).

### Color + Icon Scope
- **D-04:** Both `color` and `icon` fields apply to **native tasks** (`NativeTask.color`, `NativeTask.icon`) AND **integration items** (via new `SyncOverride` types: `COLOR_OVERRIDE`, `ICON_OVERRIDE`).
- **D-05:** Add `COLOR_OVERRIDE` and `ICON_OVERRIDE` to the `OverrideType` enum in `schema.prisma`. The `value` field (already `String?`) stores the hex string for color and the emoji string for icon.
- **D-06:** Integration items with no `COLOR_OVERRIDE` render with the default blue (`#3B82F6`) — same default as native tasks. This ensures every block has a visible color from day one.

### Block Rendering
- **D-07:** `PlannerTimeBlock` reads `item.color` (hex string) and applies it via inline `style={{ borderColor: item.color, backgroundColor: \`${item.color}20\` }}` (20 = 12% alpha hex suffix for the fill). Tailwind classes handle everything else (radius, padding, layout).
- **D-08:** Drop shadow uses `shadow-sm` Tailwind class on the block wrapper (VIS-04). Applied in both daily and weekly views.
- **D-09:** Icon (emoji) prefix is rendered before the title text when `item.icon` is a non-empty string: `{item.icon ? <span>{item.icon}</span> : null}`. No dedicated icon component needed.

### Animation Scope (VIS-05)
- **D-10:** CSS transition (`transition-[top,height] duration-150 ease-in-out`) applied on the `PlannerTimeBlock` wrapper — **daily view only**. Weekly blocks are compact and animation looks busy at that density.
- **D-11:** Transition is suppressed during active drag: the `DraggableTimeBlock` wrapper passes an `isDragging` prop to `PlannerTimeBlock`, which adds `transition-none` when dragging. The existing `isDragActive` state in `feed/page.tsx` already covers the broader drag window.

### Feed Service / API
- **D-12:** `FeedItem` (returned by `/api/feed`) gains `color: string` and `icon: string | null` fields. For native tasks, these come from `NativeTask.color` and `NativeTask.icon`. For integration items, the feed service resolves the `COLOR_OVERRIDE` / `ICON_OVERRIDE` from the `SyncOverride` table (same pattern as existing `TITLE_OVERRIDE` resolution). Default blue is applied server-side when no color is set.
- **D-13:** New API route (PATCH) for setting color/icon on integration items: `PATCH /api/feed/:itemId/override` with body `{ type: 'COLOR' | 'ICON', value: string | null }`. Setting `value: null` deletes the override. Native task color/icon are updated via the existing task PATCH route.

### TaskSheet Changes
- **D-14:** Add a color swatch row (8 tappable circles) and a custom hex text input below the title field in `TaskSheet`. Active color shows a ring/check indicator. The sheet already has a `task` prop for edit mode — color is pre-filled from the task in edit mode.
- **D-15:** Icon input is a single text/emoji field below the color picker, labeled "Icon (emoji)". Free-form input — no emoji picker library needed.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/REQUIREMENTS.md` §VIS — VIS-01, VIS-02, VIS-03, VIS-04, VIS-05
- `.planning/ROADMAP.md` §Phase 12 — Goal, Dependencies, Success Criteria

### Backend Schema + Services
- `backend/prisma/schema.prisma` — `NativeTask` model (add `color`, `icon`), `OverrideType` enum (add `COLOR_OVERRIDE`, `ICON_OVERRIDE`), `SyncOverride` model (existing pattern)
- `backend/src/feed/feed.service.ts` — existing `TITLE_OVERRIDE` resolution pattern (D-12 follows this)
- `backend/src/api/tasks.routes.ts` — existing task PATCH route (D-13 adds color/icon to request body)

### Frontend Components
- `frontend/src/components/timeline/PlannerTimeBlock.tsx` — primary component to modify (D-07, D-08, D-09, D-10, D-11)
- `frontend/src/components/timeline/WeeklyPlannerView.tsx` — passes `hourHeight` to `PlannerTimeBlock`; no animation change here (D-10: daily only)
- `frontend/src/components/timeline/DraggableTimeBlock.tsx` — wraps `PlannerTimeBlock`; passes `isDragging` (D-11)
- `frontend/src/app/feed/page.tsx` — `TaskSheet` wiring, `isDragActive` state (D-11 reference)

### Frontend Hooks + Services
- `frontend/src/hooks/usePlannerTimeline.ts` — `PlannerItem` type (add `color`, `icon` fields)
- `frontend/src/services/feed.service.ts` — `FeedItem` type (add `color`, `icon` fields per D-12)

### Prior Phase Context
- `.planning/phases/10-tap-to-edit-quick-create/10-CONTEXT.md` — TaskSheet decisions (D-14 adds to the sheet established here)
- `.planning/phases/09-drag-to-reschedule/09-CONTEXT.md` — DraggableTimeBlock and isDragActive pattern (D-11 depends on this)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PlannerTimeBlock`: currently hardcodes `border-blue-500 bg-blue-50 text-blue-900`. Phase 12 replaces these with inline `style` for the dynamic hex values. All other layout/sizing classes remain.
- `SyncOverride.value` is already `String?` — no schema change needed to the field itself; only new `OverrideType` enum values required.
- `TITLE_OVERRIDE` in `feed.service.ts` shows the exact pattern for override resolution (D-12 mirrors this).
- `DraggableTimeBlock` already has an `isDragging` state from Phase 09 drag implementation.

### Established Patterns
- **Inline `style={{}}` permitted** for runtime-dynamic hex values (Tailwind can't express arbitrary hex at runtime).
- **Tailwind utility classes only** for static styles.
- **`isDragActive`** in `feed/page.tsx` is the existing drag-state signal — D-11 uses this to suppress animation.
- **Color hex alpha suffix**: `#3B82F6` + `20` → `#3B82F620` (12% alpha) is the semi-transparent fill per VIS-01.

### Integration Points
- Feed API response → `FeedItem` type → `PlannerItem` type → `PlannerTimeBlock` props: all three need `color` and `icon` fields added.
- `TaskSheet` currently has: title, time picker, duration stepper. Color swatch row + hex input + icon field are additive.
- New `PATCH /api/feed/:itemId/override` route handles integration item color/icon — does NOT reuse the task PATCH route (different model).

</code_context>

<specifics>
## Specific Ideas

- **Alpha suffix for fill**: `${color}20` appended to the 6-char hex gives 12% opacity fill — matches Structured's semi-transparent block style. Simpler than `rgba()` parsing.
- **Ring indicator on active swatch**: use `ring-2 ring-offset-1 ring-black` on the selected swatch circle — consistent with the existing border/fill pattern.
- **transition-none during drag**: add `transition-none` to `PlannerTimeBlock` classNames when `isDragging` is true. React re-renders on drag state change, so the class swap is instant.

</specifics>

<deferred>
## Deferred Ideas

### Integration item color/icon in edit sheet
Opening `TaskSheet` for integration items to set color/icon requires `PATCH /api/feed/:itemId/override` (D-13) but the sheet's edit mode was built for native tasks. Wiring the sheet to integration items is in scope (D-13/D-14 cover the API route), but the full edit sheet flow for integration items may need a separate tap target / gesture distinct from the native task tap-to-edit from Phase 10. Planner should decide whether to add a long-press or a dedicated "customize" button.

### Weekly block animation
Slide/fade animation on weekly blocks was discussed and deferred — weekly blocks are too compact for smooth animation. Could revisit in Phase 13 (Unified TimelineCanvas) if block density is addressed.

</deferred>

---

*Phase: 12-timeline-visual-polish*
*Context gathered: 2026-06-06*

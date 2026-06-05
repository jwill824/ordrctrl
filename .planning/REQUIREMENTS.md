# Requirements

This file is the explicit capability and coverage contract for the project.

## Active

### R001 — Native tasks support startAt (DateTime) and duration (Int, minutes) fields, enabling placement on a time-axis timeline

- Class: core-capability
- Status: active
- Description: Native tasks support startAt (DateTime) and duration (Int, minutes) fields, enabling placement on a time-axis timeline
- Why it matters: Tasks must have temporal coordinates to appear as positioned blocks on the timeline — the foundational data model for the entire visual planner
- Source: user
- Primary owning slice: M001/S01
- Supporting slices: none
- Validation: mapped
- Notes: Schema adds startAt and duration to NativeTask. endAt computed in API response. Default durations for quick-create (1, 5, 10, 15, 30 min).

### R002 — Vertical timeline day view showing a continuous time axis with hour markers, where native tasks appear as positioned blocks at their scheduled time, sized proportionally by duration

- Class: primary-user-loop
- Status: active
- Description: Vertical timeline day view showing a continuous time axis with hour markers, where native tasks appear as positioned blocks at their scheduled time, sized proportionally by duration
- Why it matters: The daily timeline is the core ADHD-friendly interface — seeing when things happen spatially makes the day navigable instead of overwhelming
- Source: user
- Primary owning slice: M001/S02
- Supporting slices: M001/S06
- Validation: mapped
- Notes: Pure CSS absolute positioning: container height = 24 * hourHeight, blocks positioned via top offset and height from duration.

### R003 — Flat task list view showing all native tasks, accessible via segmented toggle from the timeline view

- Class: primary-user-loop
- Status: active
- Description: Flat task list view showing all native tasks, accessible via segmented toggle from the timeline view
- Why it matters: Some contexts (quick scan, bulk management) are better served by a simple list than a time-axis view — both views serve different ADHD planning modes
- Source: user
- Primary owning slice: M001/S03
- Supporting slices: M001/S06
- Validation: mapped
- Notes: Refinement of existing feed page list behavior. Must not regress existing functionality.

### R004 — Seamless toggle between daily and weekly timeline views via segmented control

- Class: core-capability
- Status: active
- Description: Seamless toggle between daily and weekly timeline views via segmented control
- Why it matters: Structured's daily/weekly switch is a key interaction — users need to zoom between detail (today's plan) and context (this week's shape) without friction
- Source: user
- Primary owning slice: M001/S04
- Supporting slices: M001/S06
- Validation: mapped
- Notes: Segmented control at top of timeline view. Current day highlighted in weekly view.

### R005 — Horizontal-scroll weekly view showing 7 day columns side by side with abbreviated task blocks, swipeable left/right

- Class: core-capability
- Status: active
- Description: Horizontal-scroll weekly view showing 7 day columns side by side with abbreviated task blocks, swipeable left/right
- Why it matters: Week overview gives spatial context for the full week's shape — crucial for ADHD planning to see what's ahead without switching to a separate calendar app
- Source: user
- Primary owning slice: M001/S04
- Supporting slices: M001/S06
- Validation: mapped
- Notes: 2-3 days visible on mobile, swipe for more. Tap day column to navigate to that day's daily view.

### R006 — Quick-create task on timeline with minimal friction — tap to create at current time with default duration, optionally set specific time and duration

- Class: primary-user-loop
- Status: active
- Description: Quick-create task on timeline with minimal friction — tap to create at current time with default duration, optionally set specific time and duration
- Why it matters: Low-friction task creation is essential for ADHD users — if creating a task takes too many steps, the thought is lost. Must be as fast as Structured's quick-add.
- Source: user
- Primary owning slice: M001/S05
- Supporting slices: M001/S06
- Validation: mapped
- Notes: Default duration options: 1, 5, 10, 15, 30 min. Quick-create at now with default duration, or pick time + custom duration.

### R007 — Tasks without startAt appear in a visible Unscheduled section, never hidden or lost from the timeline view

- Class: continuity
- Status: active
- Description: Tasks without startAt appear in a visible Unscheduled section, never hidden or lost from the timeline view
- Why it matters: Users create tasks without scheduling them — those tasks must remain visible and accessible, not silently disappear from the timeline interface
- Source: inferred
- Primary owning slice: M001/S02
- Supporting slices: none
- Validation: mapped
- Notes: Separate section below or beside the time axis. Null startAt defaults to unscheduled, zero/negative duration defaults to minimum at render time.

### R008 — Consistent UI/UX theme and color palette across all timeline views — cohesive visual language for spacing, typography, component styling, and colors

- Class: quality-attribute
- Status: active
- Description: Consistent UI/UX theme and color palette across all timeline views — cohesive visual language for spacing, typography, component styling, and colors
- Why it matters: A piecemeal visual treatment undermines the craft feel that makes a planner tool trustworthy and pleasant to use daily — consistency signals reliability
- Source: user
- Primary owning slice: M001/S02
- Supporting slices: M001/S03, M001/S04, M001/S05, M001/S06
- Validation: mapped
- Notes: Established in S02 (daily timeline), carried through all subsequent slices. Distinct visual treatment for tasks vs events, consistent spacing and typography.

## Validated

## Deferred

### R009 — Timeline customization settings — configurable hour range, density, layout preferences

- Class: core-capability
- Status: deferred
- Description: Timeline customization settings — configurable hour range, density, layout preferences
- Why it matters: Users need to tailor the timeline to their daily patterns — early risers vs night owls, busy vs light days
- Source: user
- Primary owning slice: none
- Supporting slices: none
- Validation: unmapped
- Notes: Deferred to later milestone. MVP uses sensible defaults (reasonable hour range, standard density).

### R010 — Integration-synced items (Gmail, Microsoft Tasks, Apple Calendar) rendered on the timeline alongside native tasks

- Class: integration
- Status: deferred
- Description: Integration-synced items (Gmail, Microsoft Tasks, Apple Calendar) rendered on the timeline alongside native tasks
- Why it matters: The full vision is a unified planner across all sources — but the sync infrastructure works independently and the timeline MVP must prove the core experience first
- Source: user
- Primary owning slice: none
- Supporting slices: none
- Validation: unmapped
- Notes: SyncCacheItem already has startAt/endAt fields. Deferred to later milestone — existing sync stays as-is, just not rendered on the new timeline yet.

### R011 — Drag-to-reschedule tasks on the timeline by dragging blocks to new time positions

- Class: differentiator
- Status: deferred
- Description: Drag-to-reschedule tasks on the timeline by dragging blocks to new time positions
- Why it matters: Direct manipulation of time blocks is the most intuitive rescheduling interaction — but getting the core visual planner right comes first
- Source: user
- Primary owning slice: none
- Supporting slices: none
- Validation: unmapped
- Notes: Deferred to later milestone. Pure CSS positioning approach is pointer-event ready for future drag implementation.

### R012 — Timeline color and emoji personalization — choose colors and emoji for tasks as you create them

- Class: differentiator
- Status: deferred
- Description: Timeline color and emoji personalization — choose colors and emoji for tasks as you create them
- Why it matters: Visual personalization makes the planner feel like your own space and helps with ADHD task differentiation through visual cues
- Source: user
- Primary owning slice: none
- Supporting slices: none
- Validation: unmapped
- Notes: Deferred to later milestone alongside R009 (customization settings).

## Out of Scope

## Traceability

| ID | Class | Status | Primary owner | Supporting | Proof |
|---|---|---|---|---|---|
| R001 | core-capability | active | M001/S01 | none | mapped |
| R002 | primary-user-loop | active | M001/S02 | M001/S06 | mapped |
| R003 | primary-user-loop | active | M001/S03 | M001/S06 | mapped |
| R004 | core-capability | active | M001/S04 | M001/S06 | mapped |
| R005 | core-capability | active | M001/S04 | M001/S06 | mapped |
| R006 | primary-user-loop | active | M001/S05 | M001/S06 | mapped |
| R007 | continuity | active | M001/S02 | none | mapped |
| R008 | quality-attribute | active | M001/S02 | M001/S03, M001/S04, M001/S05, M001/S06 | mapped |
| R009 | core-capability | deferred | none | none | unmapped |
| R010 | integration | deferred | none | none | unmapped |
| R011 | differentiator | deferred | none | none | unmapped |
| R012 | differentiator | deferred | none | none | unmapped |

## Coverage Summary

- Active requirements: 8
- Mapped to slices: 8
- Validated: 0
- Unmapped active requirements: 0

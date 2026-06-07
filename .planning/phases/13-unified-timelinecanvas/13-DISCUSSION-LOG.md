# Phase 13: Unified TimelineCanvas - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-06
**Phase:** 13-unified-timelinecanvas
**Areas discussed:** Week column layout, hourHeight in week mode, Drag in week mode, Today column highlight

---

## Week Column Layout

### Column fit

| Option | Description | Selected |
|--------|-------------|----------|
| Viewport-fit (all 7 columns always visible, each ~1/7th viewport width) | No horizontal scroll; narrow columns force CANVAS-04 degradation | ✓ |
| Horizontal scroll | Columns have min-width, user scrolls to see all 7 (current behavior) | |
| You decide | | |

**User's choice:** Viewport-fit — all 7 always visible

### Time axis

| Option | Description | Selected |
|--------|-------------|----------|
| Shared time axis pinned left, columns to the right — flex row layout | Fixed ~48px axis column, task columns fill remaining width | ✓ |
| Separate mini time axis per column (current weekly behavior, just deduplicated) | Keeps per-column mini axes | |
| You decide | | |

**User's choice:** Shared time axis pinned left — flex row layout

---

## hourHeight in Week Mode

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 24px/hr compact | Full day fits without scrolling (current behavior) | |
| Increase to 40–48px/hr | More spatial detail, vertical scroll in week mode | ✓ |
| Match daily at 80px/hr | Consistent behavior, full vertical scroll in both modes | |
| You decide | | |

**User's choice:** Increase to 40–48px/hr

### Specific value

| Option | Description | Selected |
|--------|-------------|----------|
| 40px/hr | More compact, reduces scroll distance | |
| 48px/hr | More breathing room | |
| You decide (pick whichever looks right) | | ✓ |

**User's choice:** You decide → agent to pick 40px/hr

---

## Drag in Week Mode

| Option | Description | Selected |
|--------|-------------|----------|
| Tap/view only in week mode | DraggableTimeBlock only in day mode | |
| Full drag support in week mode too | DraggableTimeBlock in all columns | ✓ |
| You decide | | |

**User's choice:** Full drag support in week mode — DraggableTimeBlock in all columns

---

## Today Column Highlight

### Style

| Option | Description | Selected |
|--------|-------------|----------|
| Light background tint on today column | bg-zinc-50 or similar | |
| Top border accent on today column header | Colored top border | |
| Both: tint + accent | | ✓ |
| You decide | | |

**User's choice:** Both — tint + accent

### Color scheme

| Option | Description | Selected |
|--------|-------------|----------|
| bg-blue-50 column tint + blue-500 top border | Matches default task color | |
| bg-zinc-50 column tint + black top border | Neutral/minimal | ✓ |
| You decide | | |

**User's choice:** bg-zinc-50 + black top border (neutral/minimal, stays in ordrctrl zinc/black identity)

---

## the agent's Discretion

- **hourHeight exact value for week mode**: Agent to use 40px/hr (user deferred on 40 vs 48)
- **Resize handle scaling in narrow week columns**: Agent to decide whether to keep 20px handle or reduce for narrow columns

## Deferred Ideas

- Current-time indicator in week mode (red line across today column) — deferred; today column tint provides sufficient temporal anchor
- Resize handle size tuning for narrow columns — left to agent; follow-on patch if needed

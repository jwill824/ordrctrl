# Phase 11: Weekly View Navigation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-06
**Phase:** 11-weekly-view-navigation
**Areas discussed:** Navigation control placement, Week label format, Data fetching scope, Today button visibility, Transition animation

---

## Navigation Control Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Props into WeeklyPlannerView | Pass prev/next/today callbacks; component owns its own header row | ✓ |
| In feed/page.tsx tab header | Nav arrows sit next to the Day/Week toggle in the top header bar | |

**User's choice:** Props into WeeklyPlannerView

| Option | Description | Selected |
|--------|-------------|----------|
| Left ← \| center label \| → Right | Standard calendar nav row, Today button inline or separate | ✓ |
| Left ← → Right with Today at far right | Arrows tight together, Today floated right | |

**User's choice:** Standard `← | center label | →` layout

| Option | Description | Selected |
|--------|-------------|----------|
| Today separate (below/above nav row) | Own row below/above the ← label → controls | |
| Today inline in center label (replaces label when not on current week) | Center swaps between date range and Today button | ✓ |
| Today inline at far right of same row | Fixed position at right end | |

**User's choice:** Today replaces the center label when not on the current week

---

## Week Label Format

| Option | Description | Selected |
|--------|-------------|----------|
| Date range: "Jun 1–7" or "Jun 30 – Jul 6" | Shows full span; adjusts for month-boundary weeks | ✓ |
| "Week of Jun 1" | Simpler, anchors to week start only | |
| Month + year: "June 2026" | Less precise but clean | |

**User's choice:** Date range format (e.g. "Jun 1–7")
**Notes:** Adjusts when the range spans a month boundary (e.g. "Jun 30 – Jul 6").

---

## Data Fetching Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Client-side only | Update weekStart, useWeeklyPlanner re-filters existing items | ✓ |
| Re-fetch with date-range API params | Add from/to query params to feed API for selected week | |

**User's choice:** Client-side only
**Notes:** User asked "what's typical?" — agent explained that personal productivity apps (Fantastical, Structured) fetch a broad window and navigate locally. Given fetchFeed has no date range params and dataset is bounded per user, client-side is the correct approach.

| Option | Description | Selected |
|--------|-------------|----------|
| No refresh on Today | Navigating back just resets weekStart, no API call | ✓ |
| Refresh on Today | Force-refresh to pick up new sync data | |

**User's choice:** No refresh on Today

---

## Today Button Visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Always visible | Tapping when on current week is a no-op | ✓ |
| Hidden when on current week | Only appears when weekOffset ≠ 0 | |

**User's choice:** Always visible

| Option | Description | Selected |
|--------|-------------|----------|
| Visually muted (text-zinc-300) on current week | Still tappable, signals "already here" | ✓ |
| Same style always | No visual change | |

**User's choice:** Visually muted when on current week

---

## Transition Animation

| Option | Description | Selected |
|--------|-------------|----------|
| Instant swap | weekStart updates, columns re-render immediately | ✓ |
| CSS slide animation | New week slides in from left/right (150–200ms) | |

**User's choice:** Instant swap for Phase 11

---

## Agent's Discretion

- Scroll position behavior on week change (not discussed — reset to scroll-start is the standard approach)
- Week offset limit (not discussed — no practical cap for a personal app)

## Deferred Ideas

- **Transition animation**: Slide left/right on prev/next — deferred, could be added in Phase 12 visual polish
- **Scroll position reset**: Whether horizontal scroll position resets on week change — left to planner's discretion
- **Week offset limit**: No explicit cap discussed — likely unlimited

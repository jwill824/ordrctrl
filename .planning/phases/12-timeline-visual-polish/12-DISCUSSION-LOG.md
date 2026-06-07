# Phase 12: Timeline Visual Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-06
**Phase:** 12-timeline-visual-polish
**Areas discussed:** Color palette design, Color + icon scope, Default color, Animation scope

---

## Color Palette Design

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed curated palette (8–12 swatches) | Simpler, consistent look | |
| Custom hex input | Free color picker, maximum flexibility | |
| Both — swatches + custom hex field | Curated swatches + hex override | ✓ |

**User's choice:** Both — 8 swatches + custom hex field

| Option | Description | Selected |
|--------|-------------|----------|
| 8 colors | Compact, fast to scan | ✓ |
| 12 colors | More variety, two rows of 6 | |
| 16 colors | Maximum variety, grid | |

**User's choice:** 8 colors

| Option | Description | Selected |
|--------|-------------|----------|
| Structured-style | red, orange, yellow, green, teal, blue, purple, pink | |
| Tailwind defaults | zinc, red, orange, amber, green, blue, violet, rose | ✓ |
| You decide | Pick a tasteful 8-color set | |

**User's choice:** Tailwind defaults (zinc, red, orange, amber, green, blue, violet, rose — all 500-weight)

---

## Color + Icon Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Native tasks only | color/icon on NativeTask; integration items get default | |
| Integration items too | Use SyncOverride for user-set color/icon per item | ✓ |
| Native now, integrations later | Defer integration item overrides to future phase | |

**User's choice:** Integration items too — `COLOR_OVERRIDE` and `ICON_OVERRIDE` added to `OverrideType` enum

| Option | Description | Selected |
|--------|-------------|----------|
| Visible default color (blue) | Integration items get default blue unless overridden | ✓ |
| No color unless explicitly set | Block renders neutral/zinc by default | |

**User's choice:** Default blue (`#3B82F6`) for all items with no color set

---

## Default Color

| Option | Description | Selected |
|--------|-------------|----------|
| Always blue (#3B82F6) | Single opinionated default, no logic | ✓ |
| Round-robin through palette | Each new task gets the next color in sequence | |
| Random from palette | Random color on each creation | |

**User's choice:** Always blue `#3B82F6` — assigned at creation server-side

---

## Animation Scope

| Option | Description | Selected |
|--------|-------------|----------|
| On release/save only | Transition fires on drag end or save; suppressed during drag | ✓ |
| All changes including drag snaps | Each 15-min snap animates | |
| You decide | Whatever feels most polished | |

**User's choice:** On release/save only — `transition-none` guard via `isDragActive`

| Option | Description | Selected |
|--------|-------------|----------|
| Both daily and weekly views | Animation on all timeline blocks | |
| Daily view only | Weekly blocks are compact; animation looks busy | ✓ |
| You decide | | |

**User's choice:** Daily view only

---

## Agent's Discretion

- Alpha suffix for fill color: `${color}20` (12% hex alpha) — cleaner than rgba parsing
- Ring indicator (`ring-2 ring-offset-1 ring-black`) for active palette swatch
- Icon input as simple text/emoji field — no emoji picker library needed
- Integration item edit flow: planner decides whether to add long-press or a "customize" button for tap target disambiguation vs. Phase 10 tap-to-edit

## Deferred Ideas

- **Weekly block animation**: deferred — compact blocks look too busy animated
- **Integration item full edit sheet**: scope of how to trigger the color/icon picker for integration items (tap target disambiguation with Phase 10 tap-to-edit) left to planner

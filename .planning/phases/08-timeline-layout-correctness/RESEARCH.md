# Phase 08: Timeline Layout Correctness — Research

**Researched:** 2026-06-05
**Domain:** React/TypeScript inline-style pixel math, scroll container threading
**Confidence:** HIGH — all findings verified directly from codebase source files

---

## Summary

Phase 08 is a surgical constant change. The entire scope is: replace `HOUR_HEIGHT = 64` with
`PX_PER_HOUR = 80` sourced from a new shared constants file, and fix three `font-bold` → `font-semibold`
drift instances in `DailyPlannerView.tsx` that the UI-SPEC checker flagged.

All three layout requirements (LAYOUT-01, LAYOUT-02, LAYOUT-03) are already **architecturally
satisfied** by the existing code — the formulas are correct, `currentTimeRef` and `scrollIntoView`
already exist. The only defect is the constant value (64 instead of 80) causing blocks and axis labels
to be 20% too short/misaligned.

No new packages. No scroll-container refactoring. No hook changes. `WeeklyPlannerView` has its own
`WEEKLY_HOUR_HEIGHT = 24` constant and is explicitly out of scope — it must not be touched.

**Primary recommendation:** Create `timelineConstants.ts`, update `DailyPlannerView.tsx` (swap
constant + fix font-bold drift), optionally update `PlannerTimeBlock.tsx` to import `BLOCK_MIN_HEIGHT`.
Three files total, ~20 lines changed.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Time-to-pixel conversion (LAYOUT-01, LAYOUT-02) | Browser/Client | — | Pure arithmetic at render time, no server involvement |
| Current-time auto-scroll (LAYOUT-03) | Browser/Client | — | `useEffect` + `scrollIntoView` after first paint |
| Hour axis labels | Browser/Client | — | Static array rendered once, no API |
| Task data (startAt, durationMinutes) | Data Layer (hook) | — | `usePlannerTimeline` owns splitting/filtering/duration calc |
| Scroll container | Browser/Client (feed/page.tsx) | — | `<div className="flex-1 overflow-y-auto">` in parent page owns scroll |

---

## Research Question Answers

### Q1: Where is `HOUR_HEIGHT` defined?

**VERIFIED:** `DailyPlannerView.tsx` line 9 — `const HOUR_HEIGHT = 64;` — defined as a
module-level constant inside the component file. No constants file exists today. No shared
barrel or hook exposes it. `WeeklyPlannerView.tsx` has its own independent `WEEKLY_HOUR_HEIGHT = 24`
at line 6 (different value, different file, different component — correctly separate).

---

### Q2: Does `PlannerTimeBlock` compute pixel values inline, or does `usePlannerTimeline` return pre-computed px?

**VERIFIED:** `PlannerTimeBlock.tsx` computes `top` and `height` **inline** using the `hourHeight`
prop passed from `DailyPlannerView`. `usePlannerTimeline` returns raw task data only (`scheduled`,
`unscheduled`, `now`) — zero pixel values. The data-to-pixel conversion lives entirely in the
component layer.

```
DailyPlannerView
  └─ owns: HOUR_HEIGHT constant, nowTop, hour-marker positions
  └─ passes: hourHeight={HOUR_HEIGHT} to PlannerTimeBlock
        └─ PlannerTimeBlock computes: top, height from hourHeight prop
```

---

### Q3: Exact formulas for block `top` and `height`? Any midnight offset?

**VERIFIED** from `PlannerTimeBlock.tsx` lines 13–16:

```ts
const start = new Date(item.startAt!);
const totalMinutes = start.getHours() * 60 + start.getMinutes();
const top = (totalMinutes / 60) * hourHeight;
const height = Math.max((item.durationMinutes / 60) * hourHeight, 24);
```

**No `TIMELINE_START_HOUR` offset.** The axis starts at midnight (hour 0). `start.getHours()`
returns local hours 0–23, so `top = 0` at midnight, `top = 9 * hourHeight` at 9 AM.

This is a midnight-origin absolute-position system. The formula is already correct —
changing `hourHeight` from 64 to 80 is the only required fix.

Verification at `PX_PER_HOUR = 80`:
| Duration | Computed | Floor? | Result |
|----------|----------|--------|--------|
| 30 min   | 40px     | No     | **40px** |
| 60 min   | 80px     | No     | **80px** |
| 30/60 ratio | 40/80 | —     | **0.5 exactly — LAYOUT-01 ✓** |

| Start time | totalMinutes | top at 80px/hr |
|------------|-------------|----------------|
| 09:00 AM | 540 | 720px = `9 * 80` |
| 9 AM axis marker | — | `9 * 80 = 720px` |
| Alignment | — | **exact — LAYOUT-02 ✓** |

---

### Q4: What scroll container does DailyPlannerView use after Phase 07?

**VERIFIED** from `feed/page.tsx` line 127:

```tsx
<div className={`flex-1 overflow-y-auto ${viewMode === 'week' ? 'overflow-x-auto' : 'overflow-x-hidden'} touch-pan-y`}>
```

This `<div>` is the **only scroll container** on the page. `DailyPlannerView` renders inside
`<main className="max-w-[40rem] w-full mx-auto px-5 pt-4 pb-4">` (line 142), which has no
`overflow` set — it does **not** create its own scroll context.

`scrollIntoView({ block: 'center' })` from inside `DailyPlannerView` will correctly walk up the
DOM to this `overflow-y-auto` div and scroll it. **No conflict.** No scroll-container threading
work needed for this phase.

---

### Q5: Current-time indicator — does `currentTimeRef` exist? Is `scrollIntoView` already called?

**VERIFIED** — both are already implemented and correct:

```tsx
// DailyPlannerView.tsx lines 34 and 37-39
const currentTimeRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  currentTimeRef.current?.scrollIntoView({ block: 'center' });
}, []);   // fires once on mount ✓
```

```tsx
// lines 96-103 — currentTimeRef is attached to the red-line indicator div
<div
  ref={currentTimeRef}
  className="absolute left-0 right-0 z-10 pointer-events-none"
  style={{ top: nowTop }}
>
  <div className="absolute left-12 right-0 h-px bg-red-500" />
  <div className="absolute left-11 w-2 h-2 rounded-full bg-red-500 -translate-y-[3px]" />
</div>
```

LAYOUT-03 is already architecturally complete. The only change needed: `nowTop` will
increase from `(nowMinutes / 60) * 64` → `(nowMinutes / 60) * 80`, which is correct
since the axis labels also move proportionally.

---

### Q6: How are timed vs. untimed tasks distinguished?

**VERIFIED** from `usePlannerTimeline.ts` lines 35–48:

Only items where **both** `startAt !== null AND endAt !== null` become `PlannerItem` in `scheduled`.
Items with `startAt` but no `endAt` go to `unscheduled` (tested explicitly in
`usePlannerTimeline.test.ts`). `PlannerTimeBlock` only renders items from `scheduled`,
so it always has a valid `startAt` and computed `durationMinutes`. No null-guard needed in
the block component.

---

### Q7: Tests for DailyPlannerView or PlannerTimeBlock layout math?

**VERIFIED:** None exist. The test suite covers `usePlannerTimeline` (data layer) thoroughly
in two files:
- `frontend/tests/unit/usePlannerTimeline.test.ts` — basic hook tests
- `frontend/tests/unit/hooks/usePlannerTimeline.test.ts` — more detailed hook tests

No test file for `DailyPlannerView`, `PlannerTimeBlock`, or the pixel math formulas.

**Wave 0 gap:** A new test file `tests/unit/components/timeline/PlannerTimeBlock.test.tsx`
should be created to cover the height/top formulas and LAYOUT-01 verification
(30 min block = exactly half 60 min block).

---

### Q8: Time axis column — how is it rendered?

**VERIFIED** from `DailyPlannerView.tsx` lines 83–93:

```tsx
{Array.from({ length: 24 }, (_, h) => (
  <div
    key={h}
    className="absolute left-0 right-0 border-t border-zinc-100"
    style={{ top: h * HOUR_HEIGHT }}    // ← uses HOUR_HEIGHT directly
  >
    <span className="absolute left-0 top-[-0.6rem] w-12 text-right pr-2 text-[0.65rem] text-zinc-400 leading-none select-none">
      {h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`}
    </span>
  </div>
))}
```

Each hour marker's `top` is `h * HOUR_HEIGHT`. At `PX_PER_HOUR = 80`, the 9 AM marker
lands at `top: 720px`, which matches the task block's `top` formula perfectly (LAYOUT-02).

**The label is tied to the border-top div** via `top: -0.6rem` offset on the `<span>`.
There is no separate label column — it's an absolutely-positioned element inside each
hour-row div.

---

## Current Architecture Summary

### Component Structure

```
feed/page.tsx
├── <div flex-1 overflow-y-auto>        ← THE scroll container (Phase 07 established)
│   └── <main max-w-[40rem]>
│       └── DailyPlannerView
│           ├── Source filter pills
│           ├── <div relative height=1536px>    ← 24 * 64 = 1536 (becomes 1920 after fix)
│           │   ├── Hour markers (24×) at top: h * 64  (becomes h * 80)
│           │   ├── currentTimeRef div at top: nowTop
│           │   └── PlannerTimeBlock (per scheduled item)
│           │       ├── top: (totalMinutes/60) * hourHeight
│           │       └── height: Math.max((durationMinutes/60) * hourHeight, 24)
│           └── Unscheduled section (FeedItemRow list)
```

### Data Flow

```
useFeed (items[]) → usePlannerTimeline → { scheduled: PlannerItem[], unscheduled: FeedItem[], now }
                                               ↓
                                         DailyPlannerView
                                         (hourHeight = 64 → 80)
                                               ↓
                                         PlannerTimeBlock (hourHeight prop)
                                         → top, height computed inline
```

### What Changes

| File | Current | Target | Lines affected |
|------|---------|--------|---------------|
| `timelineConstants.ts` (NEW) | — | 6 exported constants | n/a (new file) |
| `DailyPlannerView.tsx` | `const HOUR_HEIGHT = 64` | import from constants | line 9, + import, + 3× font-bold→font-semibold |
| `PlannerTimeBlock.tsx` | `24` inline floor | import `BLOCK_MIN_HEIGHT` | optional; line 16 |

---

## Exact Files and Lines to Change

### File 1: CREATE `frontend/src/components/timeline/timelineConstants.ts`

New file. No existing file to modify.

```ts
export const PX_PER_HOUR = 80;
export const TIMELINE_START_HOUR = 0;
export const TIMELINE_HOURS = 24;
export const TIMELINE_HEIGHT = TIMELINE_HOURS * PX_PER_HOUR; // 1920
export const BLOCK_MIN_HEIGHT = 24;
export const TIME_LABEL_WIDTH = 48;
```

---

### File 2: MODIFY `frontend/src/components/timeline/DailyPlannerView.tsx`

**Change A — Remove local constant, add import (lines 3–9):**
```diff
-import { useEffect, useRef } from 'react';
+import { useEffect, useRef } from 'react';
+import { PX_PER_HOUR, TIMELINE_HEIGHT } from './timelineConstants';
 import type { PlannerItem } from '@/hooks/usePlannerTimeline';
 ...
-const HOUR_HEIGHT = 64;
```

**Change B — `nowTop` calculation (line 42):**
```diff
-  const nowTop = (nowMinutes / 60) * HOUR_HEIGHT;
+  const nowTop = (nowMinutes / 60) * PX_PER_HOUR;
```

**Change C — CSS custom property (line 45):**
```diff
-    <div style={{ ['--hour-height' as string]: `${HOUR_HEIGHT}px` }}>
+    <div style={{ ['--hour-height' as string]: `${PX_PER_HOUR}px` }}>
```

**Change D — Timeline container height (line 80):**
```diff
-        style={{ height: `${24 * HOUR_HEIGHT}px` }}
+        style={{ height: `${TIMELINE_HEIGHT}px` }}
```

**Change E — Hour marker positions (line 87):**
```diff
-            style={{ top: h * HOUR_HEIGHT }}
+            style={{ top: h * PX_PER_HOUR }}
```

**Change F — PlannerTimeBlock prop (line 107):**
```diff
-          <PlannerTimeBlock key={item.id} item={item} hourHeight={HOUR_HEIGHT} />
+          <PlannerTimeBlock key={item.id} item={item} hourHeight={PX_PER_HOUR} />
```

**Change G — `font-bold` → `font-semibold` drift corrections (lines 52, 65, 114):**
The UI-SPEC typography section specifies `font-semibold` for all pill/label elements.
Three instances of `font-bold` in `DailyPlannerView.tsx` are drift from spec:

- Line 52: Source filter "All" button — `font-bold` → `font-semibold`
- Line 65: Individual source filter button — `font-bold` → `font-semibold`
- Line 114: "Unscheduled" section header — `font-bold` → `font-semibold`

---

### File 3: OPTIONALLY MODIFY `frontend/src/components/timeline/PlannerTimeBlock.tsx`

**Change A — Import `BLOCK_MIN_HEIGHT` (line 16):**
```diff
+import { BLOCK_MIN_HEIGHT } from './timelineConstants';
 ...
-  const height = Math.max((item.durationMinutes / 60) * hourHeight, 24);
+  const height = Math.max((item.durationMinutes / 60) * hourHeight, BLOCK_MIN_HEIGHT);
```

This is cosmetic (single-source-of-truth for the 24px floor). The formula behaviour is
identical. Recommended but not strictly required for requirement compliance.

---

### File 4: NO CHANGE — `frontend/src/hooks/usePlannerTimeline.ts`

The hook returns raw data (`durationMinutes` in minutes, `startAt` as ISO string). No pixel
values. No changes needed.

---

### File 5: NO CHANGE — `frontend/src/app/feed/page.tsx`

The scroll container (`flex-1 overflow-y-auto`) is already correctly scoped from Phase 07.
`DailyPlannerView` receives `scheduled`, `unscheduled`, `now` unchanged. No changes needed.

---

### File 6: NO CHANGE — `frontend/src/components/timeline/WeeklyPlannerView.tsx`

`WEEKLY_HOUR_HEIGHT = 24` is intentionally separate (compact weekly grid view).
This phase explicitly scopes to daily planner only.

---

## Key Risks and Gotchas

### Risk 1: `font-bold` Drift in `DailyPlannerView.tsx`

**What:** UI-SPEC specifies `font-semibold` for pills and section labels. `DailyPlannerView.tsx`
currently uses `font-bold` at lines 52, 65, and 114.

**Impact:** Visual inconsistency. The UI-SPEC checker flagged this as a non-blocking correction
that must be applied in this phase.

**Mitigation:** Three-line fix. Don't miss line 114 (the "Unscheduled" header) — it uses
`tracking-[0.1em]` (slightly tighter than pills at `0.08em`), which is intentional per spec.

---

### Risk 2: WeeklyPlannerView Must NOT Be Touched

**What:** `WeeklyPlannerView.tsx` has `WEEKLY_HOUR_HEIGHT = 24`. This is intentionally different
from the daily planner's 80px/hr — it's a compact thumbnail view.

**Mitigation:** The constants file (`timelineConstants.ts`) exports `PX_PER_HOUR = 80` for
daily view only. `WeeklyPlannerView` should NOT import from `timelineConstants.ts`.

---

### Risk 3: CSS Custom Property `--hour-height`

**What:** `DailyPlannerView` sets `style={{ '--hour-height': '64px' }}` on its outer wrapper.
This CSS variable is not consumed by anything in the current codebase (no `var(--hour-height)`
usage found in any `.tsx`/`.css` file). It appears to be forward-looking scaffolding.

**Mitigation:** Update the value to `${PX_PER_HOUR}px` = `'80px'` to keep it accurate.
No functional change since nothing consumes it yet — but keeping it stale at 64 would be
a future trap.

---

### Risk 4: Scroll Behavior on First Render Timing

**What:** `useEffect([], [])` fires after the **first paint**. If the timeline container
height hasn't been committed to the DOM yet, `scrollIntoView` might see `nowTop = 0`.

**Why it's not a problem:** The `currentTimeRef` div's `style={{ top: nowTop }}` is a render-time
inline style. By the time `useEffect` fires (post-paint), the DOM already reflects the correct
pixel position. `scrollIntoView` will see the correct position.

**Confirmed:** This is the existing pattern — it was already in Phase 07 with `HOUR_HEIGHT = 64`.
Changing to 80 doesn't change the timing.

---

### Risk 5: Timeline Height Jump (1536 → 1920px)

**What:** Timeline total height changes from `24 * 64 = 1536px` to `24 * 80 = 1920px` (+26%).
This is expected and intentional.

**Impact:** The auto-scroll moves proportionally (9 AM was at 576px, becomes 720px). The
`scrollIntoView({ block: 'center' })` call compensates automatically.

---

## Architecture Patterns

No new patterns introduced in this phase. The established pattern from Phase 07 applies:

- **Tailwind for static visual properties** — colors, borders, padding, font sizes
- **Inline `style={{}}` for runtime-computed pixel values** — `top`, `height`, `scrollTop`
- **No `@apply`** — not used in this codebase
- **No CSS variables set in component files** — exception: `--hour-height` on wrapper div (already present)

Source: [VERIFIED: codebase scan of `DailyPlannerView.tsx` and `PlannerTimeBlock.tsx`]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scroll-to-now | Manual `scrollTop = nowTop - height/2` | `scrollIntoView({ block: 'center' })` | Already implemented correctly; no scroll-container ref threading needed |
| Pixel math | Custom time-to-pixel helper | Inline arithmetic in component | Formula is trivial (`minutes / 60 * PX_PER_HOUR`); no abstraction needed |

---

## Package Legitimacy Audit

> This phase installs **zero external packages**. All changes are arithmetic corrections
> to existing TypeScript/React files.

No packages to audit. Slopcheck not required.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react |
| Config file | `frontend/vitest.config.ts` |
| Quick run command | `cd frontend && npx vitest run tests/unit/components/timeline/` |
| Full suite command | `cd frontend && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LAYOUT-01 | 30-min block height = exactly half 60-min block | unit | `npx vitest run tests/unit/components/timeline/PlannerTimeBlock.test.tsx` | ❌ Wave 0 |
| LAYOUT-02 | 9 AM task top = 9 AM axis marker top | unit | same file | ❌ Wave 0 |
| LAYOUT-03 | scrollIntoView called on mount with block:'center' | unit | same file | ❌ Wave 0 |

### Wave 0 Gaps

- [ ] `tests/unit/components/timeline/PlannerTimeBlock.test.tsx` — covers LAYOUT-01 (height ratio), LAYOUT-02 (top alignment), LAYOUT-03 (scroll call verified via mock)

*(All other test infrastructure is in place — Vitest, jsdom, @testing-library/react,
`tests/unit/setup.ts`, `vitest.config.ts` with `@` alias.)*

---

## Security Domain

This phase makes no changes to authentication, session management, access control, input
validation, cryptography, or data persistence. No ASVS categories apply.

The only "input" is a hard-coded compile-time constant (`PX_PER_HOUR = 80`). No user-supplied
values are reflected into the DOM via the changed code paths.

---

## Open Questions (All RESOLVED)

| # | Question | Answer |
|---|----------|--------|
| Q1 | Where is `HOUR_HEIGHT` defined? | `DailyPlannerView.tsx` line 9 — local module constant |
| Q2 | Pre-computed px or inline? | Inline in `PlannerTimeBlock`; hook returns raw data only |
| Q3 | Exact top/height formulas? Any offset? | `top = (totalMinutes/60) * hourHeight`; `height = Math.max((durationMinutes/60) * hourHeight, 24)`; midnight-origin, no offset |
| Q4 | Scroll container after Phase 07? | `feed/page.tsx` line 127 `<div flex-1 overflow-y-auto>` — no conflict |
| Q5 | currentTimeRef and scrollIntoView already exist? | Yes — lines 34 and 37-39 of DailyPlannerView.tsx |
| Q6 | Timed vs untimed distinction? | Both `startAt` AND `endAt` required for `scheduled`; `startAt`-only → `unscheduled` |
| Q7 | Tests for layout math? | None — Wave 0 must create `PlannerTimeBlock.test.tsx` |
| Q8 | Time axis rendering? | `Array.from({ length: 24 })` at `top: h * HOUR_HEIGHT`; label via `-0.6rem` offset span |

---

## Environment Availability

> Step 2.6: SKIPPED (no external dependencies — pure code/constant change, zero new packages)

---

## Assumptions Log

> No assumed claims. All findings were verified directly from codebase source files in this session.

**This table is empty:** All claims in this research were verified from the live codebase.

---

## Sources

### Primary (HIGH confidence)
- `frontend/src/components/timeline/DailyPlannerView.tsx` — full file read; HOUR_HEIGHT constant, scroll logic, hour marker rendering, font-bold instances
- `frontend/src/components/timeline/PlannerTimeBlock.tsx` — full file read; top/height formulas, hourHeight prop
- `frontend/src/hooks/usePlannerTimeline.ts` — full file read; data layer, no pixel values
- `frontend/src/app/feed/page.tsx` — full file read; scroll container at line 127
- `frontend/src/components/timeline/WeeklyPlannerView.tsx` — partial read; WEEKLY_HOUR_HEIGHT = 24 confirmed separate
- `frontend/tests/unit/usePlannerTimeline.test.ts` — full file read; no layout math tests
- `frontend/tests/unit/` — directory scan; no DailyPlannerView or PlannerTimeBlock test files
- `.planning/phases/08-timeline-layout-correctness/08-UI-SPEC.md` — full read; implementation checklist and pixel math spec

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from live codebase
- Architecture: HIGH — verified from live codebase
- Pitfalls: HIGH — derived from actual code inspection
- Pixel math: HIGH — arithmetic verified against spec

**Research date:** 2026-06-05
**Valid until:** 2026-07-05 (stable codebase — no fast-moving dependencies)

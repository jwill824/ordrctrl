---
phase: 08-timeline-layout-correctness
plan: 01
type: tdd
wave: 0
depends_on: []
files_modified:
  - frontend/tests/unit/components/DailyPlannerView.test.tsx
  - frontend/src/components/timeline/timelineConstants.ts
  - frontend/src/components/timeline/DailyPlannerView.tsx
  - frontend/src/components/timeline/PlannerTimeBlock.tsx
autonomous: false
requirements: [LAYOUT-01, LAYOUT-02, LAYOUT-03]

must_haves:
  truths:
    - "A 30-minute task block renders at exactly half the height of a 1-hour task block (40px vs 80px)"
    - "A task at 9:00 AM has its top edge at exactly 720px on the timeline (9 × 80)"
    - "A task at 9:30 AM has its top edge at exactly 760px on the timeline (9.5 × 80)"
    - "Opening the planner scrolls the viewport to center the red current-time indicator"
    - "PX_PER_HOUR, BLOCK_MIN_HEIGHT, TIMELINE_HEIGHT are exported from a single constants file"
  artifacts:
    - path: "frontend/src/components/timeline/timelineConstants.ts"
      provides: "Canonical PX_PER_HOUR = 80, BLOCK_MIN_HEIGHT = 24, TIMELINE_HEIGHT = 1920"
      exports: ["PX_PER_HOUR", "BLOCK_MIN_HEIGHT", "TIMELINE_HOURS", "TIMELINE_HEIGHT"]
    - path: "frontend/src/components/timeline/DailyPlannerView.tsx"
      provides: "Updated component using PX_PER_HOUR from constants; font-bold drift corrected"
      contains: "PX_PER_HOUR"
    - path: "frontend/tests/unit/components/DailyPlannerView.test.tsx"
      provides: "Pixel-math regression tests for LAYOUT-01 and LAYOUT-02"
      min_lines: 40
  key_links:
    - from: "frontend/src/components/timeline/DailyPlannerView.tsx"
      to: "frontend/src/components/timeline/timelineConstants.ts"
      via: "named import"
      pattern: "import.*PX_PER_HOUR.*timelineConstants"
    - from: "frontend/src/components/timeline/DailyPlannerView.tsx"
      to: "frontend/src/components/timeline/PlannerTimeBlock.tsx"
      via: "hourHeight prop"
      pattern: "hourHeight=\\{PX_PER_HOUR\\}"
---

<objective>
Replace the inline `HOUR_HEIGHT = 64` constant with a shared `PX_PER_HOUR = 80` exported from a new
`timelineConstants.ts` file, correcting the 20% proportionality deficit that causes task blocks and
axis labels to be misaligned. Fix three `font-bold` → `font-semibold` drift instances in
`DailyPlannerView.tsx`. Add pixel-math regression tests.

Purpose: LAYOUT-01 (30-min block = half height of 60-min block) and LAYOUT-02 (9 AM task aligns
exactly with 9 AM axis mark) are both violated by the current `HOUR_HEIGHT = 64`. Raising the
constant to 80 fixes both immediately because the formulas in `PlannerTimeBlock.tsx` are already
correct. LAYOUT-03 already works architecturally — auto-scroll is confirmed after the height change.

Output:
- `frontend/src/components/timeline/timelineConstants.ts` (new, ~6 lines)
- `frontend/src/components/timeline/DailyPlannerView.tsx` (modified: swap constant, fix 3× font-bold)
- `frontend/src/components/timeline/PlannerTimeBlock.tsx` (modified: import BLOCK_MIN_HEIGHT)
- `frontend/tests/unit/components/DailyPlannerView.test.tsx` (new, pixel-math regression suite)
</objective>

<execution_context>
@.github/gsd-core/workflows/execute-plan.md
@.github/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/08-timeline-layout-correctness/RESEARCH.md
@.planning/phases/08-timeline-layout-correctness/08-UI-SPEC.md
@frontend/src/components/timeline/DailyPlannerView.tsx
@frontend/src/components/timeline/PlannerTimeBlock.tsx
</context>

<tasks>

<!-- ═══════════════════════════════════════════════════════════
     WAVE 0 — TDD RED
     Create the test file. It imports PX_PER_HOUR from timelineConstants.ts
     which does not exist yet → compilation failure → RED state confirmed.
     ═══════════════════════════════════════════════════════════ -->

<task type="tdd">
  <name>Task 1 (Wave 0 — RED): Write failing pixel-math tests</name>
  <files>frontend/tests/unit/components/DailyPlannerView.test.tsx</files>
  <behavior>
    - Test A (LAYOUT-01a): Render PlannerTimeBlock with a 30-minute item and hourHeight={PX_PER_HOUR}. The rendered div's style.height resolves to "40px".
    - Test B (LAYOUT-01b): Render PlannerTimeBlock with a 60-minute item and hourHeight={PX_PER_HOUR}. The rendered div's style.height resolves to "80px".
    - Test C (LAYOUT-01 ratio): The 30-min height is exactly half the 60-min height (40 / 80 === 0.5).
    - Test D (LAYOUT-02a): Render PlannerTimeBlock with a task whose local start time is 09:00. The rendered div's style.top resolves to "720px" (9 × 80).
    - Test E (LAYOUT-02b): Render PlannerTimeBlock with a task whose local start time is 09:30. The rendered div's style.top resolves to "760px" (9.5 × 80).
    - Test F (constants): PX_PER_HOUR === 80 and BLOCK_MIN_HEIGHT === 24 and TIMELINE_HEIGHT === 1920.
    - Test G (LAYOUT-03): Mock `Element.prototype.scrollIntoView = vi.fn()` before rendering
      DailyPlannerView with a non-empty items array. After mount, assert `scrollIntoView` was
      called with `{ block: 'center' }`.
  </behavior>
  <action>
    Create `frontend/tests/unit/components/DailyPlannerView.test.tsx`.

    Imports: `describe`, `it`, `expect`, `vi`, `beforeEach` from vitest; `render` from @testing-library/react;
    `PlannerTimeBlock` from `@/components/timeline/PlannerTimeBlock`;
    `DailyPlannerView` from `@/components/timeline/DailyPlannerView`;
    `PX_PER_HOUR`, `BLOCK_MIN_HEIGHT`, `TIMELINE_HEIGHT` from
    `@/components/timeline/timelineConstants` (this import causes the RED failure — file doesn't
    exist yet).

    Helper `makePlannerItem(startLocalHour: number, startLocalMinute: number, durationMinutes: number)`:
    - Construct `startAt` using `new Date(2026, 5, 5, startLocalHour, startLocalMinute, 0).toISOString()`
      — local-time constructor avoids timezone drift in `.getHours()` / `.getMinutes()`.
    - Set `endAt` to `new Date(2026, 5, 5, startLocalHour, startLocalMinute + durationMinutes, 0).toISOString()`.
    - Return a minimal PlannerItem-shaped object with `id`, `title`, `startAt`, `endAt`,
      `durationMinutes`, `completed: false`. No other fields needed — PlannerTimeBlock only reads
      these five.

    For Tests A–E: call `render(<PlannerTimeBlock item={item} hourHeight={PX_PER_HOUR} />)`,
    grab `container.firstElementChild as HTMLElement`, and assert `element.style.height` /
    `element.style.top` using `toBe('40px')` etc.

    For Test F: import and assert constants directly — no rendering required.

    For Test G (LAYOUT-03):
    - `beforeEach(() => { vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(vi.fn()); })`
    - Mock any data hooks DailyPlannerView uses (e.g. mock `@/hooks/usePlannerTimeline` to return
      one item so the ref has something to target)
    - `render(<DailyPlannerView ... />)` wrapped in MemoryRouter if needed
    - Assert `expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'center' })`

    Do NOT add extra `vi.mock` calls for Tests A–F; PlannerTimeBlock has no side effects to isolate.
    Match the `describe / it` pattern used in `frontend/tests/unit/components/BottomTabBar.test.tsx`.
  </action>
  <verify>
    <automated>cd frontend &amp;&amp; pnpm vitest run tests/unit/components/DailyPlannerView.test.tsx 2>&amp;1 | tail -20</automated>
  </verify>
  <done>
    Test run exits with a non-zero code. The failure is a compilation / module-not-found error on
    `@/components/timeline/timelineConstants` — not a logic error. All six test cases are present
    in the file. This is the confirmed RED state.
  </done>
</task>

<!-- ═══════════════════════════════════════════════════════════
     WAVE 1 — GREEN (implementation)
     Create the constants file, update DailyPlannerView and
     PlannerTimeBlock to consume it. Tests must go green.
     ═══════════════════════════════════════════════════════════ -->

<task type="tdd">
  <name>Task 2 (Wave 1 — GREEN): Extract constant, update components, fix font drift</name>
  <files>
    frontend/src/components/timeline/timelineConstants.ts,
    frontend/src/components/timeline/DailyPlannerView.tsx,
    frontend/src/components/timeline/PlannerTimeBlock.tsx
  </files>
  <behavior>
    - After this task, all six tests in DailyPlannerView.test.tsx pass.
    - PX_PER_HOUR = 80 is the single source of truth; no component defines its own numeric 80.
    - DailyPlannerView renders the 24-hour axis at total height 1920px (24 × 80).
    - DailyPlannerView no longer contains the string "font-bold" anywhere.
    - PlannerTimeBlock.tsx no longer contains the bare number 24 as a min-height literal.
  </behavior>
  <action>
    **Step 1 — Create `frontend/src/components/timeline/timelineConstants.ts`** (new file, per UI-SPEC):
    Export four constants exactly as specified: `PX_PER_HOUR = 80`, `BLOCK_MIN_HEIGHT = 24`,
    `TIMELINE_HOURS = 24`, `TIMELINE_HEIGHT = TIMELINE_HOURS * PX_PER_HOUR`. No default export.

    **Step 2 — Update `frontend/src/components/timeline/DailyPlannerView.tsx`**:
    - Remove line 9 (`const HOUR_HEIGHT = 64;`).
    - Add named import: `import { PX_PER_HOUR } from './timelineConstants';`
    - Rename every occurrence of `HOUR_HEIGHT` → `PX_PER_HOUR` (affects: `nowTop` calculation,
      `style={{ height: \`${24 * HOUR_HEIGHT}px\` }}` on the axis container, `style={{ top: h * HOUR_HEIGHT }}`
      on each hour marker, `hourHeight={HOUR_HEIGHT}` prop on PlannerTimeBlock, the CSS variable
      `--hour-height`).
    - Fix three `font-bold` → `font-semibold` drift instances (per RESEARCH.md §UI-SPEC drift):
      - "All" filter pill button className string (~line 52)
      - Source filter button className string in `availableSources.map` (~line 65)
      - "Unscheduled" section header div className string (~line 114)
    Do NOT touch WeeklyPlannerView.tsx — it owns `WEEKLY_HOUR_HEIGHT = 24` independently.

    **Step 3 — Update `frontend/src/components/timeline/PlannerTimeBlock.tsx`**:
    - Add named import: `import { BLOCK_MIN_HEIGHT } from './timelineConstants';`
    - Replace the bare literal `24` in `Math.max(..., 24)` with `BLOCK_MIN_HEIGHT`.
    - No other changes. The `hourHeight` prop contract remains unchanged.
  </action>
  <verify>
    <automated>cd frontend &amp;&amp; pnpm vitest run tests/unit/components/DailyPlannerView.test.tsx 2>&amp;1 | tail -20</automated>
    <automated>cd frontend &amp;&amp; pnpm vitest run 2>&amp;1 | tail -10</automated>
  </verify>
  <done>
    All seven tests pass (Tests A–G). `grep -n 'HOUR_HEIGHT\|font-bold' frontend/src/components/timeline/DailyPlannerView.tsx`
    returns no matches. `grep -n 'PX_PER_HOUR' frontend/src/components/timeline/DailyPlannerView.tsx`
    shows at least five matches (nowTop, axis height, marker top, hourHeight prop, CSS var).
    `grep 'BLOCK_MIN_HEIGHT' frontend/src/components/timeline/PlannerTimeBlock.tsx` matches.
    Full vitest suite exits 0 — no regressions.
  </done>
</task>

<!-- ═══════════════════════════════════════════════════════════
     WAVE 2 — HUMAN VERIFY
     Visual and interactive confirmation that LAYOUT-01 through
     LAYOUT-03 hold in the running application.
     ═══════════════════════════════════════════════════════════ -->

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3 (Wave 2): Visual verify — proportional blocks and auto-scroll</name>
  <what-built>
    Extracted PX_PER_HOUR = 80 from a shared constants file. DailyPlannerView and PlannerTimeBlock
    now render at 80px/hour instead of 64px/hour. Font-bold drift corrected on filter pills and
    section header. All pixel-math unit tests pass.
  </what-built>
  <how-to-verify>
    1. Start the dev server: `cd frontend &amp;&amp; pnpm dev`
    2. Open the Planner tab.

    **LAYOUT-03 — Auto-scroll:** The timeline should open with the red current-time indicator
    visible and centered in the viewport — no manual scroll required.

    **LAYOUT-01 — Proportional heights:** Find a 30-minute task block and a 60-minute task block
    side-by-side (or add test tasks if needed). The 30-minute block must be visibly exactly half
    the height of the 60-minute block. At 80px/hour: 30-min = 40px tall, 60-min = 80px tall.

    **LAYOUT-02 — Axis alignment:** A task scheduled at 9:00 AM must have its top edge flush
    with the "9am" hour-marker line on the left axis. No gap, no overlap.

    **Filter pills:** The "All" and source-filter buttons should use medium-weight labels (semibold),
    not heavy bold. The "Unscheduled" section header should also be semibold.
  </how-to-verify>
  <resume-signal>
    Type "approved" if all four checks pass, or describe which check failed and what you observed.
  </resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| constants file → component | Compiled import — no runtime trust boundary; TypeScript enforces correctness at build time |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-08-01 | Tampering | timelineConstants.ts — PX_PER_HOUR value | accept | Read-only compile-time constant; no user-controlled input path. Value drift caught by pixel-math regression tests. |
| T-08-02 | Information Disclosure | WeeklyPlannerView.tsx | accept | File explicitly excluded from scope. No cross-contamination possible — distinct constant name (`WEEKLY_HOUR_HEIGHT`) in a separate file. |
| T-08-SC | Tampering | npm/pip/cargo installs | accept | No new packages in this phase. No supply-chain surface introduced. |
</threat_model>

<verification>
Full regression suite must pass after Wave 1:

```
cd frontend && pnpm vitest run
```

Specific pixel-math gate:
```
cd frontend && pnpm vitest run tests/unit/components/DailyPlannerView.test.tsx
```

Constant drift guard (run after Task 2 — both must return 0 matches):
```
grep -n 'HOUR_HEIGHT\|font-bold' frontend/src/components/timeline/DailyPlannerView.tsx
```

WeeklyPlannerView must not be touched (must return its original line 6 unchanged):
```
grep -n 'WEEKLY_HOUR_HEIGHT' frontend/src/components/timeline/WeeklyPlannerView.tsx
```
</verification>

<success_criteria>
1. `frontend/src/components/timeline/timelineConstants.ts` exists and exports `PX_PER_HOUR = 80`, `BLOCK_MIN_HEIGHT = 24`, `TIMELINE_HEIGHT = 1920`.
2. `DailyPlannerView.tsx` contains zero occurrences of `HOUR_HEIGHT` and zero occurrences of `font-bold`.
3. `PlannerTimeBlock.tsx` uses `BLOCK_MIN_HEIGHT` instead of the bare literal `24`.
4. All six pixel-math tests pass: 30-min → 40px height, 60-min → 80px height, 9:00 AM → 720px top, 9:30 AM → 760px top, PX_PER_HOUR === 80, TIMELINE_HEIGHT === 1920.
5. Full vitest suite passes with no regressions.
6. Human confirms LAYOUT-01 (block proportionality), LAYOUT-02 (axis alignment), and LAYOUT-03 (auto-scroll to current time) in the running app.
</success_criteria>

<output>
Create `.planning/phases/08-timeline-layout-correctness/08-01-SUMMARY.md` when done.
</output>

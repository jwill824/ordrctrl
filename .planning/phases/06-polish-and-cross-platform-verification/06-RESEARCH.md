# S06: Polish and Cross-Platform Verification — Research

**Date:** 2026-06-04
**Researcher:** Auto-mode (scout lane)

---

## Summary

S06 closes M001 by validating all five views (Feed, Timeline, Planner/Daily, Week, List) work correctly in Capacitor (mobile) and Tauri (desktop), fixing identified polish issues, and confirming no visual regressions. This is a low-risk slice — all core functionality was delivered in S01–S05. The work is primarily: (1) auditing touch targets and readability, (2) fixing a handful of specific issues found in the scout scan, and (3) verifying layout integrity across form factors via TypeScript + Vitest (since /feed requires OAuth and automated browser testing is blocked, per MEM013).

The scout scan found **no show-stopper regressions** from prior slices. All confirmed issues are addressable with targeted Tailwind class changes — no architectural changes, no new dependencies.

---

## Recommendation

**Three-task structure:**

1. **T01 — Touch target and readability fixes** — Fix the specific measurable issues found: filter pills too small, day header tap target in WeeklyPlannerView too small, hour marker text illegible. These are 3–6 file edits with Tailwind class changes.
2. **T02 — Cross-platform layout audit and fixes** — Address the dismiss-button hover-only problem (invisible on mobile), verify safe area insets are consistently applied, and spot-check the FeedPage layout on narrow (375px) viewports via code inspection.
3. **T03 — Final verification sweep** — Run tsc + vitest, perform code-pattern grep checks for all key views, and document the verification result. Same substitute verification path as S03–S05 (MEM013).

This ordering puts risk-reduction first (T01/T02) before the verification close (T03). None of the tasks are interdependent: T01 and T02 can proceed in any order.

---

## Implementation Landscape

### Files and Purposes

| File | What needs attention |
|---|---|
| `frontend/src/components/timeline/WeeklyPlannerView.tsx` | Day header touch target (py-1 → py-3), hour marker text (text-[0.5rem] → text-[0.65rem]) |
| `frontend/src/components/timeline/DailyPlannerView.tsx` | Filter pill touch target if present, verify safe-area scroll padding |
| `frontend/src/components/timeline/TimelineView.tsx` | Source filter pills touch target (py-0.5 → py-1.5) |
| `frontend/src/components/feed/FeedItem.tsx` | Dismiss button visibility — hover-only (opacity-0 group-hover:opacity-100) is invisible on mobile touch devices |
| `frontend/src/app/feed/page.tsx` | Verify segmented control touch padding, FAB safe-area anchor |

### Specific Issues Found (with file:line)

**Critical / High:**

1. **Dismiss button invisible on mobile** — `FeedItem.tsx:56`: `opacity-0 group-hover:opacity-100` — hover never fires on touch. This makes the dismiss/remove action unavailable on Capacitor. Fix: Always show on mobile, or use a long-press / swipe-to-dismiss pattern. Simplest fix: remove `opacity-0 group-hover:opacity-100`, always render visible (size is already small enough not to clutter).
   
2. **WeeklyPlannerView day header touch target too small** — `WeeklyPlannerView.tsx:100`: `py-1` gives ~24px height. Fix: `py-2` or `py-3` to reach 44px. Column is 112px wide (`w-28`) so this is achievable.

3. **Hour marker text illegible in weekly view** — `WeeklyPlannerView.tsx:119`: `text-[0.5rem]` (7.5px) is unreadable on any screen. Fix: `text-[0.6rem]` or `text-[0.65rem]`.

**Medium:**

4. **Source filter pills touch target small** — `TimelineView.tsx` filter pills: `px-2 py-0.5` produces ~16px height. Fix: `py-1` minimum.

5. **Weekly view no scroll affordance** — no visual indicator that horizontal scroll is possible. Fix: CSS `overflow-x: scroll` already present; can add a subtle fade gradient on the right edge via `after:` pseudo-element or just accept it (scroll snap already gives momentum feel).

6. **QuickCreateSheet `datetime-local` input on Android Capacitor** — `datetime-local` input renders differently on Android Chrome WebView vs iOS WKWebView. Not a blocking issue since the fields are functional, but should be noted in verification notes.

**Low / Cosmetic:**

7. **Segmented control button padding** — `FeedPage.tsx:139`: `px-3 py-1` — ~32px height. On mobile this may feel small. Bumping to `py-1.5` gets to ~36px which is more comfortable.

8. **TimelineSwipeContainer still present** — `TimelineSwipeContainer.tsx` implements swipe-based feed↔timeline switching via pointer events. This was replaced conceptually by the segmented control (MEM008) but the component file still exists. The container is still used in `TimelineView.tsx` (or `FeedPage.tsx`). This needs a quick grep to confirm whether it is actively rendered — if wired, the swipe may conflict with horizontal scroll in the weekly view. This is the highest-risk unknown of the slice.

### TimelineSwipeContainer Wire-Up Risk

This is worth explicit pre-verification. MEM008 says: "Chose: Replace the icon toggle (desktop) and TimelineSwipeContainer (mobile) with a unified segmented control for all view modes." But the component exists at `frontend/src/components/timeline/TimelineSwipeContainer.tsx`. The planner must confirm whether `FeedPage.tsx` still renders `TimelineSwipeContainer` — if so, it wraps the content in a horizontal gesture zone that could intercept swipe on the weekly view. A quick `grep -n "TimelineSwipeContainer" frontend/src/app/feed/page.tsx` resolves this before any work begins.

### Cross-Platform Platform Matrix

| Platform | Entry point | Viewport | Key concerns |
|---|---|---|---|
| Capacitor iOS | `https://localhost` scheme via WKWebView | 390px (iPhone 14) | Safe area insets (Dynamic Island), touch targets 44px, swipe conflicts |
| Capacitor Android | `https://localhost` scheme via WebView | 360px (common Android) | Touch targets, `datetime-local` input rendering |
| Tauri macOS | `tauri://localhost` WebView | 1200×800 default, resizable to 800×600 min | Mouse hover states work, layout at narrower widths |
| Vite dev browser | localhost:3000 | Variable | Primary dev surface; all code inspection verification is done here |

### Safe Area Handling (Current State)

- `FeedPage.tsx`: `pt-[env(safe-area-inset-top)]` on outer container ✓
- FAB: `bottom-[calc(1.5rem+env(safe-area-inset-bottom))]` ✓
- `QuickCreateSheet.tsx`: `pb-[calc(1.5rem+env(safe-area-inset-bottom))]` ✓
- `WeeklyPlannerView.tsx`: No explicit safe area handling on the scroll container — weekly view renders outside `max-w-[40rem]` wrapper and full-bleed; bottom padding may be needed if content extends behind home indicator
- `DailyPlannerView.tsx`: No explicit safe area padding at bottom of scroll container — unscheduled section at bottom may clip behind home indicator on iOS

Both weekly and daily views likely need `pb-[env(safe-area-inset-bottom)]` (or the calc variant with additional padding) on their scroll containers.

### Verification Path

Per MEM013, live browser/Capacitor verification is blocked by OAuth gate on `/feed`. The substitute path (established in S03, S04, S05) is:

1. `grep` key identifiers in changed files to confirm wiring
2. `cd frontend && node_modules/.bin/tsc --noEmit` — frontend TypeScript clean
3. `cd backend && node_modules/.bin/tsc --noEmit` — backend TypeScript clean
4. `cd frontend && npx vitest run` — all tests pass (currently 145/18 files)
5. Code inspection of each changed component for correctness

No new Vitest tests are expected for this slice (no new hooks or pure logic — all changes are Tailwind class adjustments and conditional rendering).

### Natural Task Seams

- **T01** is pure Tailwind class changes (no logic): `WeeklyPlannerView.tsx`, `TimelineView.tsx`, `DailyPlannerView.tsx` — safe-area padding additions, touch target enlargements, font size fixes. Can be done in one pass.
- **T02** is the `FeedItem.tsx` dismiss button fix (conditional visibility on touch vs desktop) + the `TimelineSwipeContainer` wire-up audit + scroll-container safe-area fixes for daily/weekly views.
- **T03** is the full verification sweep: tsc × 2, vitest, grep pattern checks.

### First Proof / Highest Risk

The **TimelineSwipeContainer audit** in T02 is the highest-risk item — if it is still wired in FeedPage and wraps the weekly view, horizontal swipe on the weekly view would be broken on mobile. This must be checked first within T02 before making other changes. Everything else is cosmetic/accessibility.

---

## Requirements Coverage

- **R008** (Consistent UI/UX theme and color palette): Addressed by touch target fixes, readability improvements, and safe area handling
- **R005** (Horizontal-scroll weekly view): Safe area and scroll affordance fixes directly support this
- **R006** (Quick-create on timeline): `datetime-local` cross-platform note is a verification item

No new requirements surface from this research.

---

## Known Scope Boundaries (Out of S06)

- Dark mode — not in scope, no design tokens established
- 12h/24h time format toggle — user setting, out of scope
- Haptic feedback — Capacitor plugin not installed
- Prev/next week navigation — explicitly deferred in S04 summary
- Drag-to-reschedule — R011, explicitly deferred milestone-wide
- E2E automation (Maestro) — scaffolding only per M001 context

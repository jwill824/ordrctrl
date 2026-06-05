# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

---

## Milestone: v1.0 — Timeline Visual Planner

**Shipped:** 2026-06-05
**Phases:** 6 | **Plans:** 22

### What Was Built

- NativeTask schema extended with `startAt`/`duration` fields, computed `endAt` in API — foundational time model for the planner
- DailyPlannerView: 24-hour scrollable canvas with absolutely-positioned task blocks, current-time indicator, and unscheduled section
- WeeklyPlannerView: 7 horizontal day columns with compact task blocks, swipeable, day-tap navigates to daily view
- 5-tab segmented control (Feed / Timeline / Planner / List / Week) replacing the old icon toggle and swipe container
- QuickCreateSheet: FAB-triggered bottom panel pre-filled with now + 30 min, optimistic insert with revert-on-fail
- Full polish pass: safe-area insets, touch-target sizing, dismiss button always visible, hour-marker legibility

### What Worked

- Vertical slice approach (one self-contained capability per phase) kept scope tight and each phase shippable independently
- Pure CSS absolute positioning for timeline rendering — no external calendar library, no canvas, minimal complexity
- Optimistic insert pattern from `useFeed` (completeItem / dismissItem) cleanly extended to `createScheduledTask`
- Segmented control over swipe: eliminated gesture conflicts with horizontal weekly scroll up-front

### What Was Inefficient

- Migrating from gsd-pi to gsd-core at milestone end added one extra session; migrating at project start would have been smoother
- UAT verification was browser-viewport-only — no actual Capacitor/Tauri build runs; this left an unresolved operational gap in the validation report

### Patterns Established

- `useFeed` owns all optimistic mutations; hooks never hold `setData` outside their own scope
- Segmented control is the canonical view-mode toggle for this app — no swipe gestures for primary navigation
- `startAt` stored as UTC in DB, converted to local for display in all components
- Phase SUMMARYs with `one_liner` frontmatter field enables automated milestone archive generation

### Key Lessons

1. **Migrate planning tooling first** — switching from gsd-pi to gsd-core mid-milestone works but costs a session; do it at the start of a milestone
2. **Browser-viewport ≠ native build** — Playwright at 430×932 is good but doesn't catch Capacitor-specific rendering issues; schedule a real device build before milestone close
3. **FAB pattern scales** — pre-filling startAt=now+round(15) covers 80% of the quick-create use case; tap-on-timeline can be deferred

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Pattern |
|-----------|--------|-------|-------------|
| v1.0 | 6 | 22 | Vertical slices, pure-CSS timeline, optimistic mutations |

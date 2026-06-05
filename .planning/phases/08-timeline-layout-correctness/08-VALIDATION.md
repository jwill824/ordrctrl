---
phase: 08-timeline-layout-correctness
created: 2026-06-05
framework: Vitest v1.3.1 + @testing-library/react v14
---

# Phase 08 — Validation Map

## Test Framework

| Property | Value |
|----------|-------|
| Runner | Vitest v1.3.1 |
| Renderer | @testing-library/react v14 |
| Config | `frontend/vitest.config.ts` |
| Run command | `cd frontend && pnpm vitest run` |
| Targeted run | `cd frontend && pnpm vitest run tests/unit/components/DailyPlannerView.test.tsx` |

---

## Requirements → Test Coverage

| Req ID | Behavior | Test | Automated | File |
|--------|----------|------|-----------|------|
| LAYOUT-01 | 30-min block = 40px, 1-hr block = 80px, ratio = 0.5 | Tests A, B, C | ✓ unit | `DailyPlannerView.test.tsx` |
| LAYOUT-02 | 9:00 AM task top = 720px; 9:30 AM top = 760px | Tests D, E | ✓ unit | `DailyPlannerView.test.tsx` |
| LAYOUT-03 | scrollIntoView({block:'center'}) called on mount | Test G | ✓ unit | `DailyPlannerView.test.tsx` |
| Constants | PX_PER_HOUR=80, BLOCK_MIN_HEIGHT=24, TIMELINE_HEIGHT=1920 | Test F | ✓ unit | `DailyPlannerView.test.tsx` |

---

## Test Files to Create

| File | Tests | Covers |
|------|-------|--------|
| `frontend/tests/unit/components/DailyPlannerView.test.tsx` | A–G (7 tests) | LAYOUT-01, LAYOUT-02, LAYOUT-03, constants |

---

## Sampling Cadence

| Gate | Command | Expected |
|------|---------|---------|
| Wave 0 commit | `pnpm vitest run tests/unit/components/DailyPlannerView.test.tsx` | RED (module not found) |
| Wave 1 commit | same | GREEN (7/7 pass) |
| Wave 1 commit | `pnpm vitest run` | No regressions (164+ pass) |
| Phase gate | `pnpm vitest run` | All GREEN |

---

## Phase Gate Checklist

```bash
# 1. Pixel-math and scroll tests
cd frontend && pnpm vitest run tests/unit/components/DailyPlannerView.test.tsx
# Expected: 7/7 pass

# 2. No legacy HOUR_HEIGHT in timeline components
cd frontend && grep -rn "HOUR_HEIGHT" src/components/timeline/
# Expected: no matches

# 3. No font-bold in DailyPlannerView
cd frontend && grep -c "font-bold" src/components/timeline/DailyPlannerView.tsx
# Expected: 0

# 4. Constants file exists with correct values
cd frontend && grep "PX_PER_HOUR = 80" src/components/timeline/timelineConstants.ts
# Expected: 1 match

# 5. WeeklyPlannerView untouched
cd frontend && grep "WEEKLY_HOUR_HEIGHT" src/components/timeline/WeeklyPlannerView.tsx
# Expected: still present (unchanged)

# 6. Full suite — no regressions
cd frontend && pnpm vitest run
# Expected: 0 failures
```

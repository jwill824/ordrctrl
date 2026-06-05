---
phase: 9
slug: drag-to-reschedule
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-05
---

# Phase 09 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 1.3.1 + @testing-library/react |
| **Config file** | `frontend/vitest.config.ts` |
| **Quick run command** | `cd frontend && pnpm vitest run` |
| **Full suite command** | `cd frontend && pnpm vitest run` |
| **Estimated runtime** | ~5 seconds |

**jsdom limitation:** `setPointerCapture` / `releasePointerCapture` are not implemented in jsdom. Add to test setup:
```ts
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();
```

---

## Sampling Rate

- **After every task commit:** `cd frontend && pnpm vitest run`
- **After every plan wave:** `cd frontend && pnpm vitest run` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green (171 + new tests)
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Req | Behavior | Test Type | Command | File | Status |
|---------|-----|----------|-----------|---------|------|--------|
| W0-A | DRAG-01 | `snapToGrid` returns nearest 15-min interval | unit | `pnpm vitest run useDragToReschedule` | `tests/unit/hooks/useDragToReschedule.test.ts` | ❌ Wave 0 |
| W0-B | DRAG-01 | Drag 10px → snaps to 20px (1 interval) | unit | `pnpm vitest run useDragToReschedule` | `tests/unit/hooks/useDragToReschedule.test.ts` | ❌ Wave 0 |
| W0-C | DRAG-01 | Start clamped at midnight and 23:45 | unit | `pnpm vitest run useDragToReschedule` | `tests/unit/hooks/useDragToReschedule.test.ts` | ❌ Wave 0 |
| W0-D | DRAG-02 | Resize delta → snapped duration ≥ 15 min | unit | `pnpm vitest run useDragToReschedule` | `tests/unit/hooks/useDragToReschedule.test.ts` | ❌ Wave 0 |
| W0-E | DRAG-02 | Resize handle renders with `h-5` class | unit | `pnpm vitest run DraggableTimeBlock` | `tests/unit/components/DraggableTimeBlock.test.tsx` | ❌ Wave 0 |
| W0-F | DRAG-03 | `onReschedule` called with snapped ISO startAt on pointerUp | unit | `pnpm vitest run useDragToReschedule` | `tests/unit/hooks/useDragToReschedule.test.ts` | ❌ Wave 0 |
| W0-G | DRAG-03 | Revert animation triggered on `onReschedule` rejection | unit | `pnpm vitest run useDragToReschedule` | `tests/unit/hooks/useDragToReschedule.test.ts` | ❌ Wave 0 |
| W0-H | DRAG-04 | `setPointerCapture` called on pointerDown | unit | `pnpm vitest run DraggableTimeBlock` | `tests/unit/components/DraggableTimeBlock.test.tsx` | ❌ Wave 0 |
| W0-I | existing | DailyPlannerView Test G (auto-scroll) — add new optional props | unit | `pnpm vitest run DailyPlannerView` | `tests/unit/components/DailyPlannerView.test.tsx` | ✅ needs update |

---

## Wave 0 Files

- [ ] `frontend/tests/unit/hooks/useDragToReschedule.test.ts` — covers W0-A through W0-D, W0-F, W0-G
- [ ] `frontend/tests/unit/components/DraggableTimeBlock.test.tsx` — covers W0-E, W0-H
- [ ] `frontend/tests/unit/components/DailyPlannerView.test.tsx` — update Test G (add `onReschedule={vi.fn()} onResize={vi.fn()}`)

---

## Security Notes

No new security surface. The PATCH `/api/tasks/:id` endpoint already exists with:
- `requireAuth` guard
- Zod validation of `startAt` (ISO8601) and `duration` (int, min 1)

No new endpoints. No new auth flows.

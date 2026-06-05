---
phase: "05"
plan: "03"
---

# T03: Created QuickCreateSheet fixed bottom-panel component with title, startAt, and duration fields, local-to-UTC conversion, inline error display, and loading state.

**Created QuickCreateSheet fixed bottom-panel component with title, startAt, and duration fields, local-to-UTC conversion, inline error display, and loading state.**

## What Happened

Read AddTaskForm.tsx to extract the established styling patterns (label typography, input classes, error display, button styles). Created frontend/src/components/tasks/QuickCreateSheet.tsx from scratch. The component accepts onSubmit, onCancel, defaultStartAt (ISO string), and optional defaultDuration (default 30) props. A toDatetimeLocalValue helper converts the ISO defaultStartAt to a datetime-local string (YYYY-MM-DDTHH:mm) using local date components to avoid UTC-offset shift issues. On submit, the local datetime-local value is converted back to UTC ISO via new Date(localValue).toISOString(). The panel is fixed at the bottom of the viewport, full-width, max-w-[40rem] centered, with border-t border-zinc-200, using pb-[calc(1.5rem+env(safe-area-inset-bottom))] for safe-area padding matching FAB positioning. The submit button is disabled while loading or when title is empty or duration < 1. On promise rejection the error is shown inline with the border-l-2 border-red-500 style from AddTaskForm, and the form remains populated. TypeScript compiled clean with no errors.

## Verification

Ran `cd frontend && node_modules/.bin/tsc --noEmit` — exited 0 with no output, confirming clean TypeScript compilation.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd frontend && node_modules/.bin/tsc --noEmit` | 0 | pass | 8200ms |

## Deviations

none

## Known Issues

none

## Files Created/Modified

- `frontend/src/components/tasks/QuickCreateSheet.tsx`

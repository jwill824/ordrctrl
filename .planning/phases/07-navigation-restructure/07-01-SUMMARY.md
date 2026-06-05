---
phase: 07-navigation-restructure
plan: "01"
subsystem: frontend/navigation
tags: [navigation, layout, components, tdd, react-router]
dependency_graph:
  requires: []
  provides:
    - frontend/src/components/AppShell.tsx
    - frontend/src/components/BottomTabBar.tsx
    - frontend/src/components/Sidebar.tsx
  affects:
    - frontend/src/App.tsx
    - frontend/src/app/settings/integrations/page.tsx
tech_stack:
  added: []
  patterns:
    - Nested layout route (React Router v6 `<Route element={<Layout>}>`)
    - Shared AppShell pulling useInboxCount once, passing down as props
    - Fixed bottom tab bar (mobile) + fixed sidebar (desktop)
key_files:
  created:
    - frontend/src/components/AppShell.tsx
    - frontend/src/components/BottomTabBar.tsx
    - frontend/src/components/Sidebar.tsx
    - frontend/tests/unit/components/AppShell.test.tsx
    - frontend/tests/unit/components/BottomTabBar.test.tsx
    - frontend/tests/unit/components/Sidebar.test.tsx
  modified:
    - frontend/src/App.tsx
    - frontend/src/app/settings/integrations/page.tsx
decisions:
  - AppShell renders useInboxCount once and passes inboxCount as props to both BottomTabBar and Sidebar
  - IntegrationSettingsContent exported as named export; IntegrationSettingsPage default export kept for standalone route
  - BottomTabBar and Sidebar use startsWith for active detection (supports sub-path matching)
metrics:
  duration: "228s"
  completed: "2026-06-05"
  tasks_completed: 3
  files_changed: 8
---

# Phase 07 Plan 01: Navigation Restructure Summary

**One-liner:** Persistent AppShell layout with fixed BottomTabBar (mobile) + Sidebar (desktop), driven by a single nested React Router layout route and TDD-verified with 19 passing tests.

## What Was Built

### Wave 1A — RED Test Scaffold
Three test files created that fail immediately (import errors) because the component files didn't exist yet:
- `BottomTabBar.test.tsx` — 8 tests covering tab labels, active states, badge rendering (including 9+ cap), and container classes
- `Sidebar.test.tsx` — 7 tests covering wordmark, nav labels, active states, badge, and container classes
- `AppShell.test.tsx` — 4 tests verifying BottomTabBar/Sidebar/Outlet slot rendering

All three files committed in RED state: `0131a7d`

### Wave 1B — BottomTabBar and Sidebar Components
- **BottomTabBar** (`frontend/src/components/BottomTabBar.tsx`): Fixed bottom bar, 3 tabs (Planner/Inbox/Integrations) with 22×22 SVG icons, active detection via `startsWith`, inbox badge with 9+ cap, `md:hidden`
- **Sidebar** (`frontend/src/components/Sidebar.tsx`): Fixed left sidebar with 240px width, "ordrctrl" wordmark, AccountMenu, nav items with 16×16 SVG icons, active detection via `startsWith`, inbox badge, `hidden md:flex`

Both pass GREEN: 15/15 tests. Committed: `0493b74`

### Wave 2 — AppShell + Routing + Export
- **AppShell** (`frontend/src/components/AppShell.tsx`): Layout shell calling `useInboxCount()` once, rendering Sidebar + mobile header + Outlet + BottomTabBar
- **App.tsx**: Three individual ProtectedRoute wrappers replaced with a single nested layout route: `<Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>` containing `/feed`, `/inbox`, `/settings/integrations`
- **integrations/page.tsx**: Added `export` keyword to `IntegrationSettingsContent` for use in the nested route

AppShell tests pass GREEN: 4/4. Full suite: 19/19 tests. Committed: `f27a1a5`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] AppShell.test.tsx "ordrctrl" text assertion caused multiple-match error**
- **Found during:** Wave 2 test run
- **Issue:** `getByText('ordrctrl')` failed because AppShell renders "ordrctrl" in its mobile header *in addition to* the Sidebar mock also rendering "ordrctrl"
- **Fix:** Changed assertion to `getByTestId('sidebar')` to target the mock sidebar stub directly
- **Files modified:** `frontend/tests/unit/components/AppShell.test.tsx`
- **Commit:** `f27a1a5`

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (test)  | `0131a7d` | ✅ Failing tests committed before implementation |
| GREEN (feat) | `0493b74` + `f27a1a5` | ✅ Implementation passes all tests |

## Known Stubs

None — all components render real data from props.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes introduced.

## Self-Check: PASSED

- ✅ `frontend/src/components/AppShell.tsx` — exists
- ✅ `frontend/src/components/BottomTabBar.tsx` — exists
- ✅ `frontend/src/components/Sidebar.tsx` — exists
- ✅ `frontend/tests/unit/components/AppShell.test.tsx` — exists
- ✅ `frontend/tests/unit/components/BottomTabBar.test.tsx` — exists
- ✅ `frontend/tests/unit/components/Sidebar.test.tsx` — exists
- ✅ Commit `0131a7d` — RED test scaffold
- ✅ Commit `0493b74` — BottomTabBar and Sidebar
- ✅ Commit `f27a1a5` — AppShell + routing + export
- ✅ 19/19 tests passing
- ✅ TypeScript check clean

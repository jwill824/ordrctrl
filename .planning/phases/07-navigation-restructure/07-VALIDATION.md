---
phase: 07-navigation-restructure
created: 2026-06-04
framework: Vitest v1.3.1 + @testing-library/react v14
---

# Phase 07 — Validation Map

## Test Framework

| Property | Value |
|----------|-------|
| Runner | Vitest v1.3.1 |
| Renderer | @testing-library/react v14 |
| Config | `frontend/vitest.config.ts` |
| Run command | `cd frontend && npm test` |
| Targeted run | `cd frontend && npm test -- <file>` |

---

## Requirements → Test Coverage

| Req ID | Requirement | Test File | Test Cases | Status |
|--------|-------------|-----------|------------|--------|
| NAV-01 | 3-tab bottom bar renders on mobile | `tests/unit/components/BottomTabBar.test.tsx` | renders 3 tabs; active state; md:hidden | ❌ Wave 1A |
| NAV-02 | Planner tab: Day/Week toggle only | `tests/unit/components/AppShell.test.tsx` | tab routes to /feed; toggle switches mode | ❌ Wave 1A |
| NAV-03 | Inbox tab renders InboxPage | `tests/unit/components/AppShell.test.tsx` | tab routes to /inbox; InboxPage renders | ❌ Wave 1A |
| NAV-04 | Integrations tab renders IntegrationSettingsContent | `tests/unit/components/AppShell.test.tsx` | tab routes to /settings/integrations | ❌ Wave 1A |
| NAV-05 | Desktop ≥768px shows left sidebar | `tests/unit/components/Sidebar.test.tsx` | hidden md:flex; 3 nav items; active state | ❌ Wave 1A |

> Status legend: ❌ = not yet written (created in Wave 1A) → ✅ after plan execution

---

## Test Files to Create

| File | What It Tests |
|------|--------------|
| `frontend/tests/unit/components/AppShell.test.tsx` | NAV-02, NAV-03, NAV-04: routing, Outlet, single useInboxCount call |
| `frontend/tests/unit/components/BottomTabBar.test.tsx` | NAV-01, NAV-05: 3 tabs, active state, badge count, md:hidden |
| `frontend/tests/unit/components/Sidebar.test.tsx` | NAV-05: hidden md:flex, wordmark, active state, badge count |

---

## Sampling Cadence

| Gate | Command | Expected result |
|------|---------|----------------|
| Per Wave 1A commit | `npm test -- ...AppShell.test.tsx ...BottomTabBar.test.tsx ...Sidebar.test.tsx` | RED (components don't exist yet) |
| Per Wave 1B commit | same | GREEN (components created) |
| Per Wave 2 commit | `npm run typecheck` + `npm test -- ...AppShell.test.tsx` | GREEN |
| Per Wave 3A/3B commit | `npm run typecheck` | No errors in modified files |
| Phase gate (Wave 4B) | `npm test` | All tests GREEN |

---

## Phase Gate Checklist

```bash
# Run all before closing the phase

# 1. Component tests
cd frontend && npm test -- \
  tests/unit/components/AppShell.test.tsx \
  tests/unit/components/BottomTabBar.test.tsx \
  tests/unit/components/Sidebar.test.tsx

# 2. Full typecheck
cd frontend && npm run typecheck

# 3. No legacy chrome in FeedPage / InboxPage
cd frontend && grep -c "h-\[100dvh\]" src/app/feed/page.tsx src/components/inbox/InboxPage.tsx
# Expected: 0

# 4. No legacy FAB offset
cd frontend && grep -c "bottom-\[calc(1.5rem" src/app/feed/page.tsx
# Expected: 0

# 5. AppShell exports Outlet slot
cd frontend && grep -c "Outlet" src/components/AppShell.tsx
# Expected: >= 1

# 6. Full test suite
cd frontend && npm test
# Expected: 0 failures
```

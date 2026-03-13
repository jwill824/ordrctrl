# Implementation Plan: App Polish & Bug Fix Bundle

**Branch**: `012-app-polish-bugfix` | **Date**: 2025-07-24 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/012-app-polish-bugfix/spec.md`  
**Issues**: #45 (manual refresh bug), #41 (menu cleanup), #40 (dead code removal)

## Summary

Fix a P1 regression in `useFeed` where the polling loop inside `refresh()` hardcodes
`showDismissed: false` instead of forwarding the hook's own `showDismissed` option —
causing dismissed items to flicker/vanish during every refresh. Remove the now-redundant
`/settings/dismissed` redirect page and its associated dead service functions
(`getDismissedItems`, `DismissedItem`, `DismissedItemsResponse`). Verify and tighten the
navigation menu so every entry leads to a functional, current destination.

No new API endpoints, no schema changes, no new dependencies. All three issues are
pure surgical fixes to existing frontend code.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend + backend)  
**Primary Dependencies**: Next.js 14 App Router, React, Express, Prisma, BullMQ, Redis  
**Storage**: PostgreSQL (via Prisma), Redis (sync-status cache)  
**Testing**: Vitest (frontend `frontend/tests/`), Jest (backend `backend/tests/`)  
**Target Platform**: Web (desktop + mobile browser)  
**Project Type**: Full-stack web application (monorepo)  
**Performance Goals**: Refresh must surface new tasks within one polling cycle (~2 s after
sync worker updates `lastSyncAt`); no regression to existing p95 latencies  
**Constraints**: No full browser reload required; optimistic UI updates during polling
must not be clobbered; no new npm dependencies  
**Scale/Scope**: Single-user personal task manager; fix is isolated to 3–4 files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Verdict | Notes |
|---|-----------|---------|-------|
| I | Integration Modularity | ✅ PASS | No integration adapters touched |
| II | Minimalism-First | ✅ PASS | Actively removing UI surface area (dead route, dead service fn, stale menu item); no new surfaces added |
| III | Security & Privacy by Default | ✅ PASS | No token/credential handling touched |
| IV | Test Coverage Required | ✅ PASS | Tests required for refresh fix (see Phase 1); existing tests for removed code must be deleted or updated |
| V | Simplicity & Deferred Decisions | ✅ PASS | Fix uses existing patterns (`reloadFeed`, `showDismissed` option); zero new abstractions |

**Gate result: ALL PASS — no complexity tracking entry required.**

**Post-Phase-1 re-check**: Design confirmed. The polling loop fix is a one-line option
forwarding change. No new patterns or abstractions introduced. Gate still holds.

## Project Structure

### Documentation (this feature)

```text
specs/012-app-polish-bugfix/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output (minimal — no schema changes)
├── quickstart.md        ← Phase 1 output
└── tasks.md             ← Phase 2 output (speckit.tasks — not yet created)
```

### Source Code (files touched by this bundle)

```text
frontend/
├── src/
│   ├── hooks/
│   │   └── useFeed.ts                      # BUG FIX: polling loop showDismissed + includeCompleted
│   ├── services/
│   │   └── feed.service.ts                 # DEAD CODE: getDismissedItems(), DismissedItem, DismissedItemsResponse
│   └── app/
│       └── settings/dismissed/page.tsx     # DEAD CODE: redirect-only route — remove
└── tests/
    └── unit/
        ├── hooks/useFeed.test.ts            # UPDATE: add tests for refresh with showDismissed options
        └── services/feed.service.test.ts   # UPDATE: remove tests for deleted getDismissedItems()

backend/
└── (no changes required — sync endpoint and feed endpoint contracts unchanged)
```

**Structure Decision**: Web application layout (Option 2). Backend untouched by this
bundle; all changes are isolated to frontend `src/hooks/`, `src/services/`, and
`src/app/settings/dismissed/`.

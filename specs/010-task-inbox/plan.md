# Implementation Plan: Task Inbox

**Branch**: `010-task-inbox` | **Date**: 2026-03-11 | **Spec**: [spec.md](spec.md)
**GitHub Issue**: [#32](https://github.com/jwill824/ordrctrl/issues/32)

## Summary

New tasks synced from external integrations (Gmail, Apple Calendar, Microsoft To Do, Apple Reminders) currently land directly in the main feed. This feature introduces a **Task Inbox** — a staging area where all integration-sourced tasks appear first, requiring explicit user acceptance before entering the active feed.

**Technical approach**: Add a single boolean field `pendingInbox` to the existing `SyncCacheItem` model. All new items are created with `pendingInbox = true` (routes to inbox). Accepting flips the flag to `false` (routes to feed). Dismissing sets `pendingInbox = false` and creates a `SyncOverride(DISMISSED)`. A new `/inbox` page, service, and API route group handle the inbox surface. The feed query gains one additional filter clause.

## Technical Context

**Language/Version**: TypeScript 5 (backend Node.js 20, frontend Next.js 14)
**Primary Dependencies**: Fastify 4, Prisma 5, React 18, Tailwind CSS, BullMQ, Redis
**Storage**: PostgreSQL (via Prisma ORM)
**Testing**: Vitest (backend unit + contract), Jest + React Testing Library (frontend)
**Target Platform**: Web (desktop + mobile browser)
**Project Type**: Web application (monorepo: `backend/` + `frontend/`)
**Performance Goals**: Inbox count badge updates within 1 second of triage action; bulk accept/dismiss completes under 2 seconds
**Constraints**: Zero disruption to existing feed items (migration default = `false`); no new dependencies required
**Scale/Scope**: Single-user personal workspace; typically < 100 inbox items per sync cycle

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Integration Modularity | ✅ PASS | No integration adapter code changes; inbox is a delivery concern only |
| II. Minimalism-First | ✅ PASS | One new page, one flag, one service. No new dependencies. Every UI element has a concrete user scenario in the spec. |
| III. Security & Privacy by Default | ✅ PASS | No new auth flows; inbox inherits existing session auth. No new data persisted beyond existing cache TTL. |
| IV. Test Coverage Required | ✅ PASS | Unit + contract tests specified in quickstart.md. Feed regression tests required. |
| V. Simplicity & Deferred Decisions | ✅ PASS | Simplest model chosen (flag on existing entity vs. new table). Rationale in research.md Decision 1. |

**Post-design re-check**: All gates still pass. The `pendingInbox` flag approach introduces no new complexity beyond what the feature justifies. No unjustified violations.

## Project Structure

### Documentation (this feature)

```text
specs/010-task-inbox/
├── plan.md              ← this file
├── research.md          ← Phase 0 decisions
├── data-model.md        ← schema changes + state transitions
├── quickstart.md        ← implementation guide + test checklist
├── contracts/
│   └── inbox-api.md     ← API endpoint contracts
├── checklists/
│   └── requirements.md  ← spec quality checklist (all pass)
└── tasks.md             ← Phase 2 output (/speckit.tasks — not yet created)
```

### Source Code

```text
backend/
├── prisma/
│   ├── schema.prisma                        ← add pendingInbox to SyncCacheItem
│   └── migrations/
│       └── <timestamp>_add_pending_inbox/   ← new migration
├── src/
│   ├── inbox/
│   │   └── inbox.service.ts                 ← NEW: buildInbox, accept, dismiss, acceptAll, dismissAll, getCount
│   ├── api/
│   │   ├── inbox.routes.ts                  ← NEW: all /api/inbox/* route handlers
│   │   └── (feed.routes.ts unchanged)
│   ├── feed/
│   │   └── feed.service.ts                  ← MODIFIED: add pendingInbox=false filter
│   ├── sync/
│   │   └── cache.service.ts                 ← MODIFIED: set pendingInbox=true on create
│   └── server.ts                            ← MODIFIED: register inbox.routes.ts
└── tests/
    ├── unit/inbox/
    │   └── inbox.service.test.ts             ← NEW: 9 unit test cases
    └── contract/
        └── inbox.routes.test.ts              ← NEW: 6 contract test cases

frontend/
├── src/
│   ├── app/
│   │   └── inbox/
│   │       └── page.tsx                     ← NEW: /inbox route page
│   ├── components/
│   │   ├── inbox/
│   │   │   ├── InboxPage.tsx                ← NEW: full inbox view
│   │   │   ├── InboxGroup.tsx               ← NEW: per-source group with bulk actions
│   │   │   └── InboxItem.tsx                ← NEW: individual item row
│   │   └── AccountMenu.tsx                  ← MODIFIED: add Inbox link + count badge
│   ├── services/
│   │   └── inbox.service.ts                 ← NEW: API calls
│   ├── hooks/
│   │   └── useInbox.ts                      ← NEW: React hook with loading/error state
│   └── app/feed/
│       └── page.tsx                         ← MODIFIED: refresh badge uses inbox count
└── tests/unit/components/inbox/
    ├── InboxItem.test.tsx                   ← NEW
    └── InboxGroup.test.tsx                  ← NEW
```

**Structure Decision**: Web application (Option 2). Follows the existing `backend/src/<domain>/` + `backend/src/api/` separation used by `feed/feed.service.ts` and `feed.routes.ts`. Frontend follows the existing `components/<domain>/` pattern used by `integrations/` components.

## Complexity Tracking

> No Constitution violations — table not required.

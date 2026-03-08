# Implementation Plan: Uncheck Completed Tasks

**Branch**: `002-uncheck-completed` | **Date**: 2026-03-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-uncheck-completed/spec.md`

## Summary

Allow users to reopen completed tasks by unchecking them in the Completed section of the feed.
For native tasks, this sets `completed=false` in the database. For integration-sourced tasks,
this clears the `completedInOrdrctrl` flag and stores a Sync Override record to prevent future
sync cycles from re-completing the item. The user's local override always wins over source state.

## Technical Context

**Language/Version**: TypeScript 5.4 (backend: Node.js/Fastify; frontend: React/Next.js 14)
**Primary Dependencies**: Fastify (backend API), React + Tailwind CSS (frontend), Prisma ORM
**Storage**: PostgreSQL 16 (primary data), Redis 7 (session cache, BullMQ job queue)
**Testing**: Vitest + Supertest (backend), Playwright (frontend E2E)
**Target Platform**: Web (desktop + mobile browser)
**Project Type**: Web application (monorepo: `backend/` + `frontend/`)
**Performance Goals**: Uncomplete action reflects in UI immediately (optimistic update, <100ms perceived)
**Constraints**: Sync cycles MUST NOT overwrite a user's explicit reopen; one-way sync constraint unchanged
**Scale/Scope**: Per-user action; touches feed state, task service, and sync cache service

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Integration Modularity | ✅ PASS | Sync Override logic lives in feed service; no integration adapter code changes required |
| II. Minimalism-First | ✅ PASS | Feature is justified by concrete user scenario (US1/US2 in spec); no new UI surfaces added |
| III. Security & Privacy by Default | ✅ PASS | No new token handling; no new data persisted beyond task state flags |
| IV. Test Coverage Required | ✅ PASS | Unit tests for uncomplete service functions + route tests required (enforced in tasks) |
| V. Simplicity & Deferred Decisions | ✅ PASS | No new dependencies; Sync Override is a minimal extension to existing SyncCacheItem model |

**Complexity Tracking**: No violations. Schema already supports uncompleting (nullable fields). A new
`SyncOverride` record uses existing Prisma model pattern; no new infrastructure needed.

## Project Structure

### Documentation (this feature)

```text
specs/002-uncheck-completed/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── prisma/
│   ├── schema.prisma                         # Add SyncOverride model
│   └── migrations/                           # New migration for SyncOverride table
├── src/
│   ├── feed/
│   │   └── feed.service.ts                   # Add uncompleteNativeTask(), uncompleteSyncItem()
│   ├── tasks/
│   │   └── task.service.ts                   # Add uncompleteTask()
│   └── api/
│       ├── feed.routes.ts                    # Add PATCH /api/feed/items/:itemId/uncomplete
│       └── tasks.routes.ts                   # Add PATCH /api/tasks/:id/uncomplete
└── tests/
    ├── unit/feed.service.test.ts             # Unit tests for uncomplete functions
    └── contract/feed.routes.test.ts          # Route/contract tests

frontend/
├── src/
│   ├── services/
│   │   └── feed.service.ts                   # Add uncompleteItem() API call
│   ├── hooks/
│   │   └── useFeed.ts                        # Add uncompleteItem() with optimistic update
│   └── components/feed/
│       ├── CompletedSection.tsx              # Pass onUncomplete handler to FeedItemRow
│       └── FeedItem.tsx                      # Enable checkbox click for completed items
└── tests/
    └── e2e/feed.spec.ts                      # E2E test: uncheck completed task
```

**Structure Decision**: Web application (Option 2). Changes span both `backend/` and `frontend/`
in the existing monorepo structure. No new directories; modifications to existing service,
route, hook, and component files only, plus one new Prisma model and migration.

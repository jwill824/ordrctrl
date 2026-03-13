# Implementation Plan: Task Content Enhancements

**Branch**: `013-task-content-enhancements` | **Date**: 2025-07-17 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/013-task-content-enhancements/spec.md`  
**Issues**: #44 (Edit task description), #38 (Open task source link)

## Summary

Two complementary enhancements for synced tasks: (1) description overrides — users can write a
personal summary of any synced task, stored as a `DESCRIPTION_OVERRIDE` record in `SyncOverride`,
while the original integration body is always preserved and accessible; (2) source-link navigation
— a per-integration "Open in Gmail / To Do / Calendar" button derived from a new `url` field added
to `SyncCacheItem`, populated by each adapter at sync time.

Both features require schema additions (`body` + `url` on `SyncCacheItem`; `value` + new enum
value `DESCRIPTION_OVERRIDE` on `SyncOverride`), one new API endpoint
(`PATCH .../description-override`), and targeted frontend additions to `EditTaskModal` and
`FeedItem`. Neither feature applies to native (non-synced) tasks.

## Technical Context

**Language/Version**: TypeScript 5.x (backend Node 20 LTS + frontend Next.js 15 App Router)  
**Primary Dependencies**: Fastify (backend API), React 19, Prisma 5 ORM, PostgreSQL 16, Redis  
**Storage**: PostgreSQL via Prisma (primary), Redis (short-lived sync cache metadata)  
**Testing**: Vitest — `cd backend && pnpm test`, `cd frontend && pnpm test`  
**Target Platform**: Web (desktop + mobile browser); pnpm monorepo  
**Project Type**: Full-stack web service  
**Performance Goals**: No new queries on the hot read path beyond the existing feed build  
**Constraints**: Description override must not mutate the original synced body; sync cache TTL
≤24 h applies to `SyncCacheItem.body`; user-authored override text persists until the parent
`SyncCacheItem` is cascade-deleted  
**Scale/Scope**: Personal task manager, single-user per account; low write frequency

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Integration Modularity** | ✅ PASS | `body` + `url` extraction added individually to each adapter; no adapter cross-dependency introduced |
| **II. Minimalism-First** | ✅ PASS | Both features are backed by concrete user scenarios (#44, #38); UI additions are minimal (textarea + badge in modal, single button in feed row) |
| **III. Security & Privacy by Default** | ✅ PASS (justified) | `SyncCacheItem.body` stores email/calendar body text — permitted as "sync cache necessary for rendering"; inherits the 24 h TTL and cascade-delete. User-authored override text in `SyncOverride.value` contains no raw credentials or tokens. See Complexity Tracking below. |
| **IV. Test Coverage Required** | ✅ PASS | Unit tests required for new service logic, new endpoint, and new/updated components before merge |
| **V. Simplicity & Deferred Decisions** | ✅ PASS | No new dependencies added; pattern follows existing `userDueAt` / `SyncOverride` approach exactly |

**Post-Phase-1 re-check**: ✅ PASS — design confirmed to follow existing patterns with no new
abstractions.

## Project Structure

### Documentation (this feature)

```text
specs/013-task-content-enhancements/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── description-override.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── prisma/
│   ├── schema.prisma                          # CHANGE: body+url on SyncCacheItem; value+DESCRIPTION_OVERRIDE on SyncOverride
│   └── migrations/
│       └── 20260718000000_task_content_enhancements/  # NEW migration
├── src/
│   ├── integrations/
│   │   ├── _adapter/
│   │   │   └── types.ts                       # CHANGE: body?, url? on NormalizedItem
│   │   ├── gmail/
│   │   │   └── index.ts                       # CHANGE: extract url from messageId, body from snippet
│   │   ├── apple-calendar/
│   │   │   └── index.ts                       # CHANGE: extract url from VEVENT URL:, body from DESCRIPTION:
│   │   └── microsoft-tasks/
│   │       └── index.ts                       # CHANGE: extract url from webLink, body from body.content
│   ├── sync/
│   │   └── cache.service.ts                   # CHANGE: persist body+url in upsert
│   ├── feed/
│   │   └── feed.service.ts                    # CHANGE: FeedItem type + description override logic
│   └── api/
│       └── feed.routes.ts                     # NEW: PATCH /api/feed/items/:itemId/description-override
└── tests/
    └── unit/
        ├── feed.service.test.ts               # CHANGE: tests for description override CRUD
        └── feed.routes.description.test.ts    # NEW: endpoint integration tests

frontend/
├── src/
│   ├── services/
│   │   └── feed.service.ts                    # CHANGE: FeedItem type + setDescriptionOverride()
│   ├── hooks/
│   │   └── useFeed.ts                         # CHANGE: setDescriptionOverride handler
│   └── components/
│       ├── feed/
│       │   └── FeedItem.tsx                   # CHANGE: "edited" badge + "Open in [source]" button
│       └── tasks/
│           └── EditTaskModal.tsx              # CHANGE: description textarea + original body display
└── tests/
    └── unit/
        ├── components/feed/FeedItem.test.tsx  # CHANGE: new badge + link button test cases
        ├── components/tasks/EditTaskModal.test.tsx  # CHANGE: description edit test cases
        └── services/feed.service.test.ts     # CHANGE: setDescriptionOverride API call tests
```

**Structure Decision**: Web application (Option 2). Backend and frontend are separate packages
in the pnpm monorepo; each has its own test runner. No new packages, libraries, or directories
are introduced — all changes extend existing files following the established `userDueAt` / override
pattern.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Storing email body text in `SyncCacheItem.body` (Constitution III — sync cache exception) | The description-override feature requires the original body to remain accessible after the user saves an override; the original cannot be reconstituted from `rawPayload` because that field is intentionally minimal and excluded from API responses | Keeping body only in `rawPayload` is not viable — rawPayload is marked "never exposed in API responses" and is intentionally redacted (Apple Calendar stores `calData: '[redacted]'`); a dedicated `body` column is the only way to surface the text while honouring the existing privacy design |

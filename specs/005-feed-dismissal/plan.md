# Implementation Plan: Per-Item Feed Dismissal

**Branch**: `005-feed-dismissal` | **Date**: 2026-03-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-feed-dismissal/spec.md`

## Summary

Users need to permanently hide individual feed items they no longer care about. The feed currently has no item-level removal mechanism — every sync resurfaces all non-completed items regardless of user intent.

This feature extends the existing `SyncOverride` model (from `002-uncheck-completed`) with a new `DISMISSED` override type for sync-sourced items. Native tasks receive a `dismissed` boolean field directly on the model. The feed query layer is updated to filter out dismissed items. A new dismiss/restore API is added alongside the existing complete/uncomplete pattern. The frontend adds an optimistic dismiss affordance with session-scoped undo, and a dismissed items management page.

## Technical Context

**Language/Version**: TypeScript (Node.js backend, React frontend)
**Primary Dependencies**: Fastify (API), Prisma (ORM), Zod (validation), React Query (frontend state)
**Storage**: PostgreSQL via Prisma
**Testing**: Vitest (backend unit + contract tests)
**Target Platform**: Web (desktop + mobile browser)
**Project Type**: Web application (backend + frontend monorepo)
**Performance Goals**: Feed load time must not degrade regardless of dismissed item count; dismiss action confirms within 500ms
**Constraints**: Dismissed items excluded from all feed queries; SyncOverride infrastructure reused for sync items; native tasks use direct boolean field
**Scale/Scope**: Per-user dismissal state; paginated dismissed items list (20/page default)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Integration Modularity | ✅ PASS | Dismissal logic lives in feed service layer — no changes to adapter internals |
| II. Minimalism-First | ✅ PASS | Single action to dismiss; undo is session-scoped (no complex state machine); management page only added for P3 |
| III. Security & Privacy | ✅ PASS | Dismissal scoped per `userId`; no raw content stored beyond existing sync cache TTL |
| IV. Test Coverage | ✅ REQUIRED | Unit tests for `dismissFeedItem()` / `restoreFeedItem()`; contract tests for dismiss/restore endpoints; feed filter regression tests |
| V. Simplicity | ✅ PASS | `DISMISSED` enum value added to existing `OverrideType`; `dismissed` boolean on `NativeTask`; no new models or services |

**Complexity Tracking**: No violations. Feature reuses existing infrastructure throughout.

## Project Structure

### Documentation (this feature)

```text
specs/005-feed-dismissal/
├── plan.md              ← this file
├── research.md          ← Phase 0
├── data-model.md        ← Phase 1
├── quickstart.md        ← Phase 1
├── contracts/
│   └── api.md           ← Phase 1
└── tasks.md             ← Phase 2 (/speckit.tasks)
```

### Source Code

```text
backend/
├── prisma/
│   └── schema.prisma                          # Add DISMISSED to OverrideType; add dismissed to NativeTask
├── src/
│   ├── feed/
│   │   └── feed.service.ts                    # dismissFeedItem(), restoreFeedItem(), getDismissedItems(); update buildFeed() filter
│   └── api/
│       ├── feed.routes.ts                     # PATCH /:itemId/dismiss, DELETE /:itemId/dismiss, GET /dismissed
│       └── schemas/
│           └── feed.schemas.ts                # DismissedItemsQuery schema (pagination)

frontend/
├── src/
│   ├── services/
│   │   └── feed.service.ts                    # dismissItem(), restoreItem(), getDismissedItems()
│   ├── components/
│   │   ├── feed/
│   │   │   ├── FeedItem.tsx                   # Add dismiss button + undo toast
│   │   │   └── DismissedItemsPage.tsx         # P3: list + restore UI
│   └── hooks/
│       └── useFeed.ts                         # Optimistic update logic for dismiss/restore
```

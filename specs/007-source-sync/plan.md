# Implementation Plan: Inbound Source Sync

**Branch**: `007-source-sync` | **Date**: 2026-03-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/007-source-sync/spec.md`

## Summary

ordrctrl currently pulls tasks from integrations but ignores source-side state changes after import.
When a user completes a task in Microsoft Tasks or archives a Gmail email, the ordrctrl feed still
shows it as open. This feature closes that gap by:

1. Adding a `completedAtSource` boolean to `SyncCacheItem` so source completion state is tracked
   independently from the user's local `completedInOrdrctrl` state.
2. Extending the `NormalizedItem` interface with an optional `completed` boolean so adapters can
   report source completion explicitly.
3. Updating the Microsoft Tasks adapter to fetch all tasks (not just non-completed) and return
   the `completed` boolean in `NormalizedItem`.
4. Updating the Gmail adapter to detect inbox departure (archive/delete) or read-state as
   completion triggers, configurable per integration via a new `gmailCompletionMode` field.
5. Teaching the cache service to apply source completion to `completedInOrdrctrl` when no Reopened
   Override blocks it.
6. Adding a Gmail completion mode setting in the frontend integration settings.

## Technical Context

**Language/Version**: TypeScript — backend Node.js, frontend Next.js 14 / React 18
**Primary Dependencies**: Prisma ORM, BullMQ, existing IntegrationAdapter interface
**Storage**: PostgreSQL via Prisma — one schema migration required (new field + enum)
**Testing**: Vitest (both backend unit tests and frontend unit tests)
**Target Platform**: Web application (backend API + Next.js frontend)
**Project Type**: Web service (monorepo — backend/ + frontend/)
**Performance Goals**: Source state changes visible within one 15-minute sync cycle
**Constraints**: Must not break existing REOPENED override logic from spec 002
**Scale/Scope**: Affects all connected integrations for all users

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Integration Modularity | PASS | NormalizedItem extension is backward-compatible; each adapter changes only its own code |
| II. Minimalism-First | PASS | Gmail completion mode toggle is justified by concrete user scenario (FR-011); no extraneous UI |
| III. Security & Privacy | PASS | No new token/credential storage; gmailCompletionMode is non-sensitive config |
| IV. Test Coverage Required | PASS | Cache service logic + adapter changes must have unit tests (tracked in tasks) |
| V. Simplicity & Deferred Decisions | PASS | Set-difference approach for Gmail; no new dependencies required |

**All gates pass. Proceeding to Phase 1 design.**

## Project Structure

### Documentation (this feature)

```text
specs/007-source-sync/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── source-sync.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── prisma/
│   └── schema.prisma          # Add completedAtSource field + GmailCompletionMode enum
├── src/
│   ├── integrations/
│   │   ├── _adapter/
│   │   │   └── types.ts       # Add completed?: boolean to NormalizedItem
│   │   ├── gmail/
│   │   │   └── index.ts       # Detect inbox removal / read completion; respect gmailCompletionMode
│   │   └── microsoft-tasks/
│   │       └── index.ts       # Fetch all tasks; return completed boolean
│   ├── sync/
│   │   └── cache.service.ts   # Mark missing items completedAtSource; apply source completion
│   └── api/
│       └── integrations.routes.ts  # New PATCH endpoint for gmailCompletionMode
└── tests/
    └── unit/
        ├── source-sync.cache.test.ts      # Cache service source completion logic
        ├── gmail.source-completion.test.ts
        └── microsoft-tasks.source-completion.test.ts

frontend/
├── src/
│   ├── services/
│   │   └── integrations.service.ts  # Add updateGmailCompletionMode()
│   └── components/
│       └── integrations/
│           └── GmailCompletionModeSelector.tsx  # New settings toggle
└── tests/
    └── unit/
        └── components/integrations/
            └── GmailCompletionModeSelector.test.tsx
```

**Structure Decision**: Option 2 (web application). Changes are split across backend adapter/sync
layers and a small frontend settings component. No new top-level directories needed.

## Complexity Tracking

No constitution violations introduced. No complexity justification required.

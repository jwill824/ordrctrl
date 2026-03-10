# Implementation Plan: Multi-Account Support

**Branch**: `009-multi-account` | **Date**: 2026-03-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-multi-account/spec.md`

## Summary

Allow users to connect more than one account per integration service (e.g., personal + work Gmail). Each account syncs independently and is identified by its email address or a user-set nickname. The core change is replacing the `@@unique([userId, serviceId])` constraint on `Integration` with `@@unique([userId, serviceId, accountIdentifier])`, updating all three OAuth adapters to retrieve and store the account identifier, adding label/pause management endpoints, and updating the feed to show per-account source labels.

## Technical Context

**Language/Version**: TypeScript (Node.js 20, Next.js 14)
**Primary Dependencies**: Fastify (backend), Next.js + React 18 (frontend), Prisma ORM, BullMQ (sync queue), Vitest (tests)
**Storage**: PostgreSQL (via Prisma)
**Testing**: Vitest (backend + frontend), Supertest (contract tests)
**Target Platform**: Web (Linux server + browser)
**Project Type**: Web application (backend API + frontend SPA)
**Performance Goals**: No change from baseline — connect flow adds one `/me` API call for Microsoft (< 500ms)
**Constraints**: Zero downtime migration; existing single-account users must be unaffected
**Scale/Scope**: Max 5 accounts per user per service; affects all 3 existing integration adapters

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Integration Modularity | ✅ PASS | Changes are per-adapter (Gmail, Microsoft, Apple). Each adapter updated in isolation. The `IntegrationAdapter` interface extended minimally (`connect()` return type only). |
| II. Minimalism-First | ✅ PASS | All UI additions are justified by concrete user scenarios (US1-US3 in spec). No new primary surfaces added — multi-account expands the existing IntegrationCard. |
| III. Security & Privacy | ✅ PASS | `accountIdentifier` (email) is not a secret — it's a display identifier. Tokens remain encrypted at rest. The backfill script reads encrypted tokens only in-process (no plaintext exposure). |
| IV. Test Coverage | ✅ PASS | Tests planned for: adapter accountIdentifier extraction, 5-account limit, duplicate connect, label/pause endpoints, frontend card + hook. |
| V. Simplicity | ✅ PASS | New fields added to existing `Integration` model (no new tables). Grouping by serviceId done in frontend (no new backend concept). Pause is a single boolean. |

**Complexity Tracking**: No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/009-multi-account/
├── plan.md                          # This file
├── research.md                      # ✅ Complete
├── data-model.md                    # ✅ Complete
├── quickstart.md                    # ✅ Complete
├── contracts/
│   └── integration-api.md          # ✅ Complete
├── checklists/
│   └── requirements.md             # ✅ Complete
└── tasks.md                        # Phase 2 output (/speckit.tasks)
```

### Source Code

```text
backend/
├── prisma/
│   ├── schema.prisma                # Add accountIdentifier, label, paused; change unique
│   └── migrations/
│       └── …_add-multi-account/
│           ├── migration.sql        # Schema migration
│           └── backfill.ts          # Data migration: extract email from existing tokens
├── src/
│   ├── integrations/
│   │   ├── _adapter/
│   │   │   └── types.ts             # connect() return type; new error types
│   │   ├── gmail/
│   │   │   └── gmail.adapter.ts     # accountIdentifier from id_token
│   │   ├── microsoft-tasks/
│   │   │   └── microsoft-tasks.adapter.ts  # accountIdentifier from /me endpoint
│   │   ├── apple-calendar/
│   │   │   └── apple-calendar.adapter.ts   # accountIdentifier from credential email
│   │   └── integration.service.ts   # 5-account limit; duplicate account guard
│   ├── api/
│   │   └── integrations.routes.ts   # PATCH /label, PATCH /pause; error redirects
│   └── feed/
│       └── feed.service.ts          # source = label ?? accountIdentifier
└── tests/
    ├── unit/
    │   ├── integration.service.test.ts   # limit + dedup
    │   └── gmail.adapter.test.ts         # accountIdentifier extraction
    └── contract/
        └── integrations.test.ts          # new endpoints

frontend/
├── src/
│   ├── hooks/
│   │   └── useIntegrations.ts            # Group by serviceId; label/pause actions
│   ├── components/
│   │   └── integrations/
│   │       └── IntegrationCard.tsx       # Multi-account list; Add account button
│   ├── services/
│   │   └── integrations.service.ts       # updateLabel(), pauseIntegration()
│   └── app/
│       └── settings/integrations/
│           └── page.tsx                  # Duplicate/limit error handling
└── tests/
    └── unit/
        ├── components/integrations/
        │   └── IntegrationCard.test.tsx
        └── hooks/
            └── useIntegrations.test.ts
```

**Structure Decision**: Follows the existing web application layout (Option 2 from template). No new directories at the project root — all changes are within existing `backend/` and `frontend/` trees.


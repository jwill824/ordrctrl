# Implementation Plan: Apple iCloud Integration via App-Specific Password

**Branch**: `004-apple-basic-auth` | **Date**: 2026-03-08 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/004-apple-basic-auth/spec.md`

## Summary

Replace the broken Sign-in-with-Apple OAuth flow in both Apple Reminders and Apple Calendar adapters with iCloud Basic Auth (iCloud email + App-Specific Password) against `caldav.icloud.com`. The core change has four layers: (1) update the `IntegrationAdapter` interface to accept a discriminated union `connect(userId, payload: OAuthPayload | CredentialPayload)` payload — all existing OAuth adapters (Gmail, Microsoft) are migrated to wrap their `authCode` in `{ type: 'oauth', authCode }`; (2) rewrite both Apple adapters to use HTTP Basic Auth, throw `NotSupportedError` on OAuth-only operations, and implement graceful 401 handling; (3) add a credential entry form and one-click confirmation screen on the frontend for Apple services; (4) add one Prisma field (`calendarEventWindowDays`) on the `Integration` model and a service-layer endpoint for the per-user Apple Calendar time window preference. Credential storage reuses existing `encryptedAccessToken` (email) and `encryptedRefreshToken` (ASP) fields — no new model needed.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20 LTS (backend); React 18 + TypeScript (frontend)  
**Primary Dependencies**: Fastify (HTTP server), Prisma (ORM + migrations), BullMQ (sync queue), node-fetch (CalDAV HTTP), zod (input validation), AES-256-GCM via `backend/src/lib/encryption.ts`  
**Storage**: PostgreSQL via Prisma — one new field (`calendarEventWindowDays Int @default(30)`) on existing `Integration` model; one migration required  
**Testing**: Vitest (backend unit + integration tests); component tests via existing frontend test setup  
**Target Platform**: Node.js web server (Fastify) + React SPA  
**Project Type**: Web service (full-stack monorepo — `backend/` + `frontend/`)  
**Performance Goals**: Credential validation round-trip < 2s (single CalDAV PROPFIND); sync cycle < 30s per Apple adapter  
**Constraints**: No new Prisma model; no new external auth library; ASP format normalization (strip display dashes) before storage and use; must not regress Gmail / Microsoft Tasks behavior  
**Scale/Scope**: Per-user integrations; 4 adapters total; 2 adapters being reworked

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — see ✅ markers.*

| Principle | Assessment | Status |
|-----------|------------|--------|
| **I. Integration Modularity** | Apple adapters isolated in `integrations/apple-reminders/` and `integrations/apple-calendar/`. `IntegrationAdapter` interface updated but remains the single canonical contract. Gmail/Microsoft adapters updated at their call sites only — no cross-adapter dependencies. | ✅ PASS |
| **II. Minimalism-First** | Every new UI surface has a named spec user story: credential form (US-1), one-click confirmation (US-1 AC-4), event window selector (FR-016). No UI added without spec justification. | ✅ PASS |
| **III. Security & Privacy** | Credentials encrypted at rest via AES-256-GCM (`encrypt()`/`decrypt()`). Credential form submitted as `POST` body (never in URL/query string). Password field not logged. `encryptedRefreshToken` (ASP) cleared on final Apple disconnect. Masked email (`j***@icloud.com`) returned from API — never raw. | ✅ PASS |
| **IV. Test Coverage** | New tests required before merge: adapter unit tests (Basic Auth construction, 401 detection, ASP normalization, `NotSupportedError` throw), service-layer tests (credential propagation to second Apple service, disconnect cleanup), API route tests (credential endpoint, event window update). | ⚠️ REQUIRED — tests must be written |
| **V. Simplicity** | One new schema field justified (see Complexity Tracking). `NotSupportedError` is a simple throw — no middleware or decorator. Discriminated union keeps existing OAuth adapter call sites as thin wrappers (`{ type: 'oauth', authCode }`). | ✅ PASS (with justified exception) |

## Project Structure

### Documentation (this feature)

```text
specs/004-apple-basic-auth/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   └── api.md           ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (files changed by this feature)

```text
backend/
├── prisma/
│   └── schema.prisma                          # Add calendarEventWindowDays field
├── src/
│   ├── integrations/
│   │   ├── _adapter/
│   │   │   └── types.ts                       # OAuthPayload | CredentialPayload union; NotSupportedError
│   │   ├── apple-reminders/
│   │   │   └── index.ts                       # Full auth rewrite → Basic Auth
│   │   ├── apple-calendar/
│   │   │   └── index.ts                       # Full auth rewrite → Basic Auth + event window
│   │   ├── gmail/
│   │   │   └── index.ts                       # Wrap authCode in { type: 'oauth', authCode }
│   │   ├── microsoft-tasks/
│   │   │   └── index.ts                       # Wrap authCode in { type: 'oauth', authCode }
│   │   └── integration.service.ts             # connectIntegration() updated; credential propagation; disconnect cleanup; updateCalendarEventWindow()
│   └── api/
│       └── integrations.routes.ts             # POST /connect endpoint; PUT /event-window endpoint
│
frontend/
├── src/
│   ├── components/
│   │   ├── IntegrationCard.tsx                # Branch on apple serviceId → show CredentialForm or ConfirmationScreen
│   │   ├── AppleCredentialForm.tsx            # New: email + ASP inputs with guidance text
│   │   └── AppleConfirmationScreen.tsx        # New: masked email + "Connect with this account" CTA
│   └── services/
│       └── integrations.service.ts            # connectWithCredentials(); confirmWithExisting(); updateCalendarEventWindow()
```

**Structure Decision**: Full-stack monorepo (Option 2). Backend in `backend/src/`, frontend in `frontend/src/`. All integration code isolated under `backend/src/integrations/` per Constitution Principle I.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| One new Prisma schema field: `calendarEventWindowDays Int @default(30)` on `Integration` | FR-016 requires per-user configurable event window (7/14/30/60 days). Needs to persist across sessions and sync cycles. | Storing in `ConnectOptions` at connect-time only: would be lost after the first sync; not user-updatable post-connect. Storing as JSON in an existing field: violates type safety and Prisma query ergonomics. A separate `UserPreferences` model: over-engineering for a single integer per Apple Calendar integration. |

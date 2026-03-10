# Implementation Plan: GitHub Actions CI Pipeline

**Branch**: `006-ci-testing` | **Date**: 2026-03-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-ci-testing/spec.md`

## Summary

Establish a GitHub Actions CI pipeline that runs backend unit tests, backend contract tests, frontend lint, and frontend build verification on every PR and push to main. All results surface as named PR status checks, blocking merge on failure. Prerequisite: fix 16 pre-existing test failures so the pipeline starts with a clean green baseline.

## Technical Context

**Language/Version**: TypeScript / Node.js 20 (LTS)
**Primary Dependencies**: pnpm 9 (monorepo workspace), Vitest (backend tests), Next.js 14 (frontend), ESLint (lint)
**Storage**: PostgreSQL via Prisma in production; all backend tests use `vi.mock` for Prisma — no live DB required
**Testing**: `pnpm test` (all backend), `pnpm test:contract` (contract only), `pnpm lint` + `pnpm build` (frontend)
**Target Platform**: GitHub-hosted Ubuntu latest runner
**Project Type**: Monorepo — `backend/` (Fastify/Node.js API) + `frontend/` (Next.js app)
**Performance Goals**: Full CI run under 10 minutes
**Constraints**: No production secrets exposed to fork PRs; pnpm store cached across runs to minimize install time
**Scale/Scope**: 4 jobs per CI run (backend-unit, backend-contract, frontend-lint, frontend-build)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **Principle IV — Test Coverage** | ✅ REQUIRED | This spec is the mechanism by which Principle IV is enforced; CI enforces the zero-failure policy going forward |
| **Principle III — No Premature Complexity** | ✅ PASS | 4 jobs, GitHub-hosted runners, no custom infrastructure; simplest viable CI |
| **Development Workflow — PRs must pass automated tests** | ✅ ENABLING | This spec creates the infrastructure that makes this constitution rule enforceable |

No complexity violations. No Complexity Tracking table required.

## Project Structure

### Documentation (this feature)

```text
specs/006-ci-testing/
├── plan.md              # This file
├── research.md          # GitHub Actions patterns for pnpm monorepos
├── quickstart.md        # How to run CI locally; how to add a new job
├── contracts/
│   └── ci-workflow.md   # Workflow trigger/job contract (inputs, outputs, job names)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
.github/
└── workflows/
    └── ci.yml           # Single workflow file: 4 jobs, PR + push-to-main triggers

backend/
└── tests/
    ├── unit/
    │   ├── integration.service.test.ts   # Fix: AppError instanceof + mock headers
    │   ├── apple-calendar.sync.test.ts   # Fix: add headers.get to fetch mocks
    │   └── apple-reminders.sync.test.ts  # Delete: source module removed
    └── contract/
        └── integration-connect.routes.test.ts  # Fix: request body schema mismatch
```

**Structure Decision**: Option 2 (web application) — CI workflow goes in `.github/workflows/`; test fixes are in-place modifications to existing test files.

## Pre-existing Test Failures — Root Cause Analysis

All 16 failures fall into 4 categories. Each has a clear, surgical fix:

### Category 1 — Deleted source module (`apple-reminders.sync.test.ts`)
**Root cause**: `src/integrations/apple-reminders/index.js` was removed in a prior sprint (Apple Reminders removed). The test file was not cleaned up.
**Fix**: Delete `backend/tests/unit/apple-reminders.sync.test.ts`.

### Category 2 — Missing `headers` on fetch mocks (`apple-calendar.sync.test.ts`)
**Root cause**: The CalDAV adapter calls `discoverRes.headers.get('Location')` for redirect discovery (line 55 in `apple-calendar/index.ts`). The test mocks return `{ ok: true, text: async () => ... }` with no `headers` property — causing `TypeError: Cannot read properties of undefined (reading 'get')`.
**Fix**: Add `headers: { get: vi.fn().mockReturnValue(null) }` to all `mockFetch.mockResolvedValue*` calls that don't already include headers. For the discovery redirect flow, mock `headers.get('Location')` to return a valid principal URL.

### Category 3 — `AppError` instanceof mismatch (`integration.service.test.ts`)
**Root cause**: The service test imports `AppError` from the real module, but the mock for `../../src/integrations/index.js` returns `getAdapter: vi.fn()` which returns `undefined`. Downstream code calls `adapter.something.get(...)` on `undefined`. Separately, some tests check `error instanceof AppError` where the thrown error is from a different class reference due to ESM module boundary.
**Fix**: Ensure `getAdapter` mock returns a properly-shaped adapter stub per test. Fix the `instanceof` check — either use `error.name === 'AppError'` or restructure the mock so both sides reference the same class.

### Category 4 — Request body schema mismatch (`integration-connect.routes.test.ts`)
**Root cause**: The contract tests send a body that no longer matches the current Zod/schema validation on the `POST /api/integrations/:serviceId/connect` route — causing 400 before the mocked service is ever called.
**Fix**: Inspect the current route schema and update test bodies to match the expected shape.

## Phase Plan

### Phase 0 — Research
Document GitHub Actions best practices for pnpm monorepos in `research.md`:
- pnpm store caching strategy (`actions/cache` with `pnpm store path`)
- Job concurrency and `fail-fast` behavior
- Fork PR secret restrictions (`github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name != github.repository`)
- Vitest exit codes and how GitHub Actions surfaces them
- `pnpm --filter` for per-workspace jobs

### Phase 1 — Fix pre-existing failures
1. Delete `apple-reminders.sync.test.ts`
2. Fix `apple-calendar.sync.test.ts` — add `headers` to fetch mocks
3. Fix `integration.service.test.ts` — repair `getAdapter` mock and `AppError` instanceof
4. Fix `integration-connect.routes.test.ts` — align request bodies with current schema
5. Run full suite → verify 0 failures

### Phase 2 — CI workflow
1. Create `.github/workflows/ci.yml` with 4 jobs
2. Add pnpm store cache step to each job
3. Set `timeout-minutes: 10` on the workflow
4. Fork safety: no `secrets` passed on pull_request events from forks
5. Document job names so branch protection can reference them by name

### Phase 3 — Branch protection (manual / docs)
Document in `quickstart.md` the steps to enable branch protection:
- Settings → Branches → Add rule for `main`
- Required status checks: `backend-unit`, `backend-contract`, `frontend-lint`, `frontend-build`
- Note: requires repo admin access (cannot be scripted in CI itself)

## Complexity Tracking

No violations — no table required.

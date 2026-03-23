# ordrctrl Project Stack

**Last Updated**: 2026-03-22
**Updated By**: speckit.constitution (v1.1.0 amendment)

> This file is the authoritative reference for project tooling and stack constraints.
> All spec-kit agents MUST read this file when generating technical tasks or plans.
> Update this file via `/speckit.constitution` when the stack changes (paradigm shift).

## Packaging

- **Tool**: pnpm (workspace monorepo)
- **Workspace file**: `pnpm-workspace.yaml`
- **Lock file**: `pnpm-lock.yaml`
- **Install command**: `pnpm install`
- **Add dependency**: `pnpm add <pkg> --filter <workspace>` (e.g., `--filter backend`)

## Version Constraints

- **Node.js**: See `engines` field in root `package.json` or `.nvmrc`
- **pnpm**: See `packageManager` field in root `package.json`
- **TypeScript**: See `tsconfig.json` in each workspace

## Linting

- **Tool**: ESLint
- **Config**: `eslint.config.*` per workspace
- **Lint command (root)**: `pnpm lint`
- **Auto-fix (root)**: `pnpm lint:fix`
- **Lint backend only**: `cd backend && pnpm lint`
- **Lint frontend only**: `cd frontend && pnpm lint`

## Testing

### Backend

- **Framework**: Vitest
- **Run all**: `cd backend && pnpm test`
- **Watch mode**: `cd backend && pnpm test:watch`
- **Contract tests only**: `cd backend && pnpm test:contract`
- **Single file**: `cd backend && pnpm vitest run <path>`
- **Test directories**:
  - Contract: `backend/tests/contract/`
  - Unit: `backend/tests/unit/`

### Frontend

- **Unit**: Vitest — `cd frontend && pnpm test`
- **E2E**: Playwright — `cd frontend && pnpm test:e2e`
  - ⚠️ Requires both servers running (`pnpm dev` from root)
- **Single e2e file**: `cd frontend && pnpm playwright test <path>`

### Root (Both Workspaces)

```bash
pnpm test        # backend unit + contract tests
pnpm test:e2e    # frontend Playwright e2e (requires servers)
```

## Regression Test Commands

Run these after every implementation phase to verify no regressions:

```bash
# Step 1: Lint check
pnpm lint

# Step 2: Backend unit + contract tests
pnpm test

# Step 3: E2E (only if UI changes; requires `docker compose up -d` + `pnpm dev`)
# cd frontend && pnpm test:e2e
```

## Build

- **Build all (root)**: `pnpm build`
- **Backend build**: `cd backend && pnpm build`
- **Frontend build**: `cd frontend && pnpm build`

## Infrastructure (Local Dev)

```bash
docker compose up -d   # Start PostgreSQL 16 + Redis 7 (required)
pnpm dev               # Start backend (port 4000) + frontend (port 3000) concurrently
```

## Database

- **ORM**: Prisma (client imported from `backend/src/lib/db.ts`)
- **Schema**: `backend/prisma/schema.prisma`
- **Migrate**: `cd backend && pnpm prisma:migrate`
- **Generate client**: `cd backend && pnpm prisma:generate`
- ⚠️ Never edit existing migrations — always create new ones

## Best Practices Reference

- Constitution: `.specify/memory/constitution.md`
- Copilot Instructions: `.github/copilot-instructions.md`
- Development Guide: `docs/development.md`
- Architecture Reference: `docs/architecture.md`

## Commit Message Convention

Format: `<type>(<scope>): <description>`

| Type | Usage |
|------|-------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `chore` | Maintenance, tooling, deps |
| `docs` | Documentation only |
| `refactor` | Code restructure, no behavior change |
| `test` | Test-only changes |
| `perf` | Performance improvement |

**Spec-Kit Phase Commit Messages**:

| Phase | Message format |
|-------|---------------|
| `/speckit.specify` | `docs(spec): initialize NNN-feature-name spec` |
| `/speckit.plan` | `docs(plan): add implementation plan for NNN-feature-name` |
| `/speckit.tasks` | `docs(tasks): generate task breakdown for NNN-feature-name` |
| `/speckit.implement` (per phase) | `feat(NNN): implement <phase description>` |
| `/speckit.implement` (final) | `feat(NNN): complete NNN-feature-name implementation` |
| `/speckit.analyze` | `docs(analyze): add consistency report for NNN-feature-name` |
| `/speckit.constitution` | `docs: amend constitution to vX.Y.Z (<change summary>)` |

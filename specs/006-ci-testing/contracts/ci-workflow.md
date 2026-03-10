# Contract: CI Workflow

## Trigger

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

## Jobs

| Job ID | Name | Command | Required for Merge |
|--------|------|---------|-------------------|
| `backend-unit` | Backend Unit Tests | `pnpm --filter backend test` | Yes |
| `backend-contract` | Backend Contract Tests | `pnpm --filter backend test:contract` | Yes |
| `frontend-lint` | Frontend Lint | `pnpm --filter frontend lint` | Yes |
| `frontend-build` | Frontend Build | `pnpm --filter frontend build` | Yes |

## Job Structure (per job)

1. `actions/checkout@v4`
2. `pnpm/action-setup@v4` with `version: 9`
3. `actions/setup-node@v4` with `node-version: '20'`, `cache: 'pnpm'`
4. `pnpm install --frozen-lockfile`
5. Run command (test / lint / build)

## Concurrency

```yaml
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```

## Timeout

Each job: `timeout-minutes: 10`

## Secrets

No secrets required. Backend tests mock all external services via vi.mock.

## Branch Protection Settings (manual — requires repo admin)

After merging, configure in Settings → Branches for main:
- Require status checks: backend-unit, backend-contract, frontend-lint, frontend-build
- Require branches to be up to date before merging

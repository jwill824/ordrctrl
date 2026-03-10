# Research: GitHub Actions CI Pipeline

## pnpm Monorepo Caching

Cache the pnpm store (not `node_modules`) across runs using `actions/cache`:

```yaml
- name: Get pnpm store path
  id: pnpm-cache
  run: echo "STORE_PATH=$(pnpm store path)" >> $GITHUB_OUTPUT

- uses: actions/cache@v4
  with:
    path: ${{ steps.pnpm-cache.outputs.STORE_PATH }}
    key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
    restore-keys: |
      ${{ runner.os }}-pnpm-store-
```

This is faster than caching `node_modules` because the store is content-addressed and shared across all workspaces.

## pnpm Workspace Filtering

Run commands scoped to a single workspace:

```bash
pnpm --filter backend test          # backend unit tests
pnpm --filter backend test:contract # backend contract tests
pnpm --filter frontend lint         # frontend lint
pnpm --filter frontend build        # frontend build
```

These mirror the root `package.json` scripts exactly, keeping CI and local commands identical.

## Fork PR Secret Restrictions

Fork PRs cannot access repository secrets by default on GitHub Actions (this is a platform guarantee). No additional guards needed for `pull_request` events — secrets are simply not available. For `pull_request_target` (which can access secrets), guards are required — but we do not use `pull_request_target`.

Confirm with: the workflow trigger is `pull_request` (not `pull_request_target`).

## Vitest Exit Codes

Vitest exits with code `1` on any test failure. GitHub Actions interprets a non-zero exit code as a step failure, which fails the job. No special configuration is required to surface failures as PR checks.

## Job Naming for Branch Protection

GitHub Actions job names used in `jobs:` keys become the status check names on PRs. Branch protection rules reference these exact names. Use consistent, human-readable job names:

- `backend-unit`
- `backend-contract`
- `frontend-lint`
- `frontend-build`

## Timeout Strategy

Set `timeout-minutes` at the job level (not step level) to catch hanging tests:

```yaml
jobs:
  backend-unit:
    timeout-minutes: 10
```

## Concurrency

Run all 4 jobs in parallel (default behavior — no `needs` dependencies between them). This keeps total wall-clock time under 5 minutes for typical runs.

Add a concurrency group to cancel in-progress runs when a new commit is pushed to the same PR:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

## Node.js Version

Use `actions/setup-node` with `node-version: '20'` and `cache: 'pnpm'` (built-in pnpm cache support in setup-node v4+). This is simpler than manual caching above — prefer this approach:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'pnpm'
```

The `cache: 'pnpm'` flag automatically caches the pnpm store using `pnpm-lock.yaml` as the cache key. No separate `actions/cache` step needed.

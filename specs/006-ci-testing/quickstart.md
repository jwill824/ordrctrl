# Quickstart: CI Pipeline

## Run CI checks locally

These commands exactly mirror what CI runs:

```bash
# From repo root
pnpm --filter backend test           # backend unit tests
pnpm --filter backend test:contract  # backend contract tests
pnpm --filter frontend lint          # frontend lint
pnpm --filter frontend build         # frontend build

# Or run everything at once (unit only, mirrors root scripts)
pnpm test
pnpm lint
pnpm build
```

## Adding a new CI job

1. Add a new job block to `.github/workflows/ci.yml`
2. Follow the same 5-step pattern (checkout → pnpm setup → node setup → install → run)
3. Give the job a kebab-case ID (e.g., `backend-e2e`)
4. Add it to branch protection required checks in GitHub Settings

## Enabling branch protection (repo admin required)

1. Go to the repository → Settings → Branches
2. Click **Add branch protection rule**
3. Branch name pattern: `main`
4. Enable **Require status checks to pass before merging**
5. Search for and add: `backend-unit`, `backend-contract`, `frontend-lint`, `frontend-build`
6. Enable **Require branches to be up to date before merging**
7. Save

## Viewing CI results

- **On a PR**: Status checks appear at the bottom of the PR page. Click "Details" on any check to see the full log.
- **On main**: Go to Actions tab → select the `CI` workflow → view the most recent run.

## Debugging a failing CI run

1. Click the failing check on the PR → "Details"
2. Expand the failing step to see the error
3. Reproduce locally with the matching `pnpm --filter` command
4. All backend test mocks use `vi.mock` — no live database or external services needed

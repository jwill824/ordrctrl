# Contributing to ordrctrl

Thanks for your interest in contributing. This document covers how to get set up, the conventions we follow, and what to expect from the review process.

---

## Getting started

Follow the setup steps in [README.md](README.md) to get the project running locally. Make sure `pnpm dev` starts both servers cleanly before making any changes.

---

## Development workflow (speckit)

See the [Development workflow (speckit)](#development-workflow-speckit) section in the README for the full command reference and pipeline explanation.

**Rule**: No code may be written for a new feature until `tasks.md` exists and `/speckit.analyze` passes. This is a constitution-level requirement.

---

## Testing integrations locally

Before working on integration code, you need valid OAuth credentials for the service. See [`specs/001-mvp-core/quickstart.md`](specs/001-mvp-core/quickstart.md) — **Section 8: Testing Integrations Locally** — for step-by-step instructions per integration.

Quick summary:

| Integration | Required env vars | Key gotcha |
|-------------|------------------|-----------|
| Gmail | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Add yourself as a test user on the OAuth consent screen; register **both** redirect URIs on the same client |
| Microsoft Tasks | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | Set `requestedAccessTokenVersion: 2` in app manifest; use **underscore** in redirect URI (`microsoft_tasks`) |
| Apple Reminders / Calendar | `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | Requires Apple Developer account + HTTPS callback (use ngrok for local dev) |

---

## Branching

We use a feature-branch workflow:

```bash
# Create a branch from main
git checkout main && git pull
git checkout -b <type>/<short-description>

# Examples
git checkout -b feat/todoist-integration
git checkout -b fix/feed-ordering-bug
git checkout -b chore/update-prisma
```

Branch types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`

---

## Making changes

### Code style

- TypeScript everywhere — no `any` without a comment explaining why
- Prettier handles formatting — run `pnpm lint:fix` before committing
- ESLint enforces rules — `pnpm lint` must pass with zero errors

```bash
# From repo root
pnpm lint          # check
pnpm lint:fix      # auto-fix
```

### Styling (frontend)

All UI styling uses **Tailwind CSS utility classes directly in JSX** `className` props. Do not:

- Add `@layer components { ... }` or `@apply` rules to `globals.css` — they silently fail in this Next.js 14 setup
- Add inline `style={{ ... }}` props — use Tailwind utilities instead

The only permitted exception is a runtime-dynamic value that Tailwind cannot express at compile time (e.g. a per-integration hex color read from a data record). In that case, use `style={{ color: value }}` for that one property only, and put all other styles in `className`.

`globals.css` is intentionally minimal: only `@tailwind` directives, box-sizing reset, font-smoothing, selection colour, and `:focus-visible` outline.

### Adding a new integration

Each integration is a self-contained plugin. See the [integration adapter contract](specs/001-mvp-core/contracts/integration-adapter.md) and follow the pattern of an existing adapter (e.g. `backend/src/integrations/gmail/`). Core application code must not be modified.

### Database changes

Always create a new Prisma migration — never edit existing migrations:

```bash
cd backend
pnpm prisma migrate dev --name <description-of-change>
pnpm prisma generate
```

### Environment variables

New env vars must be:
1. Added to `backend/.env.example` (with a placeholder value, never a real secret)
2. If device-testing-only (e.g. ngrok credentials), added to `backend/.env.device.example` and `frontend/.env.device.example` instead — developers copy these to `.env.device.local` (gitignored)
3. Documented in `specs/001-mvp-core/quickstart.md` under the relevant section
4. Validated at startup in `backend/src/server.ts`

Never commit `.env` or `.env.device.local` files.

---

## Testing

```bash
# Run all backend tests
cd backend && pnpm test

# Run contract tests only
cd backend && pnpm test:contract

# Run e2e tests (requires both servers running)
cd frontend && pnpm test:e2e
```

All new features should include tests. Minimum expectations:

| Change | Expected tests |
|--------|---------------|
| New API endpoint | Contract test in `backend/tests/contract/` |
| New service method | Unit test in `backend/tests/unit/` |
| New integration adapter | Unit tests for `sync()` normalization |
| New UI flow | Playwright e2e test in `frontend/tests/e2e/` |

---

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]
```

Examples:
```
feat(integrations): add Todoist adapter
fix(feed): correct ordering for undated items
chore(deps): update Prisma to 5.10
docs(quickstart): add Apple OAuth setup steps
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`

---

## Pull requests

1. **Keep PRs focused** — one feature or fix per PR. Large PRs are hard to review.
2. **Fill out the PR description** — what changed, why, and how to test it.
3. **Constitution check** — before submitting, verify your change doesn't violate the [project constitution](specs/001-mvp-core/../../../.specify/memory/constitution.md):
   - New integrations must use the `IntegrationAdapter` interface (Principle I)
   - No speculative features (Principle II)
   - No plaintext tokens in DB, logs, or API responses (Principle III)
   - Tests included (Principle IV)
   - No new dependencies without written justification (Principle V)

4. **CI must pass** — lint, build, and tests
5. **One approval required** to merge

---

## Security

- Never log or expose OAuth access tokens, refresh tokens, or the `TOKEN_ENCRYPTION_KEY`
- The `rawPayload` field on `SyncCacheItem` must never appear in API responses
- Report security vulnerabilities privately — do not open a public issue

---

## Design philosophy

ordrctrl follows a minimalism-first approach. Before adding UI options, configuration knobs, or new features, ask: *does this solve a real problem for the user, or does it add complexity they didn't ask for?*

When in doubt, defer. The spec and constitution are the source of truth.

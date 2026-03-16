---
description: "Task list for 014-vite-migration"
---

# Tasks: Migrate Frontend to Vite SPA

**Input**: Design documents from `/specs/014-vite-migration/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, contracts/routing.md ✅, quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Exact file paths included in all descriptions

---

## Phase 1: Setup

**Purpose**: Remove Next.js dependency, add Vite + React Router, and install.

- [x] T001 Update `frontend/package.json` — remove `next` and `eslint-config-next`; add `react-router-dom@^6` dependency; update scripts: `dev` → `vite`, `build` → `tsc && vite build`, `start` → `vite preview`
- [x] T002 Run `pnpm install` inside `frontend/` to apply dependency changes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the new SPA entry points and routing infrastructure that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 [P] Create `frontend/vite.config.ts` — configure `@vitejs/plugin-react`, `resolve.alias` (`@` → `./src`), `server.port: 3000`, `server.historyApiFallback: true`, `build.outDir: 'dist'`
- [x] T004 [P] Create `frontend/index.html` — SPA entry point with Inter Google Fonts `<link>` tags, `<div id="root">`, and `<script type="module" src="/src/main.tsx">`
- [x] T005 [P] Create `frontend/src/main.tsx` — `ReactDOM.createRoot` bootstrap that renders `<App />` inside `<React.StrictMode>`, imports `./app/globals.css`
- [x] T006 [P] Create `frontend/src/App.tsx` — `BrowserRouter` + `Routes` with all 10 routes per `contracts/routing.md`: root redirect, auth routes (`/login`, `/signup`, `/forgot-password`, `/reset-password`), legacy redirect (`/settings/dismissed` → `/feed?showDismissed=true`), and protected routes (`/feed`, `/inbox`, `/onboarding`, `/settings/integrations`, `/settings/feed`) wrapped in `<ProtectedRoute>`
- [x] T007 Create `frontend/src/components/ProtectedRoute.tsx` — auth guard that reads `{ isAuthenticated, isLoading }` from `useAuth`, uses `useNavigate` + `useLocation` to redirect unauthenticated users to `/login?redirect=<pathname>`, renders `null` while loading

**Checkpoint**: SPA shell is in place — user story implementation can now begin

---

## Phase 3: User Story 1 — Uninterrupted Web Experience (Priority: P1) 🎯 MVP

**Goal**: All 10 routes work identically to pre-migration behavior in a browser; zero user-visible regression.

**Independent Test**: Start `pnpm dev`, open `http://localhost:3000` in a browser, log in, navigate all routes, and confirm every feature (feed, inbox, settings, integrations) works exactly as before.

- [x] T008 [P] [US1] Update `frontend/src/hooks/useAuth.ts` — replace `useRouter` from `next/navigation` with `useNavigate` from `react-router-dom`
- [x] T009 [P] [US1] Update `frontend/src/components/AccountMenu.tsx` — replace `import { useRouter } from 'next/navigation'` with `import { useNavigate } from 'react-router-dom'`; replace `const router = useRouter()` with `const navigate = useNavigate()`; replace all `router.push(` calls with `navigate(`
- [x] T010 [P] [US1] Update `frontend/src/components/auth/LoginForm.tsx` — replace `import { useRouter } from 'next/navigation'` with `useNavigate`; replace `import Link from 'next/link'` with `import { Link } from 'react-router-dom'`; replace all `<Link href=` with `<Link to=`; replace `router.push(` with `navigate(`
- [x] T011 [P] [US1] Update `frontend/src/components/auth/SignupForm.tsx` — replace `import Link from 'next/link'` with `import { Link } from 'react-router-dom'`; replace all `<Link href=` with `<Link to=`
- [x] T012 [P] [US1] Update `frontend/src/components/feed/FeedEmptyState.tsx` — replace `import Link from 'next/link'` with `import { Link } from 'react-router-dom'`; replace all `<Link href=` with `<Link to=`
- [x] T013 [P] [US1] Update `frontend/src/components/feed/IntegrationErrorBanner.tsx` — replace `process.env.NEXT_PUBLIC_APP_URL` with `import.meta.env.VITE_APP_URL`
- [x] T014 [P] [US1] Update `frontend/src/components/integrations/AppleCredentialForm.tsx` — replace all `process.env.NEXT_PUBLIC_DEV_APPLE_USERNAME` → `import.meta.env.VITE_DEV_APPLE_USERNAME` and `process.env.NEXT_PUBLIC_DEV_APPLE_APP_SPECIFIC_PASSWORD` → `import.meta.env.VITE_DEV_APPLE_APP_SPECIFIC_PASSWORD`
- [x] T015 [P] [US1] Update `frontend/src/app/feed/page.tsx` — replace `import Link from 'next/link'` with `import { Link } from 'react-router-dom'`; replace `<Link href=` with `<Link to=`; replace `import { useSearchParams } from 'next/navigation'` with `import { useSearchParams } from 'react-router-dom'`
- [x] T016 [P] [US1] Update `frontend/src/app/reset-password/page.tsx` — replace `useRouter` with `useNavigate`; replace `useSearchParams` import from `next/navigation` with `react-router-dom`; replace `import Link from 'next/link'` with `import { Link } from 'react-router-dom'`; replace `<Link href=` with `<Link to=`; replace `router.push(` with `navigate(`
- [x] T017 [P] [US1] Update `frontend/src/app/forgot-password/page.tsx` — replace `import Link from 'next/link'` with `import { Link } from 'react-router-dom'`; replace `<Link href=` with `<Link to=`
- [x] T018 [P] [US1] Update `frontend/src/app/onboarding/page.tsx` — replace `import { redirect } from 'next/navigation'` with `import { Navigate } from 'react-router-dom'`; replace server-side `redirect('/path')` call with `return <Navigate to="/path" replace />`
- [x] T019 [P] [US1] Update `frontend/src/app/settings/integrations/page.tsx` — replace `import Link from 'next/link'` with `import { Link } from 'react-router-dom'`; replace `<Link href=` with `<Link to=`; replace `useSearchParams` import from `next/navigation` with `react-router-dom`
- [x] T020 [P] [US1] Update `frontend/src/app/settings/feed/page.tsx` — replace `import Link from 'next/link'` with `import { Link } from 'react-router-dom'`; replace `<Link href=` with `<Link to=`
- [x] T021 [P] [US1] Update 6 service files — in `frontend/src/services/api-client.ts`, `feed.service.ts`, `inbox.service.ts`, `integrations.service.ts`, `tasks.service.ts`, `user.service.ts`: replace all `process.env.NEXT_PUBLIC_API_URL` → `import.meta.env.VITE_API_URL` and any other `NEXT_PUBLIC_` prefixes → `VITE_`
- [x] T022 [P] [US1] Update `frontend/.env.example` — rename all 4 vars: `NEXT_PUBLIC_API_URL` → `VITE_API_URL`, `NEXT_PUBLIC_APP_URL` → `VITE_APP_URL`, `NEXT_PUBLIC_DEV_APPLE_USERNAME` → `VITE_DEV_APPLE_USERNAME`, `NEXT_PUBLIC_DEV_APPLE_APP_SPECIFIC_PASSWORD` → `VITE_DEV_APPLE_APP_SPECIFIC_PASSWORD`; also update any `.env` and `.env.local` files with the same renames
- [x] T023 [P] [US1] Update `frontend/src/app/globals.css` — add `:root { --font-inter: 'Inter', system-ui, sans-serif; }` at the top to replace the `next/font` CSS variable injection
- [x] T024 [P] [US1] Update `frontend/tailwind.config.ts` — replace content paths with `['./index.html', './src/**/*.{js,ts,jsx,tsx}']` (remove `src/app/` glob, add `index.html`)
- [x] T025 [US1] Delete `frontend/next.config.mjs` and `frontend/src/middleware.ts` — these are replaced by `vite.config.ts` and `ProtectedRoute.tsx` respectively

**Checkpoint**: Dev server (`pnpm dev`) should start on port 3000; all routes should be navigable and fully functional

---

## Phase 4: User Story 2 — All Existing Tests Pass (Priority: P1)

**Goal**: Full unit and e2e test suites pass without any test file modifications.

**Independent Test**: Run `pnpm test` and `pnpm test:e2e` from `frontend/` and confirm zero failures.

- [x] T026 [P] [US2] Update `frontend/playwright.config.ts` — change `webServer.command` to use Vite: set command to `pnpm dev`, confirm `url: 'http://localhost:3000'`
- [x] T027 [P] [US2] Update `frontend/vitest.config.ts` — remove `**/.next/**` from the `exclude` list
- [x] T028 [US2] Run unit test suite from `frontend/` (`pnpm test`) and confirm all tests pass; fix any TypeScript or import errors surfaced by the Vite/Vitest configuration
- [x] T029 [US2] Run e2e test suite from `frontend/` (`pnpm test:e2e`) and confirm all Playwright tests pass; fix any failures caused by routing or environment variable changes

**Checkpoint**: `pnpm test` and `pnpm test:e2e` both exit with zero failures

---

## Phase 5: User Story 3 — Mobile Build Target Enabled (Priority: P2)

**Goal**: `pnpm build` produces a self-contained static asset bundle in `frontend/dist/` that a mobile app wrapper can consume without modification.

**Independent Test**: Run `pnpm build`; confirm `frontend/dist/` exists and contains only HTML, JS, CSS, and media files with no Node.js runtime dependency.

- [x] T030 [US3] Run production build (`pnpm build` from `frontend/`) and verify `frontend/dist/` is created containing only static assets (HTML, JS, CSS, fonts, images); confirm no server-side runtime files are present
- [x] T031 [US3] Verify build output is mobile-wrapper-ready — confirm `frontend/dist/index.html` exists as the SPA entry point and all asset references are relative paths, making the bundle directly consumable by Capacitor (`webDir: 'dist'`)

**Checkpoint**: `frontend/dist/` is a valid static SPA bundle — spec 015 (Capacitor) can now proceed

---

## Phase 6: User Story 4 — Desktop Build Target Enabled (Priority: P3)

**Goal**: The same static build output from Phase 5 is directly consumable by a desktop app wrapper without additional transformation.

**Independent Test**: Load `frontend/dist/` inside a Tauri shell on macOS and confirm all routes render correctly.

- [x] T032 [US4] Verify the `frontend/dist/` output from T030 is desktop-wrapper-ready — confirm asset paths are relative and compatible with Tauri's `frontendDist` configuration; manually test by loading the bundle in a Tauri dev shell if available

**Checkpoint**: The same `frontend/dist/` bundle serves both mobile and desktop — spec 016 (Tauri) can now proceed

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup and full-suite validation per quickstart.md

- [x] T033 [P] Remove any residual `next/` import references across `frontend/src/` — run `grep -r "from 'next/" frontend/src/` and resolve any remaining hits
- [x] T034 Run full quickstart.md validation sequence: `pnpm dev` (confirm < 10s cold start), `pnpm test` (all pass), `pnpm test:e2e` (all pass), `pnpm build` (dist/ produced), manual browser walkthrough of all 10 routes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Phase 2 — all T008–T025 tasks can run in parallel with each other
- **US2 (Phase 4)**: Depends on Phase 3 completion (tests must run against a working app)
- **US3 (Phase 5)**: Depends on Phase 3 completion (build requires working source)
- **US4 (Phase 6)**: Depends on Phase 5 completion (reuses the same dist/ output)
- **Polish (Phase 7)**: Depends on all story phases complete

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational — no dependencies on other stories
- **US2 (P1)**: Depends on US1 completion — tests validate a fully wired app
- **US3 (P2)**: Depends on US1 completion — build requires working source
- **US4 (P3)**: Depends on US3 completion — reuses the same dist/ output

### Within Each User Story

- All `[P]`-tagged tasks in Phase 3 can run in parallel (different files, no conflicts)
- T025 (delete files) should run after T008–T024 are complete to avoid breaking the build mid-work
- T028 and T029 must run sequentially after T026/T027 (need config changes before running)

---

## Parallel Opportunities

### Phase 2: All foundational files are independent

```
Task: "Create frontend/vite.config.ts"            (T003)
Task: "Create frontend/index.html"                 (T004)
Task: "Create frontend/src/main.tsx"               (T005)
Task: "Create frontend/src/App.tsx"                (T006)
Task: "Create frontend/src/components/ProtectedRoute.tsx"  (T007)
```

### Phase 3: All component/service updates are independent (different files)

```
Task: "Update useAuth.ts"                          (T008)
Task: "Update AccountMenu.tsx"                     (T009)
Task: "Update LoginForm.tsx"                       (T010)
Task: "Update SignupForm.tsx"                      (T011)
Task: "Update FeedEmptyState.tsx"                  (T012)
Task: "Update IntegrationErrorBanner.tsx"          (T013)
Task: "Update AppleCredentialForm.tsx"             (T014)
Task: "Update feed/page.tsx"                       (T015)
Task: "Update reset-password/page.tsx"             (T016)
Task: "Update forgot-password/page.tsx"            (T017)
Task: "Update onboarding/page.tsx"                 (T018)
Task: "Update settings/integrations/page.tsx"      (T019)
Task: "Update settings/feed/page.tsx"              (T020)
Task: "Update 6 service files"                     (T021)
Task: "Update .env.example"                        (T022)
Task: "Update globals.css"                         (T023)
Task: "Update tailwind.config.ts"                  (T024)
```

### Phase 4: Config updates are independent

```
Task: "Update playwright.config.ts"               (T026)
Task: "Update vitest.config.ts"                   (T027)
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational — CRITICAL, blocks everything
3. Complete Phase 3: US1 — all parallel tasks, then T025
4. Complete Phase 4: US2 — config updates, then verify tests
5. **STOP and VALIDATE**: App runs in browser, all tests pass
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Vite shell ready
2. US1 → Working app in browser (MVP)
3. US2 → Tests verified (regression-safe)
4. US3 → Static build confirmed (mobile-ready)
5. US4 → Desktop confirmed (desktop-ready) — enables specs 015 and 016

### Parallel Team Strategy

With multiple developers:

1. Team completes Phase 1 + 2 together
2. Once Foundational is done:
   - Developers split Phase 3 tasks by file group (components vs. services vs. pages)
   - US2, US3, US4 proceed sequentially after US1

---

## Notes

- No new test files — all existing tests must pass as-is (FR-009, FR-010)
- `src/app/` directory is **not deleted** — page components stay in place; only Next.js directory convention is replaced by `App.tsx` routing
- Vite and `@vitejs/plugin-react` are **already installed** — only `react-router-dom` is a new dependency
- `useSearchParams` name is the same in both `next/navigation` and `react-router-dom` — only the import path changes
- SPA fallback (`historyApiFallback: true`) handles FR-012 (direct URL navigation / browser refresh)
- Commit after each phase or logical group of parallel tasks

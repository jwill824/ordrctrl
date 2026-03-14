# Implementation Plan: Migrate Frontend to Vite SPA

**Branch**: `014-vite-migration` | **Date**: 2026-03-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-vite-migration/spec.md`

## Summary

Replace the Next.js framework in the frontend with a Vite-powered single-page application. The app already behaves as a pure SPA (no SSR usage, no Server Actions, fully auth-gated) so this is a framework wiring swap, not a logic rewrite. The migration unlocks spec `015-mobile-capacitor` and `016-desktop-tauri` by producing a static build output that both wrappers can consume directly.

Key facts discovered in research:
- **Vite and `@vitejs/plugin-react` are already installed** — no new installs for the build toolchain
- **`vitest.config.ts` already exists and uses `@vitejs/plugin-react`** — tests need minimal changes
- **No `next/image` usage anywhere** — eliminates a common migration pain point
- **4 env vars** need `NEXT_PUBLIC_` → `VITE_` rename
- **15 files** have Next.js-specific imports to update
- **1 middleware** to replace with a `ProtectedRoute` component (logic already in `useAuth` hook)

## Technical Context

**Language/Version**: TypeScript 5.4.2 / React 18.2.0 / Node.js 18+
**Primary Dependencies**: Vite 5.1.4 (already installed), react-router-dom v6 (to add), Tailwind CSS 3.4.1
**Storage**: N/A — frontend only; all persistence is in the backend
**Testing**: Vitest 1.3.1 (unit, already configured), Playwright 1.42.1 (e2e)
**Target Platform**: Web browser (all modern); static build output for Capacitor (iOS/Android) and Tauri (macOS/Windows)
**Project Type**: Single-page web application
**Performance Goals**: Dev server cold start < 10s; hot module replacement < 500ms
**Constraints**: Zero behavioral regression across all 10 routes; build output must be 100% static (no Node.js server runtime); all existing tests must pass unchanged
**Scale/Scope**: 10 page components, ~25 components, 7 services, 10 hooks, 1 middleware to replace

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — all gates still pass.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I — Integration Modularity | ✅ Pass | No integration adapter changes |
| II — Minimalism-First | ✅ Pass | Net removal of a framework dependency; no new UI surfaces |
| III — Security & Privacy | ✅ Pass | Auth mechanism unchanged; same cookie-based session detection |
| IV — Test Coverage Required | ✅ Pass | Full existing test suite must pass as exit criterion; no new untested logic |
| V — Simplicity & Deferred Decisions | ✅ Pass | Adds `react-router-dom`, removes `next` — net simpler; justified by mobile/desktop platform enablement documented in spec |

No violations. Complexity Tracking table not required.

## Project Structure

### Documentation (this feature)

```text
specs/014-vite-migration/
├── plan.md              ✅ This file
├── research.md          ✅ Phase 0 complete
├── data-model.md        N/A — no new data entities (frontend-only migration)
├── quickstart.md        ✅ Phase 1 complete
├── contracts/
│   └── routing.md       ✅ Phase 1 complete
└── tasks.md             # /speckit.tasks — not yet created
```

### Source Code Changes

```text
frontend/
├── index.html                        NEW  — SPA entry point (replaces Next.js _document)
├── vite.config.ts                    NEW  — Vite build + dev server config
├── src/
│   ├── main.tsx                      NEW  — App entry (replaces next bootstrap)
│   ├── App.tsx                       NEW  — Router setup + all route definitions
│   ├── components/
│   │   └── ProtectedRoute.tsx        NEW  — Auth guard (replaces middleware.ts)
│   ├── app/                          DELETE — entire Next.js app directory
│   │   └── (all page.tsx files       → become standalone components in src/pages/ or inline)
│   ├── hooks/
│   │   └── useAuth.ts                UPDATE — remove next/navigation import
│   ├── services/
│   │   └── *.ts (6 files)            UPDATE — NEXT_PUBLIC_ → VITE_ env prefix
│   └── components/ (15 files)        UPDATE — next/link, next/navigation imports
├── tailwind.config.ts                UPDATE — content paths (remove src/app/, add src/pages/)
├── playwright.config.ts              UPDATE — webServer command (next dev → vite)
├── .env.example                      UPDATE — rename 4 env vars
└── package.json                      UPDATE — remove next, add react-router-dom; update scripts
```

# Research: Migrate Frontend to Vite SPA

## Decision 1: Routing Library

**Decision**: React Router v6 (`react-router-dom`)

**Rationale**: Provides a direct 1:1 replacement for every Next.js navigation primitive currently in use:

| Next.js | React Router v6 |
|---------|----------------|
| `import Link from 'next/link'` | `import { Link } from 'react-router-dom'` |
| `<Link href="/path">` | `<Link to="/path">` |
| `useRouter().push('/path')` | `useNavigate()('/path')` |
| `useSearchParams()` | `useSearchParams()` — same name, same API |
| `redirect('/path')` (server) | `<Navigate to="/path" replace />` |

All 5 router.push() calls, 3 useSearchParams() usages, and 8 Link components map cleanly with minimal syntax change. React Router v6 is the most widely adopted React routing library with stable, well-documented APIs.

**Alternatives Considered**:
- **TanStack Router**: More type-safe but heavier, introduces unfamiliar patterns, overkill for 10 routes
- **wouter**: Lighter weight but lacks `useSearchParams` natively, requiring a polyfill
- **Next.js static export**: Keeps Next.js in place but maintains the architectural tension between SSR config and mobile/desktop builds; deferred the problem rather than solving it

---

## Decision 2: Environment Variable Naming

**Decision**: Rename all `NEXT_PUBLIC_*` vars to `VITE_*`; access via `import.meta.env.VITE_*`

**Rationale**: Vite's built-in convention for exposing env vars to the client. No additional plugins required. A find-and-replace across the codebase handles the full migration.

**Affected variables** (4 total):

| Old Name | New Name |
|----------|----------|
| `NEXT_PUBLIC_API_URL` | `VITE_API_URL` |
| `NEXT_PUBLIC_APP_URL` | `VITE_APP_URL` |
| `NEXT_PUBLIC_DEV_APPLE_USERNAME` | `VITE_DEV_APPLE_USERNAME` |
| `NEXT_PUBLIC_DEV_APPLE_APP_SPECIFIC_PASSWORD` | `VITE_DEV_APPLE_APP_SPECIFIC_PASSWORD` |

**Access pattern change**: `process.env.NEXT_PUBLIC_API_URL` → `import.meta.env.VITE_API_URL`

---

## Decision 3: Inter Font Loading

**Decision**: Load Inter via Google Fonts `<link>` tag in `index.html`; preserve the `--font-inter` CSS variable via a `@font-face` declaration in `globals.css`

**Rationale**: Removes the `next/font/google` dependency while preserving identical visual output. The `--font-inter` CSS variable used in `tailwind.config.ts` (`fontFamily.sans`) continues to work unchanged. `font-display: swap` behaviour is replicated via the CSS declaration.

**Alternatives Considered**:
- **Self-hosted font files**: More reliable (no external CDN), but adds static assets to the repo; acceptable future improvement but unnecessary for this migration

---

## Decision 4: Auth Guard Pattern (Middleware Replacement)

**Decision**: `ProtectedRoute` wrapper component that reads auth state from the existing `useAuth` hook

**Rationale**: The `useAuth` hook already contains all session detection logic (cookie presence check, redirect-on-logout). A `ProtectedRoute` component wraps it in a React Router-compatible pattern with zero new logic:

```
<Route path="/feed" element={<ProtectedRoute><FeedPage /></ProtectedRoute>} />
```

Unauthenticated access redirects to `/login?redirect=/feed` — preserving the exact behaviour of the current `middleware.ts`.

**Alternatives Considered**:
- **Route-level loader functions** (React Router v6.4+ data APIs): More powerful but unnecessary complexity for simple cookie-based auth checks
- **HOC pattern**: Functionally equivalent but less readable than wrapper component

---

## Decision 5: SPA Fallback for Direct URL Navigation (FR-012)

**Decision**: Configure Vite dev server with `historyApiFallback: true`; document that web deployment requires serving `index.html` for all unmatched paths

**Rationale**: Standard SPA requirement — the server must return `index.html` for any URL so the client-side router can handle it. Vite's dev server supports this natively. Capacitor and Tauri handle it natively in their app shells. The web deployment configuration (nginx, CDN, etc.) is out of scope for this migration spec but must be documented.

---

## Migration Inventory Summary

### Files to Create (new)

| File | Purpose |
|------|---------|
| `frontend/index.html` | SPA entry point with font link + app div |
| `frontend/vite.config.ts` | Build + dev server configuration |
| `frontend/src/main.tsx` | React app bootstrap (replaces Next.js bootstrap) |
| `frontend/src/App.tsx` | BrowserRouter + all Route definitions |
| `frontend/src/components/ProtectedRoute.tsx` | Auth guard wrapper (replaces middleware.ts) |

### Files to Update

| File | Change |
|------|--------|
| `frontend/package.json` | Remove `next`; add `react-router-dom`; update `dev`/`build`/`start` scripts |
| `frontend/src/app/layout.tsx` | Convert to `App.tsx` with router; replace `next/font` with CSS import |
| `frontend/src/hooks/useAuth.ts` | Replace `useRouter` from `next/navigation` |
| `frontend/src/components/AccountMenu.tsx` | Replace `useRouter` from `next/navigation` |
| `frontend/src/components/auth/LoginForm.tsx` | Replace `useRouter` + `Link` from Next.js |
| `frontend/src/components/auth/SignupForm.tsx` | Replace `Link` from `next/link` |
| `frontend/src/components/feed/FeedEmptyState.tsx` | Replace `Link` from `next/link` |
| `frontend/src/components/feed/IntegrationErrorBanner.tsx` | Replace `NEXT_PUBLIC_` env var |
| `frontend/src/components/integrations/AppleCredentialForm.tsx` | Replace `NEXT_PUBLIC_` env vars |
| `frontend/src/app/feed/page.tsx` | Replace `Link` + `useSearchParams` from Next.js |
| `frontend/src/app/reset-password/page.tsx` | Replace `useRouter` + `useSearchParams` + `Link` |
| `frontend/src/app/forgot-password/page.tsx` | Replace `Link` from `next/link` |
| `frontend/src/app/onboarding/page.tsx` | Replace `redirect()` from `next/navigation` |
| `frontend/src/app/settings/integrations/page.tsx` | Replace `Link` + `useSearchParams` |
| `frontend/src/app/settings/feed/page.tsx` | Replace `Link` from `next/link` |
| `frontend/src/services/*.ts` (6 files) | Replace `NEXT_PUBLIC_` → `VITE_` env prefix |
| `frontend/.env.example` | Rename all 4 env vars |
| `frontend/tailwind.config.ts` | Update content paths (remove `src/app/`, add `src/pages/`) |
| `frontend/playwright.config.ts` | Update `webServer.command` from `pnpm dev` (next) to `pnpm dev` (vite, same port) |
| `frontend/vitest.config.ts` | Remove `.next/**` from exclude list |

### Files to Delete

| File | Reason |
|------|--------|
| `frontend/src/middleware.ts` | Replaced by `ProtectedRoute` component |
| `frontend/src/app/` (entire directory) | Next.js app directory structure replaced by `src/pages/` + `App.tsx` |
| `frontend/next.config.mjs` | Replaced by `vite.config.ts` |

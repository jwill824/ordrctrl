# Quickstart: 014-vite-migration

## Overview

This quickstart walks through the Vite SPA migration from start to finish. The changes are surgical — framework wiring only, no logic changes.

---

## Prerequisites

- Node.js 18+ and pnpm installed
- All tests currently passing on the `main` branch (establish baseline before migrating)

---

## Step 1: Update package.json

Remove `next` and `eslint-config-next`. Add `react-router-dom`. Update scripts.

**Dependencies to remove**: `next`
**Dev dependencies to remove**: `eslint-config-next`
**Dependencies to add**: `react-router-dom@^6`

**Updated scripts**:
```json
"dev": "vite",
"build": "tsc && vite build",
"start": "vite preview",
"lint": "eslint src --ext ts,tsx",
"test": "vitest run",
"test:watch": "vitest",
"test:e2e": "playwright test"
```

Run `pnpm install` after updating.

---

## Step 2: Create vite.config.ts

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 3000,
    historyApiFallback: true,
  },
  build: {
    outDir: 'dist',
  },
});
```

---

## Step 3: Create index.html

Place at `frontend/index.html` (Vite requires it at the project root):

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ordrctrl</title>
    <meta name="description" content="Unified task and calendar feed" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## Step 4: Create src/main.tsx

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './app/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

---

## Step 5: Create src/App.tsx

All route definitions and the BrowserRouter live here. This replaces the `app/` directory structure.

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import LoginPage from '@/app/login/page';
import SignupPage from '@/app/signup/page';
import ForgotPasswordPage from '@/app/forgot-password/page';
import ResetPasswordPage from '@/app/reset-password/page';
import FeedPage from '@/app/feed/page';
import InboxPage from '@/app/inbox/page';
import OnboardingPage from '@/app/onboarding/page';
import IntegrationsPage from '@/app/settings/integrations/page';
import FeedSettingsPage from '@/app/settings/feed/page';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Root redirect handled by ProtectedRoute */}
        <Route path="/" element={<Navigate to="/feed" replace />} />

        {/* Auth routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Legacy redirect */}
        <Route path="/settings/dismissed" element={<Navigate to="/feed?showDismissed=true" replace />} />

        {/* Protected routes */}
        <Route path="/feed" element={<ProtectedRoute><FeedPage /></ProtectedRoute>} />
        <Route path="/inbox" element={<ProtectedRoute><InboxPage /></ProtectedRoute>} />
        <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
        <Route path="/settings/integrations" element={<ProtectedRoute><IntegrationsPage /></ProtectedRoute>} />
        <Route path="/settings/feed" element={<ProtectedRoute><FeedSettingsPage /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
```

---

## Step 6: Create src/components/ProtectedRoute.tsx

Replaces `middleware.ts`. Uses the existing `useAuth` hook.

```tsx
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, location]);

  if (isLoading) return null;
  if (!isAuthenticated) return null;
  return <>{children}</>;
}
```

---

## Step 7: Replace Next.js Imports

Run these find-and-replace operations across `frontend/src/`:

| Find | Replace |
|------|---------|
| `import Link from 'next/link'` | `import { Link } from 'react-router-dom'` |
| `<Link href=` | `<Link to=` |
| `import { useRouter } from 'next/navigation'` | `import { useNavigate } from 'react-router-dom'` |
| `const router = useRouter()` | `const navigate = useNavigate()` |
| `router.push(` | `navigate(` |
| `import { useSearchParams } from 'next/navigation'` | `import { useSearchParams } from 'react-router-dom'` |
| `import { redirect } from 'next/navigation'` | `import { Navigate } from 'react-router-dom'` |

---

## Step 8: Rename Environment Variables

In all source files (`frontend/src/**`) and config files:

| Find | Replace |
|------|---------|
| `NEXT_PUBLIC_API_URL` | `VITE_API_URL` |
| `NEXT_PUBLIC_APP_URL` | `VITE_APP_URL` |
| `NEXT_PUBLIC_DEV_APPLE_USERNAME` | `VITE_DEV_APPLE_USERNAME` |
| `NEXT_PUBLIC_DEV_APPLE_APP_SPECIFIC_PASSWORD` | `VITE_DEV_APPLE_APP_SPECIFIC_PASSWORD` |
| `process.env.NEXT_PUBLIC_` | `import.meta.env.VITE_` |

Update `.env`, `.env.example`, and `.env.local` accordingly.

---

## Step 9: Update globals.css

Remove the `next/font` CSS variable injection. Add the Inter font family manually:

```css
/* In src/app/globals.css, add at the top: */
:root {
  --font-inter: 'Inter', system-ui, sans-serif;
}
```

---

## Step 10: Update Supporting Configs

**tailwind.config.ts** — update content paths:
```ts
content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}',
],
```

**playwright.config.ts** — update webServer command:
```ts
webServer: {
  command: 'pnpm dev',   // same command, now runs Vite instead of Next.js
  url: 'http://localhost:3000',
  reuseExistingServer: !process.env.CI,
},
```

**vitest.config.ts** — remove Next.js from exclude:
```ts
exclude: ['**/node_modules/**'],  // remove '**/.next/**'
```

---

## Step 11: Delete Next.js Artifacts

```bash
rm -rf frontend/next.config.mjs
rm -rf frontend/src/middleware.ts
# The src/app/ directory is kept — page components stay in place, 
# only the Next.js directory convention is replaced by App.tsx routing
```

---

## Step 12: Verify

```bash
# Start dev server
cd frontend && pnpm dev
# → Should open at http://localhost:3000

# Run unit tests
pnpm test
# → All tests should pass

# Run e2e tests (requires backend running)
pnpm test:e2e
# → All tests should pass

# Production build
pnpm build
# → dist/ directory created with static assets only
```

---

## Enabling Mobile/Desktop Wrappers (Post-Migration)

Once `dist/` is produced by `pnpm build`, the static output is ready for:

- **Capacitor** (spec `015`): Point `webDir` at `frontend/dist` in `capacitor.config.ts`
- **Tauri** (spec `016`): Point `frontendDist` at `frontend/dist` in `tauri.conf.json`

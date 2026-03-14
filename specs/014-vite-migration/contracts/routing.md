# Routing Contract: ordrctrl SPA

**Version**: 1.0 (established by `014-vite-migration`)
**Type**: Client-side URL routing contract

This document defines the canonical URL structure for the ordrctrl SPA, including authentication requirements and redirect rules. All platform targets (web, iOS/Android via Capacitor, macOS/Windows via Tauri) share this routing contract.

---

## Route Registry

| Path | Component | Auth Required | Notes |
|------|-----------|--------------|-------|
| `/` | — | — | Redirect only: → `/feed` (auth) or `/login` (unauth) |
| `/login` | `LoginPage` | No | Redirects to `/feed` if already authenticated |
| `/signup` | `SignupPage` | No | Redirects to `/feed` if already authenticated |
| `/forgot-password` | `ForgotPasswordPage` | No | Redirects to `/feed` if already authenticated |
| `/reset-password` | `ResetPasswordPage` | No | Public; accepts `?token=` query param |
| `/verify-email` | `VerifyEmailPage` | No | Public |
| `/onboarding` | `OnboardingPage` | Yes | First-run integration setup |
| `/feed` | `FeedPage` | Yes | Primary view; accepts `?showDismissed=true` |
| `/inbox` | `InboxPage` | Yes | |
| `/settings/integrations` | `IntegrationsPage` | Yes | |
| `/settings/feed` | `FeedSettingsPage` | Yes | |

---

## Redirect Rules

| From | To | Condition |
|------|----|-----------|
| `/` | `/feed` | User is authenticated |
| `/` | `/login` | User is not authenticated |
| `/login` | `/feed` | User is already authenticated |
| `/signup` | `/feed` | User is already authenticated |
| `/forgot-password` | `/feed` | User is already authenticated |
| `/settings/dismissed` | `/feed?showDismissed=true` | Always (legacy redirect, permanent) |
| Any protected route (unauthenticated) | `/login?redirect=<original-path>` | User is not authenticated |

---

## Authentication Contract

**Session detection**: The presence of any of these cookies indicates an active session:
- `sessionId`
- `connect.sid`
- `session`

**Guard behaviour**:
- Protected routes check for session cookie on render
- If no session: redirect to `/login?redirect=<requested-path>`
- On successful login: redirect to `redirect` query param value, or `/feed` if absent
- Authenticated users accessing auth routes (`/login`, `/signup`, `/forgot-password`): redirect to `/feed`

---

## Query Parameters

| Route | Parameter | Type | Description |
|-------|-----------|------|-------------|
| `/feed` | `showDismissed` | `boolean` | When `true`, shows dismissed items |
| `/login` | `redirect` | `string` | Path to redirect to after successful login |
| `/reset-password` | `token` | `string` | Password reset token |

---

## Direct URL Navigation

All routes MUST be accessible via direct URL entry or browser refresh. The app shell (`index.html`) must be served for all paths by the host environment:

- **Development**: Vite dev server handles this natively
- **Capacitor (iOS/Android)**: Native shell handles this natively
- **Tauri (macOS/Windows)**: Native shell handles this natively
- **Web deployment**: Reverse proxy / CDN must be configured to serve `index.html` for all unmatched paths (404 → index.html)

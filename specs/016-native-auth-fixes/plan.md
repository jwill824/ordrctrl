# Implementation Plan: Native App Auth Fixes

**Branch**: `016-native-auth-fixes` | **Date**: 2026-03-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/016-native-auth-fixes/spec.md`
**Closes**: [#53](https://github.com/jwill824/ordrctrl/issues/53), [#54](https://github.com/jwill824/ordrctrl/issues/54), [#55](https://github.com/jwill824/ordrctrl/issues/55)

## Summary

Two independent bugs in the Apple Sign In flow prevent the iOS native app from authenticating. Both are fixed with targeted backend changes. ngrok support is added for physical device testing.

**Bug 1 (state mismatch)**: Apple's `response_mode: 'form_post'` causes Apple to POST the OAuth callback cross-origin. `SameSite=Lax` blocks the session cookie on cross-origin POSTs — so the backend receives an empty session, reads `oauthState = undefined`, and rejects the callback as an invalid state. **Fix**: Move OAuth state storage from the session to Redis, keyed by the state value itself (5-minute TTL, one-time-use).

**Bug 2 (deep link never fires)**: Even if state were valid, `SFSafariViewController` does not follow `302` redirects issued in response to a POST. The `ordrctrl://auth/callback` deep link is the backend's redirect target — if `SFSafariViewController` won't follow it, the app is never notified. **Fix**: Remove `response_mode: 'form_post'` from the Apple authorization URL. Apple then issues a standard GET redirect with `?code=&state=` query params, which `SFSafariViewController` follows correctly.

**Feature (#55)**: Physical devices cannot reach `http://localhost:4000`. Apple also requires HTTPS for registered redirect URIs. **Fix**: Add `@ngrok/ngrok` as a backend devDependency with a `dev:ngrok` script; document the full physical device testing workflow including Apple Developer Portal registration.

## Technical Context

**Language/Version**: TypeScript 5.4 (backend + frontend)
**Primary Dependencies**:
- `ioredis` (existing) — Redis client for OAuth state store
- `@ngrok/ngrok` (new devDependency) — HTTPS tunnel for physical device testing
- `@fastify/session` (existing) — session plugin, simplified by removing OAuth state fields
- `openid-client` (existing) — Apple/Google OIDC client
- `@capacitor/browser` + `@capacitor/app` (existing) — unchanged

**Storage**: Redis (existing) — new `oauth:state:{value}` key namespace with 5-min TTL
**Testing**: Vitest (existing backend unit tests)
**Target Platform**: Backend (Node.js) + iOS Simulator / iOS physical device (via ngrok)
**Project Type**: Web service (backend) + mobile app (iOS, Capacitor)
**Performance Goals**: OAuth callback round-trip unchanged — Redis lookup adds <1ms
**Constraints**: No changes to frontend auth UI, session structure, or existing backend routes beyond state storage migration; no new UI surfaces
**Scale/Scope**: Single-user; targeted 3-file backend change + 1 new file + docs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Integration Modularity** | ✅ PASS | OAuth state store is a new internal utility module (`oauth-state.ts`), isolated from integration adapter code. Auth routes call it via a clean interface. |
| **II. Minimalism-First** | ✅ PASS | Zero new UI surfaces. The Redis key namespace is the only new storage concern. `response_mode` removal and state store migration are the smallest correct fixes. |
| **III. Security & Privacy** | ✅ PASS | Moving state to Redis improves CSRF posture — state is now single-use with a hard 5-minute expiry. Session no longer holds CSRF state. No plaintext secrets. `httpOnly` session cookies unchanged. |
| **IV. Test Coverage** | ✅ PASS | New `oauth-state.ts` module has unit tests (mocked Redis). Auth route callback logic has integration tests covering the state-lookup flow. |
| **V. Simplicity & Deferred Decisions** | ✅ PASS | Both fixes use the smallest possible change surface. Redis is already in the stack — no new infrastructure. `@ngrok/ngrok` is devDependency only. |

**Post-Phase 1 re-check**: ✅ No new violations. Redis key schema and ngrok integration are consistent with existing patterns.

## Project Structure

### Documentation (this feature)

```text
specs/016-native-auth-fixes/
├── plan.md                          # This file
├── research.md                      # Phase 0 — root cause analysis, fix decisions
├── data-model.md                    # Phase 1 — OAuthStateEntry Redis schema
├── quickstart.md                    # Phase 1 — ngrok setup + Apple Sign In test workflow
├── contracts/
│   └── oauth-state-store.md         # Phase 1 — Redis key contract, operations, error handling
└── tasks.md                         # Phase 2 — task breakdown (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── package.json                     # UPDATED — add @ngrok/ngrok devDependency + dev:ngrok script
├── .env.example                     # UPDATED — add NGROK_AUTHTOKEN
└── src/
    ├── auth/
    │   ├── oauth-state.ts           # NEW — setOAuthState / getAndDeleteOAuthState (Redis)
    │   ├── providers/
    │   │   └── apple.ts             # UPDATED — remove response_mode: 'form_post'
    │   └── session.plugin.ts        # UPDATED — remove oauthState/oauthPlatform type augmentation
    └── api/
        └── auth.routes.ts           # UPDATED — replace session state with oauth-state.ts calls

backend/tests/
└── unit/
    └── auth/
        └── oauth-state.test.ts      # NEW — unit tests for setOAuthState / getAndDeleteOAuthState

frontend/                            # NO CHANGES — deep-link.ts and oauth.ts are correct as-is
```

**Structure Decision**: All changes are confined to `backend/src/auth/` and `backend/src/api/`. The frontend deep link handler (`src/plugins/deep-link.ts`) and OAuth opener (`src/plugins/oauth.ts`) are correct and require no changes. ngrok is a devDependency in the backend package only.

## Complexity Tracking

> No Constitution violations. No entry required.


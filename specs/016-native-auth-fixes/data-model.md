# Data Model: Native App Auth Fixes (016)

**Branch**: `016-native-auth-fixes`
**Date**: 2026-03-15

---

## New Entity: OAuthStateEntry (Redis)

A short-lived, in-memory record used to carry OAuth CSRF state and platform context from the initiation request to the callback, without relying on a session cookie being transmitted across origins.

### Storage: Redis
```
Key:   oauth:state:{stateValue}
Value: JSON string
TTL:   600 seconds (10 minutes)
```

### Schema
```typescript
interface OAuthStateEntry {
  platform: 'web' | 'capacitor' | 'tauri';
}
```

### Field Definitions
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `platform` | `'web' \| 'capacitor' \| 'tauri'` | Yes | The originating platform, used to decide whether to redirect to the deep link scheme or the web APP_URL after the OAuth callback completes |

### Lifecycle
1. **Created**: When `GET /api/auth/{provider}` is called with an optional `?platform=` parameter. A cryptographically random `state` value is generated (via `openid-client`'s `generators.state()`). The `OAuthStateEntry` is written to Redis under `oauth:state:{state}`.
2. **Read**: When `GET /api/auth/google/callback` or `POST /api/auth/apple/callback` is received. The `state` value from the query/body is used to look up the entry.
3. **Deleted**: Immediately after a successful read (consumed once). On lookup failure (key expired or not found), the callback returns an error.

### State Transitions
```
[not exists] → setex (initiation) → [exists, TTL 600s] → get+del (callback) → [not exists]
                                                        ↑
                                              if TTL expires without callback: auto-deleted by Redis
```

---

## Removed Session Fields

The following session fields are removed as part of this feature:

| Session Field | Previous Use | Replaced By |
|---------------|-------------|-------------|
| `session.oauthState` | Stored CSRF state value | Redis key lookup via `oauth:state:{state}` |
| `session.oauthPlatform` | Stored originating platform | `OAuthStateEntry.platform` field in Redis |

The `@fastify/session` type augmentation in `session.plugin.ts` is updated to remove these fields.

---

## Unchanged Entities

No existing database tables, Prisma models, or other session fields are modified by this feature. The `User`, `Integration`, `Task`, `Feed Item`, and all other domain entities remain unchanged.

---

## New Dev-Only Entity: NgrokTunnel

A transient, developer-local tunnel instance that exposes the backend on a public HTTPS URL. This is not persisted and has no schema — it is a runtime process started by `pnpm dev:ngrok`.

| Property | Value |
|----------|-------|
| Bound port | `4000` (backend dev port) |
| Protocol | HTTPS |
| Lifetime | Process lifetime (killed when dev:ngrok stops) |
| URL format | `https://{random}.ngrok-free.app` or static domain if configured |
| Auth | `NGROK_AUTHTOKEN` env var |

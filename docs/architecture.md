# Architecture

> *This document is the canonical reference for ordrctrl's system architecture. It is updated whenever a spec introduces architectural changes — each section is annotated with the spec that last modified it.*

---

## Tech stack

<!-- spec:014 spec:015 -->

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Vite 5, React 18, TypeScript, Tailwind CSS | Static SPA; no server-side rendering |
| Backend | Fastify 4, TypeScript | REST API; JWT-less; cookie session auth |
| Database | PostgreSQL 16 + Prisma ORM | Migrations managed with Prisma Migrate |
| Queue | BullMQ + Redis 7 | Background sync every 15 min; OAuth state store |
| Auth | Email/password · Google OAuth · Apple Sign In | Session cookies; `httpOnly`, `SameSite=Lax` in dev |
| Email | Resend | Verification emails + password reset |
| iOS / Android | Capacitor 6 | Wraps the Vite SPA; native notifications + deep links |
| macOS / Windows | Tauri 2 | Wraps the Vite SPA; native system tray + notifications |

*Vite SPA migration: spec 014. Native app targets: spec 015.*

---

## System overview

```
┌─────────────────────────────────────────────────────────────┐
│  Client layer                                               │
│                                                             │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │  Web browser │  │  iOS / Android   │  │ macOS / Win  │  │
│  │  (Vite SPA)  │  │  (Capacitor 6)   │  │  (Tauri 2)   │  │
│  └──────┬───────┘  └────────┬─────────┘  └──────┬───────┘  │
│         │                   │                    │          │
│         └───────────────────┴────────────────────┘          │
│                             │ HTTPS + cookie session        │
└─────────────────────────────┼───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│  Backend (Fastify 4)                                        │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │  Auth routes │  │  Feed routes │  │  Integration routes│ │
│  └──────┬───────┘  └──────┬───────┘  └─────────┬──────────┘ │
│         │                 │                     │            │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌─────────▼──────────┐ │
│  │ Auth service │  │ Feed service │  │  Adapter registry  │ │
│  └──────┬───────┘  └──────┬───────┘  └─────────┬──────────┘ │
│         │                 │                     │            │
└─────────┼─────────────────┼─────────────────────┼────────────┘
          │                 │                     │
┌─────────┼─────────────────┼─────────────────────┼────────────┐
│  Infrastructure           │                     │            │
│                           │                     │            │
│  ┌────────────┐  ┌────────▼────────┐  ┌─────────▼──────┐    │
│  │   Redis 7  │  │  PostgreSQL 16  │  │  BullMQ queue  │    │
│  │ (sessions  │  │  (Prisma ORM)   │  │  (sync every   │    │
│  │  + OAuth   │  │                 │  │   15 min)      │    │
│  │   state)   │  └─────────────────┘  └────────────────┘    │
│  └────────────┘                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Data model

<!-- spec:001 -->
> *Defined in spec 001. Unchanged through spec 016.*

### Entities

**User** — an ordrctrl account holder.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `email` | String | Unique |
| `passwordHash` | String \| null | Null for social-only accounts |
| `authProvider` | `email` \| `google` \| `apple` | — |
| `providerAccountId` | String \| null | External ID from Google/Apple |
| `emailVerified` | Boolean | Default false |
| `loginAttempts` | Int | Increments on failed login; resets on success |
| `lockedUntil` | DateTime \| null | Set when `loginAttempts ≥ 5` |

**Integration** — a connected third-party service for a user.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `userId` | UUID | FK → User |
| `serviceId` | `gmail` \| `apple_reminders` \| `microsoft_tasks` \| `apple_calendar` | — |
| `status` | `connected` \| `error` \| `disconnected` | — |
| `encryptedAccessToken` | String | AES-256-GCM encrypted |
| `encryptedRefreshToken` | String \| null | AES-256-GCM encrypted |
| `gmailSyncMode` | `all_unread` \| `starred_only` \| null | Gmail only |
| `lastSyncAt` | DateTime \| null | — |

Unique constraint: one integration per `[userId, serviceId]`.

**SyncCacheItem** — a normalized item from an integration sync. TTL ≤ 24 hours.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `integrationId` | UUID | FK → Integration |
| `userId` | UUID | Denormalized for query performance |
| `itemType` | `task` \| `event` \| `message` | — |
| `externalId` | String | Source service's item ID |
| `title` | String | Normalized display title |
| `dueAt` | DateTime \| null | For tasks/reminders |
| `startAt` / `endAt` | DateTime \| null | For calendar events |
| `completedInOrdrctrl` | Boolean | Local completion flag |
| `expiresAt` | DateTime | `syncedAt + 24h` |
| `rawPayload` | JSONB | **Never exposed in API responses or logs** |

**NativeTask** — a task created directly in ordrctrl (not from any integration).

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `userId` | UUID | FK → User |
| `title` | String | Max 500 chars |
| `dueAt` | DateTime \| null | — |
| `completed` | Boolean | Default false |

### Feed view model (not persisted)

`FeedItem` is assembled at request time from `SyncCacheItem` + `NativeTask` records. Never written to the database.

| Field | Notes |
|-------|-------|
| `id` | `"sync:{id}"` or `"native:{id}"` |
| `source` | `"Gmail"`, `"ordrctrl"`, etc. |
| `itemType` | `task` \| `event` \| `message` |
| `dueAt` | Primary sort key |
| `isDuplicateSuspect` | True if another `FeedItem` from a different source has the same title |

**Feed ordering rules**:
1. Items with `dueAt` → ascending by `dueAt`
2. Calendar events → ascending by `startAt`
3. Undated items → descending by `syncedAt`
4. Completed items → separate section, descending by `completedAt`

---

## Authentication

<!-- spec:001 spec:016 -->
> *Core auth flow: spec 001. Redis OAuth state store: spec 016.*

### Session management

Sessions use `@fastify/session` with `httpOnly` cookies. Configuration varies by environment:

| Setting | Development | Production |
|---------|------------|-----------|
| `sameSite` | `'lax'` | `'none'` |
| `secure` | `false` | `true` |

`SameSite: none` in production is required to allow native webview origins (`capacitor://localhost`, `tauri://localhost`) to send the session cookie.

### OAuth state store

<!-- spec:016 -->
> *Changed from session-based to Redis in spec 016. Root cause: Apple's `form_post` callback is a cross-origin POST — `SameSite=Lax` blocks the session cookie.*

OAuth state is stored in Redis (not the session) to survive cross-origin POST callbacks:

```
Key:   oauth:state:{state_value}
Value: JSON { platform: 'web' | 'capacitor' | 'tauri' }
TTL:   600 seconds (10 minutes)
```

**Initiation**: `redis.setex('oauth:state:{state}', 600, JSON.stringify({ platform }))`  
**Callback**: `redis.get('oauth:state:{state}')` → parse → delete key

### Apple Sign In specifics

<!-- spec:016 -->
> *`response_mode: 'form_post'` was removed in spec 016. SFSafariViewController does not follow 302 redirects from POST responses.*

- Uses `response_mode: 'query'` (standard OAuth 2.0 code in query string)
- Callback: `GET /api/auth/apple/callback` — SFSafariViewController follows the GET redirect normally
- Deep link fires after redirect to `ordrctrl://auth/callback?status=success`

### CORS

<!-- spec:015 -->
> *Multi-origin CORS added in spec 015 for native webview origins.*

Backend allows `credentials: true` for a fixed set of origins, configured via `NATIVE_APP_ORIGINS` + `APP_URL`:

```
http://localhost:3000     # Web dev
capacitor://localhost     # iOS / Android
tauri://localhost         # macOS / Windows
```

---

## Sync architecture

Background sync runs on a BullMQ queue (Redis-backed) every 15 minutes per integration.

```
BullMQ scheduler (every 15 min)
  → for each connected Integration:
      adapter.sync(integrationId)
        → fetch from external API
        → normalize to NormalizedItem[]
      upsert SyncCacheItems (unique on [integrationId, externalId])
      update Integration.lastSyncAt
  → cleanup expired SyncCacheItems (expiresAt < now)
```

On token expiry:
1. Sync scheduler catches the 401 from the provider
2. Calls `adapter.refreshToken(integrationId)`
3. On success: updates stored access token → retry sync
4. On `TokenRefreshError`: sets `integration.status = 'error'` → user notified

---

## Native platform layer

<!-- spec:015 -->
> *Added in spec 015. Both wrappers use the Vite SPA build output unchanged.*

The Vite `dist/` build is consumed identically by all three targets:

| Target | Wrapper | URL scheme | Auth callback |
|--------|---------|------------|---------------|
| Web | Browser | `https://` | `GET /api/auth/*/callback` |
| iOS / Android | Capacitor 6 | `capacitor://localhost` | `ordrctrl://auth/callback` |
| macOS / Windows | Tauri 2 | `tauri://localhost` | `ordrctrl://auth/callback` |

**Plugin abstraction** (`frontend/src/plugins/`): Native capabilities (notifications, deep links) are accessed through a shared service layer, not called directly. Platform detection at runtime selects the Capacitor, Tauri, or no-op (web) implementation.

**OAuth flow on native**:
1. Frontend opens `GET /api/auth/{provider}?platform=capacitor` via `@capacitor/browser` or `tauri-plugin-opener`
2. Backend generates state, stores in Redis, redirects to provider
3. Provider redirects to `GET /api/auth/{provider}/callback`
4. Backend validates state, exchanges code, redirects to `ordrctrl://auth/callback?status=success`
5. `appUrlOpen` listener fires → `Browser.close()` → navigate to `/feed`

---

## Key design decisions

| Decision | Rationale | Spec |
|----------|-----------|------|
| Stateless OAuth state (Redis) | `SameSite=Lax` blocks session cookie on Apple's cross-origin POST callback | 016 |
| `response_mode: 'query'` for Apple | `form_post` + SFSafariViewController = POST→302 redirect not followed | 016 |
| Vite SPA (no SSR) | App is fully auth-gated; no public SEO surface; enables Capacitor/Tauri wrapping without per-platform builds | 014 |
| Single Vite build for all platforms | Capacitor + Tauri both consume `dist/` directly; no per-platform build config | 014, 015 |
| Enumerated CORS origins | `credentials: include` cannot use `*`; native webview origins must be explicitly listed | 015 |
| AES-256-GCM for token encryption | OAuth tokens stored encrypted at rest; key rotatable via `TOKEN_ENCRYPTION_KEY` | 001 |
| `rawPayload` never in API/logs | Source API payloads contain PII (email subjects, task body text) | 001 |

---

## Document history

| Spec | Change |
|------|--------|
| [001-mvp-core](../specs/001-mvp-core/) | Initial architecture: data model, auth, sync, feed |
| [014-vite-migration](../specs/014-vite-migration/) | Frontend migrated from Next.js to Vite SPA |
| [015-native-app-targets](../specs/015-native-app-targets/) | Added Capacitor (iOS/Android) + Tauri (macOS/Windows); multi-origin CORS; `SameSite: none` in prod |
| [016-native-auth-fixes](../specs/016-native-auth-fixes/) | Redis-based OAuth state store; removed `response_mode: form_post` from Apple flow |

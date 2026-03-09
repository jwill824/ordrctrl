# Data Model: Apple iCloud Integration via App-Specific Password

**Feature**: 004-apple-basic-auth  
**Phase**: 1 — Design & Contracts

---

## Schema Changes

### Modified: `Integration` model

One new field added. No existing fields removed or renamed. No new model.

```prisma
model Integration {
  id                      String            @id @default(uuid())
  userId                  String
  serviceId               ServiceId
  status                  IntegrationStatus @default(connected)
  encryptedAccessToken    String            // Apple: encrypted iCloud email address
  encryptedRefreshToken   String?           // Apple: encrypted App-Specific Password (normalized, no hyphens)
  tokenExpiresAt          DateTime?         // Apple: always null (credentials revoked, not expired)
  gmailSyncMode           GmailSyncMode?    // Gmail only
  calendarEventWindowDays Int               @default(30)  // ← NEW: Apple Calendar only; 7|14|30|60
  importEverything        Boolean           @default(true)
  selectedSubSourceIds    String[]          @default([])
  lastSyncAt              DateTime?
  lastSyncError           String?
  createdAt               DateTime          @default(now())
  updatedAt               DateTime          @updatedAt

  user           User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  syncCacheItems SyncCacheItem[]

  @@unique([userId, serviceId])
  @@index([userId])
  @@index([status])
}
```

**Migration**: `prisma migrate dev --name add-calendar-event-window`  
Adds a single non-nullable integer column with `DEFAULT 30`. Safe for existing rows and zero-downtime deployable.

---

## Updated TypeScript Types

### `backend/src/integrations/_adapter/types.ts`

```typescript
// ── Connect payload ──────────────────────────────────────────────────────────

/** OAuth flow (Gmail, Microsoft Tasks): carries the authorization code from the
 *  callback redirect. All existing OAuth adapters wrap their authCode here. */
export type OAuthPayload = {
  type: 'oauth';
  authCode: string;
};

/** Credential flow (Apple Calendar): carries a validated
 *  iCloud email address and an App-Specific Password (dashes stripped).
 *  *(Originally listed Apple Reminders here — removed 2026-03-09)* */
export type CredentialPayload = {
  type: 'credential';
  email: string;
  /** Normalized ASP — hyphens already stripped by service layer before passing here. */
  password: string;
};

export type ConnectPayload = OAuthPayload | CredentialPayload;

// ── Connect options (extended) ────────────────────────────────────────────────

export interface ConnectOptions {
  /** Gmail only: inbox query scope. */
  gmailSyncMode?: 'all_unread' | 'starred_only';
  /** Apple Calendar only: upcoming events window (days). Defaults to 30. */
  calendarEventWindowDays?: 7 | 14 | 30 | 60;
}

// ── Updated adapter interface ─────────────────────────────────────────────────

export interface IntegrationAdapter {
  readonly serviceId: ServiceId;

  /** OAuth adapters: payload.type === 'oauth'. Apple adapters: payload.type === 'credential'. */
  connect(userId: string, payload: ConnectPayload, options?: ConnectOptions): Promise<{ integrationId: string }>;

  disconnect(integrationId: string): Promise<void>;
  sync(integrationId: string): Promise<NormalizedItem[]>;

  /** Apple adapters throw NotSupportedError. All others implement normally. */
  refreshToken(integrationId: string): Promise<void>;

  /** Apple adapters throw NotSupportedError. All others implement normally. */
  getAuthorizationUrl(state: string, options?: ConnectOptions): Promise<string>;

  listSubSources?(integrationId: string): Promise<SubSource[]>;
}

// ── Error classes ─────────────────────────────────────────────────────────────

export class TokenRefreshError extends Error {
  constructor(public readonly integrationId: string, message: string) {
    super(message);
    this.name = 'TokenRefreshError';
  }
}

/** Thrown by Apple adapters when OAuth-only methods (refreshToken, getAuthorizationUrl)
 *  are called on credential-based adapters. Fail-fast by design. */
export class NotSupportedError extends Error {
  constructor(message = 'not supported for credential-based adapters') {
    super(message);
    this.name = 'NotSupportedError';
  }
}

/** Thrown when iCloud returns HTTP 401 — indicates revoked or invalid ASP. */
export class InvalidCredentialsError extends Error {
  constructor(public readonly integrationId: string) {
    super('iCloud credentials are no longer valid');
    this.name = 'InvalidCredentialsError';
  }
}

/** Thrown on iCloud HTTP 5xx / network timeout — transient; credentials retained. */
export class ProviderUnavailableError extends Error {
  constructor(
    public readonly integrationId: string,
    public readonly statusCode?: number,
  ) {
    super('iCloud is temporarily unavailable');
    this.name = 'ProviderUnavailableError';
  }
}
```

---

## Updated Service Layer Types

### `IntegrationStatusItem` (in `backend/src/integrations/integration.service.ts`)

```typescript
export interface IntegrationStatusItem {
  serviceId: ServiceId;
  status: 'connected' | 'error' | 'disconnected';
  lastSyncAt: string | null;
  lastSyncError: string | null;
  gmailSyncMode: 'all_unread' | 'starred_only' | null;
  /** Apple Calendar only: event window preference. Null for non-Apple or unconfigured. */
  calendarEventWindowDays: 7 | 14 | 30 | 60 | null;
  /** Apple services only: masked iCloud email (e.g. "j***@icloud.com"). Null when no
   *  credentials on file or not an Apple service. Used by frontend confirmation screen. */
  maskedEmail: string | null;
  importEverything: boolean;
  selectedSubSourceIds: string[];
}
```

**Masking logic** (service layer):
```typescript
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local[0]}***@${domain}`;
}
```

---

## Entity Relationships (unchanged)

```
User ──< Integration (@@unique userId+serviceId)
Integration ──< SyncCacheItem
SyncCacheItem ──< SyncOverride
```

No new relationships introduced.

---

## Field Semantics by ServiceId

> **⚠️ Scope Revision (2026-03-09)**: `apple_reminders` removed from `ServiceId`. Current type is:
> `export type ServiceId = 'gmail' | 'microsoft_tasks' | 'apple_calendar';`
> `UseExistingPayload` is retained in the codebase but dormant — see research.md Section 6.

| Field | gmail | ~~apple_reminders~~ | apple_calendar | microsoft_tasks |
|-------|-------|----------------|----------------|-----------------|
| `encryptedAccessToken` | OAuth access token | ~~Encrypted iCloud email~~ | Encrypted iCloud email | OAuth access token |
| `encryptedRefreshToken` | OAuth refresh token | ~~Encrypted ASP (no dashes)~~ | Encrypted ASP (no dashes) | OAuth refresh token |
| `tokenExpiresAt` | Token expiry | ~~`null` always~~ | `null` always | Token expiry |
| `gmailSyncMode` | Set | ~~`null`~~ | `null` | `null` |
| `calendarEventWindowDays` | `30` (ignored) | ~~`30` (ignored)~~ | User-configured | `30` (ignored) |

> `calendarEventWindowDays` defaults to 30 in Prisma. For non-Apple services it is stored but never read by the adapter — safe to ignore.

---

## State Transitions

### Apple Integration `status` field

```
                 ┌─────────────────────────────────────┐
                 │                                     │
   [disconnect]  ▼         [connect succeeds]          │ [reconnect succeeds]
disconnected ◄──────── connected ─────────────────────►│
                             │                         │
                             │ [sync → 401]             │
                             ▼                         │
                           error ────────────────────►─┘
                             │
                             │ [sync → 5xx / timeout]
                             │ (status stays error, credentials retained)
                             └──────────── error (same state, error message updated)
```

**Invariants**:
- `status = 'connected'` ↔ `encryptedAccessToken` and `encryptedRefreshToken` are non-null
- `status = 'disconnected'` ↔ `encryptedAccessToken = ''` and `encryptedRefreshToken = null` (cleared on final disconnect)
- `status = 'error'` may retain credentials (transient error) or have them cleared (handled by disconnect, not by sync)

---

## Validation Rules

### Credential Input (validated at API layer before reaching service/adapter)

| Field | Rule |
|-------|------|
| `email` | Valid email format (RFC 5322); accepts `@icloud.com`, `@me.com`, `@mac.com`, and any valid Apple ID domain |
| `password` | Non-empty string; strip hyphens → must result in exactly 16 lowercase alphanumeric characters |
| `calendarEventWindowDays` | Integer; must be in `[7, 14, 30, 60]` |

**ASP normalization** (service layer, before passing to adapter):
```typescript
const normalizedAsp = asp.replace(/-/g, '');
if (!/^[a-z0-9]{16}$/.test(normalizedAsp)) {
  throw new ValidationError('Invalid App-Specific Password format');
}
```

> Note: Apple ASPs are 16 lowercase alphabetic characters (`[a-z]`). The regex `[a-z0-9]` is slightly permissive but safe — iCloud will reject truly invalid ASPs during the PROPFIND validation call.

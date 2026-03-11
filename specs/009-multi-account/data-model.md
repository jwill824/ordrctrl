# Data Model: Multi-Account Support (009)

## Schema Changes

### Integration (modified)

```
Integration {
  id                    String            @id @default(uuid())
  userId                String
  serviceId             ServiceId
  accountIdentifier     String            // NEW: external account email/ID (e.g., "user@gmail.com")
  label                 String?           // NEW: user-set nickname (max 50 chars, null = use accountIdentifier)
  paused                Boolean           @default(false)  // NEW: P3 pause flag
  status                IntegrationStatus @default(connected)
  encryptedAccessToken  String
  encryptedRefreshToken String?
  tokenExpiresAt        DateTime?
  gmailSyncMode             GmailSyncMode?
  gmailCompletionMode       GmailCompletionMode?
  calendarEventWindowDays   Int           @default(30)
  importEverything          Boolean       @default(true)
  selectedSubSourceIds  String[]          @default([])
  lastSyncAt            DateTime?
  lastSyncError         String?
  createdAt             DateTime          @default(now())
  updatedAt             DateTime          @updatedAt

  user           User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  syncCacheItems SyncCacheItem[]

  // CHANGED: was @@unique([userId, serviceId])
  @@unique([userId, serviceId, accountIdentifier])
  @@index([userId])
  @@index([status])
}
```

**New fields:**

| Field | Type | Notes |
|-------|------|-------|
| `accountIdentifier` | `String` | External account's stable ID (email or provider user ID). Retrieved during OAuth. Used for deduplication. |
| `label` | `String?` | User-set nickname. Null = display `accountIdentifier`. Max 50 chars. |
| `paused` | `Boolean` | P3 feature. When true, sync scheduler skips this account. Defaults false. |

**Constraint change:**
- Remove `@@unique([userId, serviceId])`
- Add `@@unique([userId, serviceId, accountIdentifier])`

### No other schema changes required

- `SyncCacheItem` — unchanged. Already scoped by `integrationId`, which now represents a specific account.
- `SyncOverride` — unchanged. Scoped by `syncCacheItemId`, which is already per-account via `integrationId`.
- `NativeTask` — unchanged. Native tasks are user-owned, not integration-scoped.
- `User` — unchanged (user settings already added in spec 008).

---

## Migration Plan

### Step 1 — Add nullable columns
```sql
ALTER TABLE "Integration" ADD COLUMN "accountIdentifier" TEXT;
ALTER TABLE "Integration" ADD COLUMN "label" TEXT;
ALTER TABLE "Integration" ADD COLUMN "paused" BOOLEAN NOT NULL DEFAULT false;
```

### Step 2 — Backfill accountIdentifier
A TypeScript migration script decrypts each integration's `encryptedAccessToken`, extracts the account email (from `id_token` for Google, from stored token data for Microsoft, from `email` credential field for Apple), and writes it to `accountIdentifier`. Falls back to `"unknown@{serviceId}"` if extraction fails.

### Step 3 — Set NOT NULL and new unique constraint
```sql
-- Set NOT NULL after backfill
ALTER TABLE "Integration" ALTER COLUMN "accountIdentifier" SET NOT NULL;

-- Drop old unique constraint
DROP INDEX "Integration_userId_serviceId_key";

-- Add new unique constraint
CREATE UNIQUE INDEX "Integration_userId_serviceId_accountIdentifier_key"
  ON "Integration"("userId", "serviceId", "accountIdentifier");
```

---

## State Transitions: Integration Account

```
[Not connected]
      │
      ▼ connect (OAuth or credential)
  [connected] ←─────────────────────┐
      │                              │
      ├─ pause ──► [paused]          │
      │             │                │
      │           resume ────────────┘
      │
      ├─ token error ──► [error]
      │                    │
      │                  sync retry (token refresh succeeds) ──► [connected] (auto-heal)
      │                    │
      │                  reconnect (manual) ──► [connected]
      │
      └─ disconnect ──► [removed] (row deleted)
```

**Note on error state**: When an integration is in `error` state, the sync worker will still attempt to run it (it only skips `disconnected` integrations). If the token refresh succeeds during a retry, the integration auto-heals back to `connected` without user intervention. Only a deliberate disconnect permanently removes the integration.

---

## Key Validation Rules

- `accountIdentifier` must be non-empty and unique per `(userId, serviceId)` — enforced by DB constraint.
- `label` max length 50 characters — enforced at service layer.
- Max 5 Integration rows per `(userId, serviceId)` — enforced at service layer before insert.
- Cannot pause an integration in `error` or `disconnected` status.
- Cannot connect the same `accountIdentifier` twice for the same `(userId, serviceId)` — DB unique constraint.

---

## Feed Item Contract Change

The `source` field on `FeedItem` currently holds `SERVICE_DISPLAY_NAMES[serviceId]`. For multi-account, it becomes the account-level display string:

```
source = integration.label ?? integration.accountIdentifier
```

This is a **non-breaking change for single-account users** who have no label set: their `source` changes from "Gmail" to their email address. Given this is a personal workspace tool, displaying the email is more useful than the service name when the user only has one account connected too.

If a reversal is needed, the service display name is still available via the `itemType`/badge. The feed item already shows the source as a badge — the label just becomes more informative.

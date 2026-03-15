# Integrations

> *This document covers the `IntegrationAdapter` interface contract, the lifecycle of an integration, and how to add a new integration. It is the canonical reference for integration development.*

---

## Adapter interface

<!-- spec:001 -->
> *Defined in spec 001. Implemented at `backend/src/integrations/_adapter/types.ts`.*

Every integration MUST implement the `IntegrationAdapter` interface. The core application interacts exclusively through this interface — never through integration-specific internals.

```typescript
// backend/src/integrations/_adapter/types.ts

export type ServiceId =
  | 'gmail'
  | 'apple_reminders'
  | 'microsoft_tasks'
  | 'apple_calendar';

export interface NormalizedItem {
  externalId: string;
  itemType: 'task' | 'event' | 'message';
  title: string;
  dueAt: Date | null;
  startAt: Date | null;   // calendar events only
  endAt: Date | null;     // calendar events only
  rawPayload: Record<string, unknown>;  // never exposed in API responses
}

export interface ConnectOptions {
  gmailSyncMode?: 'all_unread' | 'starred_only';  // Gmail only
}

export interface IntegrationAdapter {
  /** Identifies which service this adapter handles. */
  readonly serviceId: ServiceId;

  /**
   * Exchanges an OAuth authorization code for tokens and persists the
   * encrypted integration record for the given user.
   * Called once during onboarding after the OAuth redirect.
   */
  connect(
    userId: string,
    authCode: string,
    options?: ConnectOptions
  ): Promise<{ integrationId: string }>;

  /**
   * Revokes OAuth tokens at the provider and deletes all stored credentials
   * and sync cache items for this integration.
   */
  disconnect(integrationId: string): Promise<void>;

  /**
   * Fetches the latest items from the provider and returns them as
   * normalized NormalizedItem[]. Does NOT write to the database —
   * the sync scheduler owns persistence.
   */
  sync(integrationId: string): Promise<NormalizedItem[]>;

  /**
   * Attempts a silent OAuth token refresh using the stored refresh token.
   * On success: updates the stored access token.
   * On failure: throws TokenRefreshError — caller sets integration status to 'error'.
   */
  refreshToken(integrationId: string): Promise<void>;
}

export class TokenRefreshError extends Error {
  constructor(public readonly integrationId: string, message: string) {
    super(message);
    this.name = 'TokenRefreshError';
  }
}
```

---

## Lifecycle contract

| Method | Called by | Precondition | Postcondition |
|--------|-----------|--------------|---------------|
| `connect` | Onboarding API route | Valid `authCode` from provider redirect | Integration row created; tokens encrypted; initial sync queued |
| `disconnect` | Integration settings route | Integration exists | Tokens deleted; `SyncCacheItems` deleted; status → `disconnected` |
| `sync` | BullMQ sync scheduler (every 15 min) | Integration status is `connected` | Returns `NormalizedItem[]`; does NOT persist |
| `refreshToken` | Sync scheduler on 401 from provider | Refresh token stored | Access token updated in DB; throws `TokenRefreshError` on failure |

---

## Existing adapters

| Service | Path | Auth type | Notes |
|---------|------|-----------|-------|
| Gmail | `backend/src/integrations/gmail/` | OAuth 2.0 | Sync mode: `all_unread` or `starred_only` |
| Microsoft Tasks | `backend/src/integrations/microsoft-tasks/` | OAuth 2.0 | Multi-tenant (`MICROSOFT_TENANT_ID` defaults to `'common'`) |
| Apple Calendar | `backend/src/integrations/apple-calendar/` | CalDAV HTTP Basic Auth | Credentials entered via UI, stored AES-256-GCM encrypted |

---

## Adding a new integration

1. **Create the adapter**

   ```bash
   mkdir backend/src/integrations/<service-name>
   touch backend/src/integrations/<service-name>/index.ts
   ```

2. **Implement the interface**

   ```typescript
   import type { IntegrationAdapter, NormalizedItem } from '../_adapter/types';
   import { db } from '../../lib/db';
   import { decrypt } from '../../lib/encryption';

   export class MyServiceAdapter implements IntegrationAdapter {
     readonly serviceId = 'my_service' as const; // add to ServiceId union first

     async connect(userId: string, authCode: string) {
       // Exchange code for tokens, persist to Integration table
       return { integrationId: '...' };
     }

     async disconnect(integrationId: string) {
       // Revoke tokens at provider, delete from DB
     }

     async sync(integrationId: string): Promise<NormalizedItem[]> {
       // Fetch from provider API, normalize to NormalizedItem[]
       // Do NOT write to DB — the sync scheduler does that
       return [];
     }

     async refreshToken(integrationId: string) {
       // Use stored refresh token to get a new access token
       // Update DB; throw TokenRefreshError on failure
     }
   }
   ```

3. **Add `serviceId` to the union** in `backend/src/integrations/_adapter/types.ts`

4. **Register the adapter** in `backend/src/integrations/index.ts`

   ```typescript
   import { MyServiceAdapter } from './my-service';

   export const adapters: Record<ServiceId, IntegrationAdapter> = {
     // ...existing adapters
     my_service: new MyServiceAdapter(),
   };
   ```

5. **Add a Prisma enum value** for the new `serviceId` and run `pnpm prisma migrate dev`

6. **Add an OAuth route** in `backend/src/api/auth.routes.ts` (or a dedicated routes file) following the pattern of the Gmail or Microsoft routes

7. **Write tests**
   - Unit test for `sync()` normalization in `backend/tests/unit/integrations/`
   - Contract test for the OAuth callback route in `backend/tests/contract/`

**Rule**: No changes to core feed, sync, or API code are required. The adapter pattern ensures full isolation.

---

## Security rules

- Tokens are stored AES-256-GCM encrypted (`TOKEN_ENCRYPTION_KEY`). Never store plaintext.
- `rawPayload` on `SyncCacheItem` must never appear in API responses, logs, or error messages — it may contain PII (email subjects, task bodies).
- On disconnect, tokens must be revoked at the provider before deletion from the database.

---

## Document history

| Spec | Change |
|------|--------|
| [001-mvp-core](../specs/001-mvp-core/) | Initial `IntegrationAdapter` interface; Gmail, Microsoft Tasks, Apple Calendar adapters |

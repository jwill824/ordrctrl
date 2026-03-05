# Contract: IntegrationAdapter Interface

**Version**: 1.0 | **Date**: 2026-03-05

## Overview

Every integration plugin MUST implement this interface. The core application interacts
exclusively through this interface — never through integration-specific internals.
(Constitution Principle I: Integration Modularity)

## TypeScript Interface

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

## Lifecycle Contract

| Method | Called by | Precondition | Postcondition |
|--------|-----------|--------------|---------------|
| `connect` | Onboarding API route | Valid `authCode` from provider redirect | Integration row created; tokens encrypted; initial sync queued |
| `disconnect` | Integration settings route | Integration exists | Tokens deleted; SyncCacheItems deleted; status set to `disconnected` |
| `sync` | BullMQ sync scheduler (every 15 min) | Integration status is `connected` | Returns `NormalizedItem[]`; does NOT persist |
| `refreshToken` | Sync scheduler on token expiry | Refresh token stored | Access token updated in DB; throws `TokenRefreshError` on failure |

## Plugin Registration

Each adapter registers itself in `backend/src/integrations/index.ts`:

```typescript
import { GmailAdapter } from './gmail';
import { AppleRemindersAdapter } from './apple-reminders';
import { MicrosoftTasksAdapter } from './microsoft-tasks';
import { AppleCalendarAdapter } from './apple-calendar';

export const adapters: Record<ServiceId, IntegrationAdapter> = {
  gmail: new GmailAdapter(),
  apple_reminders: new AppleRemindersAdapter(),
  microsoft_tasks: new MicrosoftTasksAdapter(),
  apple_calendar: new AppleCalendarAdapter(),
};
```

## Adding a New Integration (Post-MVP)

1. Create `backend/src/integrations/<service-name>/index.ts`
2. Implement `IntegrationAdapter` interface
3. Register in `backend/src/integrations/index.ts`
4. No changes to core feed, sync, or API code required

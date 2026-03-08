// T033 — IntegrationAdapter interface, ServiceId enum, NormalizedItem + ConnectOptions

export type ServiceId =
  | 'gmail'
  | 'apple_reminders'
  | 'microsoft_tasks'
  | 'apple_calendar';

export const SERVICE_DISPLAY_NAMES: Record<ServiceId, string> = {
  gmail: 'Gmail',
  apple_reminders: 'Apple Reminders',
  microsoft_tasks: 'Microsoft Tasks',
  apple_calendar: 'Apple Calendar',
};

export interface NormalizedItem {
  externalId: string;
  itemType: 'task' | 'event' | 'message';
  title: string;
  dueAt: Date | null;
  startAt: Date | null; // calendar events only
  endAt: Date | null;   // calendar events only
  subSourceId?: string;
  rawPayload: Record<string, unknown>; // never exposed in API responses
}

export interface SubSource {
  id: string;
  label: string;
  type: 'list' | 'calendar' | 'label' | 'folder';
}

export interface ConnectOptions {
  gmailSyncMode?: 'all_unread' | 'starred_only'; // Gmail only
}

export interface IntegrationAdapter {
  /** Identifies which service this adapter handles. */
  readonly serviceId: ServiceId;

  /**
   * Exchanges an OAuth authorization code for tokens and persists the
   * encrypted integration record for the given user.
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
   * Fetches the latest items from the provider.
   * Does NOT write to the database — sync scheduler owns persistence.
   */
  sync(integrationId: string): Promise<NormalizedItem[]>;

  /**
   * Attempts a silent OAuth token refresh using the stored refresh token.
   * Throws TokenRefreshError on failure.
   */
  refreshToken(integrationId: string): Promise<void>;

  /**
   * Returns the OAuth authorization URL for this integration.
   */
  getAuthorizationUrl(state: string, options?: ConnectOptions): Promise<string>;

  /**
   * Lists available sub-sources (labels, lists, calendars) for this integration.
   * Optional — adapters that do not support sub-sources may omit this.
   */
  listSubSources?(integrationId: string): Promise<SubSource[]>;
}

export class TokenRefreshError extends Error {
  constructor(
    public readonly integrationId: string,
    message: string
  ) {
    super(message);
    this.name = 'TokenRefreshError';
  }
}

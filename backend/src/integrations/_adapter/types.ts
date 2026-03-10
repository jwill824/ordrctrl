// T033 — IntegrationAdapter interface, ServiceId enum, NormalizedItem + ConnectOptions

export type ServiceId =
  | 'gmail'
  | 'microsoft_tasks'
  | 'apple_calendar';

export const SERVICE_DISPLAY_NAMES: Record<ServiceId, string> = {
  gmail: 'Gmail',
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
  /** Whether the source system considers this item complete. undefined = adapter does not report completion state. */
  completed?: boolean;
}

export interface SubSource {
  id: string;
  label: string;
  type: 'list' | 'calendar' | 'label' | 'folder';
}

export interface ConnectOptions {
  gmailSyncMode?: 'all_unread' | 'starred_only';
  calendarEventWindowDays?: 7 | 14 | 30 | 60;
}

/** OAuth authorization code payload */
export interface OAuthPayload {
  type: 'oauth';
  authCode: string;
}

/** iCloud email + App-Specific Password payload */
export interface CredentialPayload {
  type: 'credential';
  email: string;
  password: string;
}

/** Reuse credentials from a sibling Apple integration already connected */
export interface UseExistingPayload {
  type: 'use-existing';
}

export type ConnectPayload = OAuthPayload | CredentialPayload | UseExistingPayload;

export interface IntegrationAdapter {
  /** Identifies which service this adapter handles. */
  readonly serviceId: ServiceId;

  /**
   * Connects an integration using the provided payload (OAuth code or credentials)
   * and persists the encrypted integration record for the given user.
   */
  connect(
    userId: string,
    payload: ConnectPayload,
    options?: ConnectOptions
  ): Promise<{ integrationId: string }>;

  /**
   * Revokes tokens/credentials at the provider and deletes all stored credentials
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
   * Throws TokenRefreshError on failure, or NotSupportedError if not applicable.
   */
  refreshToken(integrationId: string): Promise<void>;

  /**
   * Returns the OAuth authorization URL for this integration.
   * Throws NotSupportedError for non-OAuth adapters.
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

export class NotSupportedError extends Error {
  constructor(serviceId: string, operation: string) {
    super(`${operation} is not supported for ${serviceId}`);
    this.name = 'NotSupportedError';
  }
}

export class InvalidCredentialsError extends Error {
  constructor(serviceId: string) {
    super(`Invalid credentials for ${serviceId}`);
    this.name = 'InvalidCredentialsError';
  }
}

export class ProviderUnavailableError extends Error {
  constructor(
    public readonly serviceId: string,
    public readonly statusCode?: number
  ) {
    super(`Provider ${serviceId} is unavailable${statusCode ? ` (HTTP ${statusCode})` : ''}`);
    this.name = 'ProviderUnavailableError';
  }
}

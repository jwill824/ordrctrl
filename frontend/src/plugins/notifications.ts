/**
 * Native Notifications — NotificationService
 *
 * Provides:
 *  - `NotificationPayload` interface
 *  - `NativePreferences` interface and read/write helpers
 *  - `NotificationService` — singleton with `schedule()`, permission flow,
 *    and notification-tap listener registration
 *
 * Platform dispatch:
 *  - Capacitor: @capacitor/local-notifications
 *  - Tauri:     @tauri-apps/plugin-notification
 *  - Web:       no-op
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotificationPayload {
  /**
   * Unique numeric ID. Capacitor uses Java ints — collisions overwrite.
   * Range: 1–2147483647. Use a stable hash of the source item ID.
   */
  id: number;
  /** Short title text — OS truncates beyond ~50 chars */
  title: string;
  /** Detail text — OS truncates beyond ~100 chars on lock screen */
  body: string;
  /**
   * ordrctrl:// deep link URL to navigate to when the notification is tapped.
   * Examples: "ordrctrl://feed", "ordrctrl://inbox"
   */
  actionUrl: string;
  /** Optional future delivery time; absent or past → immediate */
  scheduledAt?: Date | string;
  /** Thread/group key for notification grouping (iOS threadIdentifier / Android channelId) */
  group?: 'feed' | 'inbox' | 'system';
}

export interface NativePreferences {
  lastSeenFeedTimestamp: string | null;
  lastSeenInboxTimestamp: string | null;
  notificationsPermissionAsked: boolean;
}

// ---------------------------------------------------------------------------
// Helpers — detect platform
// ---------------------------------------------------------------------------

function isCapacitorNative(): boolean {
  return (
    typeof window !== 'undefined' &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof (window as any).Capacitor !== 'undefined' &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Capacitor?.isNativePlatform?.() === true
  );
}

function isTauriNative(): boolean {
  return (
    typeof window !== 'undefined' &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof (window as any).__TAURI_INTERNALS__ !== 'undefined'
  );
}

// ---------------------------------------------------------------------------
// NativePreferences helpers
// ---------------------------------------------------------------------------

const PREF_PREFIX = 'ordrctrl.native.';

/**
 * Read a preference value.
 * On Capacitor native, uses @capacitor/preferences; falls back to localStorage.
 */
async function readPref(key: string): Promise<string | null> {
  const fullKey = `${PREF_PREFIX}${key}`;
  if (isCapacitorNative()) {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key: fullKey });
      return value;
    } catch {
      // fall through to localStorage
    }
  }
  if (typeof window !== 'undefined') {
    return window.localStorage.getItem(fullKey);
  }
  return null;
}

/**
 * Write a preference value.
 * On Capacitor native, uses @capacitor/preferences; falls back to localStorage.
 */
async function writePref(key: string, value: string): Promise<void> {
  const fullKey = `${PREF_PREFIX}${key}`;
  if (isCapacitorNative()) {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key: fullKey, value });
      return;
    } catch {
      // fall through to localStorage
    }
  }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(fullKey, value);
  }
}

export const NativePrefs = {
  async getLastSeenFeedTimestamp(): Promise<string | null> {
    return readPref('lastSeenFeedTimestamp');
  },
  async setLastSeenFeedTimestamp(ts: string): Promise<void> {
    return writePref('lastSeenFeedTimestamp', ts);
  },
  async getLastSeenInboxTimestamp(): Promise<string | null> {
    return readPref('lastSeenInboxTimestamp');
  },
  async setLastSeenInboxTimestamp(ts: string): Promise<void> {
    return writePref('lastSeenInboxTimestamp', ts);
  },
  async isPermissionAsked(): Promise<boolean> {
    return (await readPref('notificationsPermissionAsked')) === 'true';
  },
  async markPermissionAsked(): Promise<void> {
    return writePref('notificationsPermissionAsked', 'true');
  },
};

// ---------------------------------------------------------------------------
// Tauri — actionUrl map (keyed by notification id string)
// ---------------------------------------------------------------------------

const tauriActionUrlMap = new Map<string, string>();

// ---------------------------------------------------------------------------
// Navigation callback registration
// ---------------------------------------------------------------------------

type NavigationCallback = (path: string) => void;
let _navigationCallback: NavigationCallback | null = null;

export function registerNotificationNavigationCallback(cb: NavigationCallback): void {
  _navigationCallback = cb;
}

function navigateTo(url: string): void {
  // url is an ordrctrl:// deep link — strip the scheme/host to get the path
  try {
    const parsed = new URL(url);
    const path = '/' + parsed.hostname + (parsed.pathname !== '/' ? parsed.pathname : '') + parsed.search;
    _navigationCallback?.(path);
  } catch {
    _navigationCallback?.(url);
  }
}

// ---------------------------------------------------------------------------
// Permission flow
// ---------------------------------------------------------------------------

async function checkAndRequestPermission(): Promise<boolean> {
  if (!isCapacitorNative() && !isTauriNative()) return false;

  const alreadyAsked = await NativePrefs.isPermissionAsked();
  await NativePrefs.markPermissionAsked();

  if (isCapacitorNative()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      let { display } = await LocalNotifications.checkPermissions();
      if (display === 'prompt' || (!alreadyAsked && display !== 'granted')) {
        const result = await LocalNotifications.requestPermissions();
        display = result.display;
      }
      return display === 'granted';
    } catch {
      return false;
    }
  }

  if (isTauriNative()) {
    try {
      const { isPermissionGranted, requestPermission } = await import(
        '@tauri-apps/plugin-notification'
      );
      let granted = await isPermissionGranted();
      if (!granted && !alreadyAsked) {
        const permission = await requestPermission();
        granted = permission === 'granted';
      }
      return granted;
    } catch {
      return false;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Tap listeners
// ---------------------------------------------------------------------------

let listenersRegistered = false;

async function ensureListeners(): Promise<void> {
  if (listenersRegistered) return;
  listenersRegistered = true;

  if (isCapacitorNative()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const actionUrl: string | undefined = (action.notification.extra as any)?.actionUrl;
        if (actionUrl) navigateTo(actionUrl);
      });
    } catch {
      // ignore — non-native build
    }
  }

  if (isTauriNative()) {
    try {
      const { onAction } = await import('@tauri-apps/plugin-notification');
      await onAction((notification) => {
        // onAction receives the Options object directly — look up actionUrl by id
        const key = String(notification.id);
        const actionUrl = tauriActionUrlMap.get(key);
        if (actionUrl) {
          tauriActionUrlMap.delete(key);
          navigateTo(actionUrl);
        }
      });
    } catch {
      // ignore — non-Tauri build or API unavailable
    }
  }
}

// ---------------------------------------------------------------------------
// NotificationService
// ---------------------------------------------------------------------------

export const NotificationService = {
  /**
   * Register tap-navigation listeners. Call once on app startup
   * (after registering the navigation callback).
   */
  async init(): Promise<void> {
    return ensureListeners();
  },

  /**
   * Schedule a local notification.
   * Silently no-ops on web or if permission is denied.
   */
  async schedule(payload: NotificationPayload): Promise<void> {
    if (!isCapacitorNative() && !isTauriNative()) return;

    const permitted = await checkAndRequestPermission();
    if (!permitted) return;

    // Ensure listeners are registered before the first notification
    await ensureListeners();

    if (isCapacitorNative()) {
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        await LocalNotifications.schedule({
          notifications: [
            {
              id: payload.id,
              title: payload.title,
              body: payload.body,
              extra: { actionUrl: payload.actionUrl },
              threadIdentifier: payload.group,                    // iOS grouping
              channelId: payload.group ?? 'default',              // Android channel
              schedule: payload.scheduledAt
                ? { at: new Date(payload.scheduledAt) }
                : undefined,
            },
          ],
        });
      } catch {
        // ignore scheduling errors silently
      }
      return;
    }

    if (isTauriNative()) {
      try {
        const { sendNotification } = await import('@tauri-apps/plugin-notification');
        // Store actionUrl keyed by id for tap-handler lookup
        tauriActionUrlMap.set(String(payload.id), payload.actionUrl);
        await sendNotification({
          title: payload.title,
          body: payload.body,
        });
      } catch {
        // ignore
      }
    }
  },
};

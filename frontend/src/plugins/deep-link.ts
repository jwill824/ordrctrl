/**
 * Deep Link Handler — ordrctrl:// scheme
 *
 * Handles custom URL scheme events on:
 *  - Capacitor (iOS / Android): @capacitor/app  `appUrlOpen` + `getLaunchUrl()`
 *  - Tauri (macOS / Windows):   @tauri-apps/plugin-deep-link `onOpenUrl`
 *
 * Supported paths:
 *  - /auth/callback       → success: navigate to /  |  error: navigate to /login?error=<code>
 *  - /auth/reset-password → navigate to /reset-password?token=<token>
 *  - /feed                → navigate to /feed
 *  - /inbox               → navigate to /inbox
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeepLinkEvent {
  url: string;
  source: 'capacitor' | 'tauri';
}

export interface ParsedDeepLink {
  /** Pathname portion, e.g. "/auth/callback" */
  path: string;
  /** Query parameters as key-value map */
  params: Record<string, string>;
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
// URL parser
// ---------------------------------------------------------------------------

/**
 * Parse an `ordrctrl://` URL into a structured `ParsedDeepLink`.
 * Returns `null` if the URL is not a valid `ordrctrl://` URL.
 */
export function parseDeepLink(url: string): ParsedDeepLink | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'ordrctrl:') return null;

    // URL("ordrctrl://auth/callback") → host="auth", pathname="/callback"
    // We want path to be "/auth/callback"
    const path = '/' + parsed.hostname + (parsed.pathname !== '/' ? parsed.pathname : '');
    const params: Record<string, string> = {};
    parsed.searchParams.forEach((value, key) => {
      params[key] = value;
    });

    return { path, params };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Navigation callback
// ---------------------------------------------------------------------------

type NavigateCallback = (route: string) => void;
let _navigate: NavigateCallback | null = null;

/** Register the React Router navigate function for deep-link routing. */
export function registerDeepLinkNavigationCallback(cb: NavigateCallback): void {
  _navigate = cb;
}

// ---------------------------------------------------------------------------
// Route resolver
// ---------------------------------------------------------------------------

function resolveRoute(link: ParsedDeepLink): string | null {
  const { path, params } = link;

  if (path === '/auth/callback') {
    if (params.status === 'success') {
      return params.next === 'onboarding' ? '/onboarding' : '/';
    }
    if (params.status === 'error') {
      const errorCode = params.error ?? 'unknown';
      return `/login?error=${encodeURIComponent(errorCode)}`;
    }
    // Fallback — navigate home
    return '/';
  }

  if (path === '/auth/reset-password') {
    const token = params.token;
    if (!token) return null;
    return `/reset-password?token=${encodeURIComponent(token)}`;
  }

  if (path === '/feed') return '/feed';
  if (path === '/inbox') return '/inbox';

  return null;
}

function handleUrl(url: string): void {
  const link = parseDeepLink(url);
  if (!link) return;
  const route = resolveRoute(link);
  if (route && _navigate) {
    _navigate(route);
  }
}

// ---------------------------------------------------------------------------
// DeepLinkHandler — initialise listeners
// ---------------------------------------------------------------------------

let _initialized = false;

export const DeepLinkHandler = {
  /**
   * Initialize deep-link listeners.
   * Call once after registering the navigation callback.
   * The `isDesktop` flag should come from `usePlatform().isDesktop`.
   */
  async init(isDesktop: boolean): Promise<void> {
    if (_initialized) return;
    _initialized = true;

    // ---- Capacitor ----
    if (isCapacitorNative()) {
      try {
        const { App } = await import('@capacitor/app');

        // Cold-start: app was launched via deep link while closed
        const launchUrl = await App.getLaunchUrl();
        if (launchUrl?.url) {
          // Defer slightly so Router is mounted before we navigate
          setTimeout(() => handleUrl(launchUrl.url), 0);
        }

        // Warm-start: app was already running and a deep link opened it
        await App.addListener('appUrlOpen', async (event) => {
          // Close the in-app browser (SFSafariViewController) that was opened for OAuth
          try {
            const { Browser } = await import('@capacitor/browser');
            await Browser.close();
          } catch {
            // Browser may already be closed or not open — ignore
          }
          handleUrl(event.url);
        });
      } catch {
        // Not a Capacitor build — ignore
      }
    }

    // ---- Tauri ----
    if (isTauriNative() && isDesktop) {
      try {
        const { onOpenUrl } = await import('@tauri-apps/plugin-deep-link');
        await onOpenUrl((urls: string[]) => {
          // onOpenUrl fires with an array of URLs
          for (const url of urls) {
            handleUrl(url);
          }
        });
      } catch {
        // Not a Tauri build or plugin unavailable — ignore
      }
    }
  },
};

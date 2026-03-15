/**
 * OAuth URL opener
 *
 * - Web:       navigate the current tab
 * - Capacitor: open SFSafariViewController / Chrome Custom Tab via @capacitor/browser
 *              so Google/Apple can redirect back via `ordrctrl://` deep link.
 *              `?platform=capacitor` signals the backend to redirect to `ordrctrl://`
 *              instead of APP_URL after the OAuth exchange completes.
 * - Tauri:     open system browser via tauri-plugin-opener.
 *              `?platform=tauri` signals the backend similarly.
 */

function isTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof (window as any).__TAURI_INTERNALS__ !== 'undefined'
  );
}

function isCapacitorNative(): boolean {
  return (
    typeof window !== 'undefined' &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof (window as any).Capacitor !== 'undefined' &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Capacitor?.isNativePlatform?.() === true
  );
}

/**
 * Open an OAuth provider URL.
 * Pass `provider` as `'google'` or `'apple'`.
 */
export async function openOAuthUrl(apiUrl: string, provider: 'google' | 'apple'): Promise<void> {
  const base = `${apiUrl}/api/auth/${provider}`;

  if (isCapacitorNative()) {
    // Use SFSafariViewController (iOS) / Chrome Custom Tab (Android).
    // The backend will redirect to ordrctrl://auth/callback when it sees platform=capacitor.
    const url = `${base}?platform=capacitor`;
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
  } else if (isTauri()) {
    const url = `${base}?platform=tauri`;
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(url);
    } catch (err) {
      console.error('[oauth] tauri-plugin-opener failed, falling back to webview navigation', err);
      window.location.href = url;
    }
  } else {
    window.location.href = base;
  }
}


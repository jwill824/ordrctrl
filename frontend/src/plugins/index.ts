/**
 * Native Platform Plugins — index
 *
 * Provides:
 *  - `Platform` union type
 *  - `PlatformContext` interface and React context
 *  - `PlatformContextProvider` component
 *  - `usePlatform()` hook
 *
 * Module re-exports for sub-modules:
 *  - notifications  (NotificationService, NativePreferences)
 *  - deep-link      (DeepLinkHandler)
 */

import React, { createContext, useContext, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Platform =
  | 'web'
  | 'capacitor-ios'
  | 'capacitor-android'
  | 'tauri-macos'
  | 'tauri-windows';

export interface PlatformContext {
  platform: Platform;
  /** true if running inside Capacitor or Tauri */
  isNative: boolean;
  /** true if running inside Capacitor (iOS or Android) */
  isMobile: boolean;
  /** true if running inside Tauri (macOS or Windows) */
  isDesktop: boolean;
  /** Runtime check: false until notification permission is granted */
  supportsNotifications: boolean;
}

// ---------------------------------------------------------------------------
// Detection helpers
// ---------------------------------------------------------------------------

/** Detect whether Capacitor APIs are available */
function hasCapacitor(): boolean {
  return (
    typeof window !== 'undefined' &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof (window as any).Capacitor !== 'undefined' &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Capacitor?.isNativePlatform?.() === true
  );
}

/** Detect whether Tauri APIs are available */
function hasTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof (window as any).__TAURI_INTERNALS__ !== 'undefined'
  );
}

/** Detect the current platform */
async function detectPlatform(): Promise<Platform> {
  if (hasTauri()) {
    try {
      // Dynamically import to avoid bundling Tauri APIs in non-Tauri builds
      const { platform } = await import('@tauri-apps/plugin-os');
      const os = await platform();
      return os === 'windows' ? 'tauri-windows' : 'tauri-macos';
    } catch {
      return 'tauri-macos'; // safe fallback
    }
  }

  if (hasCapacitor()) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cap = (window as any).Capacitor;
      const platformName: string = cap.getPlatform?.() ?? '';
      return platformName === 'android' ? 'capacitor-android' : 'capacitor-ios';
    } catch {
      return 'capacitor-ios'; // safe fallback
    }
  }

  return 'web';
}

function buildContext(platform: Platform): PlatformContext {
  const isMobile = platform === 'capacitor-ios' || platform === 'capacitor-android';
  const isDesktop = platform === 'tauri-macos' || platform === 'tauri-windows';
  return {
    platform,
    isNative: isMobile || isDesktop,
    isMobile,
    isDesktop,
    supportsNotifications: isMobile || isDesktop,
  };
}

// ---------------------------------------------------------------------------
// React context
// ---------------------------------------------------------------------------

const defaultContext: PlatformContext = buildContext('web');

const PlatformCtx = createContext<PlatformContext>(defaultContext);

export function PlatformContextProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [ctx, setCtx] = useState<PlatformContext>(defaultContext);

  useEffect(() => {
    detectPlatform().then((p) => setCtx(buildContext(p)));
  }, []);

  return React.createElement(PlatformCtx.Provider, { value: ctx }, children);
}

/** Hook — consume the current platform context */
export function usePlatform(): PlatformContext {
  return useContext(PlatformCtx);
}

// ---------------------------------------------------------------------------
// Sub-module re-exports
// ---------------------------------------------------------------------------

export * from './notifications';
export * from './deep-link';

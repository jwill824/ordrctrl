# Feature Specification: Native App Targets (Mobile & Desktop)

**Feature Branch**: `015-native-app-targets`
**Created**: 2026-03-14
**Status**: Draft
**Input**: Add mobile integration with Capacitor and desktop integration with Tauri, enabling the existing Vite SPA to be packaged and distributed as native iOS, Android, macOS, and Windows applications

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Install & Use on Mobile (Priority: P1)

A user discovers ordrctrl and wants to use it as a native app on their iPhone or Android device. They install the app, log in, and can access all their tasks, feed, and settings exactly as they do on the web — with the added benefit of a native app experience including home screen icon, full-screen layout, and device-appropriate touch interactions.

**Why this priority**: Mobile is the primary platform for on-the-go task management. Delivering a native mobile app unlocks the largest addressable audience and aligns with the original motivation for the Vite SPA migration.

**Independent Test**: Install the app on a physical or simulated iOS/Android device. Log in, browse the feed, complete a task, and open settings. Delivers full feature parity with the web in a native mobile wrapper.

**Acceptance Scenarios**:

1. **Given** an iOS or Android device, **When** a user installs ordrctrl and opens it, **Then** the app launches full-screen with no browser chrome and all existing features are accessible
2. **Given** a logged-in user on the mobile app, **When** they navigate between feed, inbox, and settings, **Then** all data and interactions behave identically to the web app
3. **Given** the mobile app is closed and reopened, **When** the user had an active session, **Then** they remain logged in and their state is preserved
4. **Given** the mobile app loses internet connectivity, **When** the user attempts to load data, **Then** the app shows a clear offline message and does not crash

---

### User Story 2 — Install & Use on Desktop (Priority: P2)

A user prefers to run ordrctrl as a standalone desktop application on their Mac or Windows PC rather than keeping a browser tab open. They download and install the app, and it behaves like a native desktop application — with its own window, taskbar/dock presence, and system-level integration.

**Why this priority**: Desktop users benefit from persistent access and system tray convenience, extending the product beyond the browser without requiring infrastructure changes.

**Independent Test**: Install the desktop build on macOS or Windows. Log in, use the app, minimize to tray, and restore. Delivers full feature parity with the web in a native desktop wrapper.

**Acceptance Scenarios**:

1. **Given** a macOS or Windows machine, **When** a user installs the ordrctrl desktop app and opens it, **Then** it launches as a native window with no browser chrome and all existing features are accessible
2. **Given** the desktop app is open, **When** a user closes the window, **Then** the app optionally minimizes to the system tray/menu bar and continues running
3. **Given** the app is in the system tray, **When** the user clicks the tray icon, **Then** the app window is restored to focus
4. **Given** a logged-in desktop user, **When** they navigate and use the app, **Then** all interactions behave identically to the web app

---

### User Story 3 — Native Notifications (Priority: P3)

A user wants to be notified on their device when they have new items in their feed or upcoming tasks, even when the app is not in the foreground. The native app delivers timely alerts through the device's standard notification system.

**Why this priority**: Notifications significantly increase user engagement and utility of a native app, but require platform-specific infrastructure and user permission flows that make this distinct from core app packaging.

**Independent Test**: Grant notification permissions, trigger a notification-worthy event (new feed item arrives or task is due), and verify a notification appears in the device notification center without the app being open.

**Acceptance Scenarios**:

1. **Given** the app is installed and the user has granted notification permission, **When** a new item arrives in the feed, **Then** a notification appears in the device notification center
2. **Given** the user has not granted notification permission, **When** the app is first launched, **Then** the app requests permission using the platform's native permission dialog
3. **Given** a user taps a notification on mobile or clicks one on desktop, **When** the app opens, **Then** it navigates directly to the relevant item or feed view
4. **Given** the user has denied notification permission, **When** they later want to enable notifications, **Then** the app provides a clear path to system settings to re-enable them

---

### Edge Cases

- What happens when the device OS version is below the minimum supported version for the native runtime?
- How does the app behave when the user switches accounts mid-session on mobile?
- What happens if an app store update is available but the user is on an older version — do they see a prompt?
- How are OAuth login redirects (Apple Sign In, Google) handled when the native app intercepts the deep link?
- What happens when the user installs both the web app (PWA-style) and native app simultaneously?
- How does the desktop app handle multiple windows or being launched a second time when already running?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to install and launch ordrctrl as a native application on iOS (14+) and Android (10+) devices
- **FR-002**: Users MUST be able to install and launch ordrctrl as a native application on macOS (11+) and Windows (10+)
- **FR-003**: All features available in the web application MUST be fully functional in both the mobile and desktop native apps with no regressions
- **FR-004**: Users MUST be able to log in, register, and complete OAuth flows (Apple Sign In, Google) from within the native apps
- **FR-005**: Native mobile apps MUST request and respect the device's notification permission when delivering alerts
- **FR-006**: Native apps MUST deliver local notifications on-device for new feed items and task reminders. Server-side push notifications are explicitly out of scope for this feature and will be addressed in a separate future spec.
- **FR-007**: Users MUST be able to tap a notification and be navigated directly to the relevant content within the app
- **FR-008**: The desktop app MUST support minimizing to the system tray (Windows) and menu bar (macOS) instead of quitting when the window is closed
- **FR-009**: Native apps MUST persist user sessions across app restarts, so users do not need to log in on every launch
- **FR-010**: Native apps MUST handle loss of network connectivity gracefully, showing a user-friendly offline state rather than crashing or showing a blank screen
- **FR-011**: OAuth redirect flows MUST work correctly in the native app context, returning the authenticated user to the app after completing login with a third-party provider
- **FR-012**: Native app builds MUST be distributable via internal testing channels (TestFlight for iOS, internal track for Android, direct installer for macOS and Windows). Public app store submissions are explicitly out of scope for this feature and will be addressed as a follow-on task.

### Key Entities

- **Native App Build**: A packaged binary for a specific platform (iOS, Android, macOS, Windows) derived from the Vite SPA source. Has a platform, version number, and minimum OS requirement.
- **Deep Link**: A URL scheme registered with the OS that routes external links (from emails, notifications, or other apps) to a specific view inside the native app.
- **Notification**: A system-delivered alert shown in the device notification center. Has a title, body, an associated action (navigate to view), and a delivery trigger.
- **Session Token**: A persisted credential stored securely in native device storage that maintains the user's authenticated state across app launches.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The native apps launch and reach a usable state in under 3 seconds on a mid-range device (defined as a device released within the last 4 years)
- **SC-002**: 100% of user-facing features available on the web work without functional regression in the mobile and desktop native apps
- **SC-003**: Users can complete the full login flow (including OAuth) within the native app in under 60 seconds
- **SC-004**: Notifications are delivered to the device within 10 seconds of the triggering event
- **SC-005**: The app correctly handles the offline state with no crashes — verified by disabling network access and using all primary navigation flows
- **SC-006**: Native app builds pass the automated pre-submission validation checks for their respective distribution platforms with zero blocking errors
- **SC-007**: Session state persists across 100% of app restarts in normal operating conditions (no manual logout, no OS session termination)

## Assumptions

- The Vite SPA migration (spec 014) is complete and merged — the `dist/` output already uses relative asset paths (`./assets/...`), which is a prerequisite for Capacitor and Tauri to serve the app correctly
- The existing web authentication flows (email/password, Apple Sign In) will work within native webview contexts with appropriate redirect URL configuration
- Backend API endpoints do not require changes for native app support; the app communicates over the same HTTPS API as the web client
- iOS and Android developer accounts are available or will be set up as part of this feature
- Notification infrastructure (server-side push notification delivery) is scoped to be decided based on the clarification above; local scheduled notifications are in scope regardless
- Desktop app will target a single window per instance (no multi-window support in initial release)


# Feature Specification: Native App Auth Fixes

**Feature Branch**: `016-native-auth-fixes`
**Created**: 2026-03-15
**Status**: Complete
**Closes**: [#53](https://github.com/jwill824/ordrctrl/issues/53), [#54](https://github.com/jwill824/ordrctrl/issues/54), [#55](https://github.com/jwill824/ordrctrl/issues/55)
**Input**: Fix native app authentication: resolve iOS simulator auth callback not returning (closes #53), fix Apple Sign In provider returning error (closes #54), and add ngrok tunneling support for physical device testing (closes #55)

## Overview

ordrctrl's native app (spec 015) requires working authentication flows on both simulated and physical devices before it can be tested or distributed. Three related issues are blocking this:

1. The iOS simulator does not return to the app after an OAuth callback — the auth flow starts but never completes (#53)
2. The Apple Sign In provider returns an error when invoked from the native app context (#54)
3. Physical iOS and Android devices cannot reach the local development backend because it is not publicly addressable — ngrok provides an HTTPS tunnel to solve this (#55)

These three issues share the same root cause area (auth callback routing in native contexts) and the same fix surface (deep link configuration, OAuth redirect handling, and local backend reachability), making them a natural unit of work.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Apple Sign In Works on iOS Simulator (Priority: P1)

A developer building or testing the native app opens the app on the iOS simulator, taps "Sign in with Apple," completes the Apple ID prompt, and is returned to the app as an authenticated user. Currently this flow either errors immediately (#54) or stalls after the Apple ID prompt without returning (#53). Both behaviors must be resolved so the full auth flow completes successfully in the simulator.

**Why this priority**: Apple Sign In is the primary authentication path for iOS users and a prerequisite for any meaningful simulator testing of the native app. Until this works, no authenticated feature can be tested on simulator.

**Independent Test**: Launch the native app in the iOS simulator. Tap "Sign in with Apple," complete the Apple ID credential prompt, and confirm the app navigates to the authenticated home screen. Delivers a working end-to-end auth flow on simulator.

**Acceptance Scenarios**:

1. **Given** the native app is open in the iOS simulator, **When** the user taps "Sign in with Apple," **Then** the Apple authentication prompt appears without an error
2. **Given** the Apple ID prompt is displayed, **When** the user completes authentication, **Then** the native app receives the callback and navigates to the authenticated feed view
3. **Given** the user has already signed in and restarts the app, **When** the app launches, **Then** the session is restored without prompting for authentication again
4. **Given** the user cancels the Apple ID prompt, **When** they return to the app, **Then** the app returns to the sign-in screen with no crash or stuck state

---

### User Story 2 — Authentication Works on Physical Devices via ngrok (Priority: P2)

A developer wants to test the native app on a real iPhone or Android device connected to the same development machine. Currently, the app running on a physical device cannot reach the local backend server because it is only accessible on localhost. With ngrok configured, the app can be pointed at the ngrok HTTPS URL, allowing full end-to-end testing — including auth callbacks — on real hardware.

**Why this priority**: Physical device testing is the only way to validate hardware-specific behaviors (biometrics, camera, native auth dialogs, network conditions) that simulators cannot replicate. This is essential before TestFlight or internal distribution.

**Independent Test**: Connect a physical iOS or Android device to the development machine. Start the ngrok tunnel and point the native app at the ngrok URL. Sign in using Apple Sign In or email/password and confirm the app authenticates successfully on the physical device.

**Acceptance Scenarios**:

1. **Given** a physical device connected to the same network as the development machine, **When** the developer starts the ngrok tunnel, **Then** a stable public HTTPS URL is available that proxies to the local backend
2. **Given** the native app is configured to use the ngrok URL as its backend, **When** the user initiates any auth flow on a physical device, **Then** the request reaches the local backend and the auth response is returned correctly
3. **Given** the ngrok tunnel is running, **When** an OAuth callback URL is triggered (e.g., after Apple Sign In), **Then** the callback successfully reaches the app on the physical device
4. **Given** a developer restarts the ngrok tunnel and gets a new URL, **When** they update the app's backend URL configuration, **Then** the app reconnects without requiring a full rebuild

---

### Edge Cases

- What happens when the Apple Sign In callback URL is intercepted by the browser instead of the native app? The deep link scheme must take precedence.
- What happens when the ngrok tunnel expires or disconnects mid-session? The app should show a network error, not crash or leave the user in a broken auth state.
- What happens when the iOS simulator does not have an Apple ID configured? The app should show an appropriate error rather than silently failing.
- What happens when the OAuth callback arrives while the app is backgrounded on a physical device?
- What happens if the developer forgets to update the ngrok URL after a tunnel restart — is there a clear error message pointing to a misconfiguration?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The native app MUST successfully complete the Apple Sign In authentication flow on the iOS simulator, returning the authenticated user to the app after the credential prompt is accepted
- **FR-002**: The Apple Sign In provider MUST NOT return an error when invoked from the native app context; any provider errors must surface to the user as a clear, actionable message
- **FR-003**: The native app MUST handle the OAuth callback deep link correctly on the iOS simulator, routing the user back to the authenticated app state after the external auth provider completes
- **FR-004**: The development environment MUST support an ngrok tunnel that exposes the local backend over a public HTTPS URL for physical device testing
- **FR-005**: The ngrok tunnel URL MUST be configurable in the native app's environment without requiring a full app rebuild (e.g., via a local environment variable or config override)
- **FR-006**: OAuth callback URLs registered with authentication providers MUST include or accommodate the ngrok tunnel URL so callbacks route correctly during physical device testing
- **FR-007**: The native app MUST handle the physical device auth callback correctly when routed through the ngrok tunnel, completing the login flow identically to the simulator flow
- **FR-008**: The development setup documentation MUST be updated to include ngrok tunnel setup steps so any developer can reproduce the physical device testing environment

### Key Entities

- **Auth Callback**: The redirect that an external provider (Apple Sign In) sends back to the app after authentication. In native contexts, this must be received by the app via a registered deep link scheme rather than a browser URL.
- **Deep Link Scheme**: A URL pattern registered with the OS that routes external callbacks into the native app. Must be configured correctly for both simulator and physical device contexts.
- **ngrok Tunnel**: A temporary public HTTPS URL that proxies traffic to the local development backend. Enables physical devices to reach a backend running on the developer's machine without network exposure.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Apple Sign In completes successfully on the iOS simulator in 100% of attempts under normal conditions (Apple ID configured, network available)
- **SC-002**: Zero unhandled errors surface to the user during the Apple Sign In flow on simulator or physical device — all error states show a clear, readable message
- **SC-003**: A developer can start the ngrok tunnel and successfully authenticate on a physical device within 5 minutes of following the documented setup steps
- **SC-004**: OAuth callbacks route correctly to the native app on both simulator and physical device — verified by completing the full login flow end-to-end on each environment
- **SC-005**: Session persistence works correctly after a successful auth on physical device — the user remains logged in after closing and reopening the app

## Assumptions

- The native app build system (Capacitor) is already set up as part of spec 015; this spec only addresses auth routing and local dev reachability, not the Capacitor setup itself
- Apple developer account and associated Sign In with Apple entitlements are already configured or will be configured as part of spec 015
- The backend auth endpoints are unchanged; only the redirect URL and deep link configuration need adjustment for native contexts
- ngrok is used only for local development and testing — production and TestFlight builds will use the real backend URL, not a tunnel
- A single ngrok tunnel instance per developer machine is sufficient; multi-developer shared tunnels are out of scope

## Dependencies

- **Prerequisite**: `015-native-app-targets` — Capacitor must be installed and the app must be buildable as a native app before auth flows can be tested
- **Prerequisite**: Apple Sign In configuration from `004-apple-basic-auth`

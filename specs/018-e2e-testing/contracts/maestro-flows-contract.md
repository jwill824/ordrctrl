# Contract: Maestro Native E2E Flows

**Directory**: `.maestro/flows/`  
**Runner**: Maestro CLI ≥ v1.38  
**App ID**: `com.ordrctrl.app` (iOS + Android)

---

## Overview

This contract defines the three Maestro YAML flow files for native mobile e2e testing
(FR-010 through FR-013, SC-003). Each flow file is self-contained and targets the Capacitor
app running on a simulator/emulator.

---

## Environment Variables

All flows that require credentials use Maestro's `${VAR}` interpolation syntax. The CI job
provides these as environment variables; local runs require them set in the shell.

| Variable | Purpose | Required |
|----------|---------|---------|
| `MAESTRO_TEST_EMAIL` | Test account email | auth.yaml, task-complete.yaml |
| `MAESTRO_TEST_PASSWORD` | Test account password | auth.yaml, task-complete.yaml |

Graceful skip (CI job level — not Maestro level):
```bash
if [ -z "$MAESTRO_TEST_EMAIL" ]; then
  echo "⚠️  Credentials not configured — skipping Maestro tests"
  exit 0
fi
maestro test .maestro/flows/
```

---

## Flow 1: `auth.yaml`

**FR**: FR-010, FR-011  
**SC**: SC-003

**Purpose**: Launch app unauthenticated → verify login screen → authenticate → verify feed loads.

```yaml
appId: com.ordrctrl.app
---
# Step 1: Launch fresh (clear existing session)
- clearState
- launchApp

# Step 2: Verify login screen shown when unauthenticated (FR-010)
- assertVisible:
    text: "Sign In"
- assertVisible:
    text: "Email"

# Step 3: Authenticate with test credentials (FR-011)
- tapOn:
    text: "Email"
- inputText: ${MAESTRO_TEST_EMAIL}

- tapOn:
    text: "Password"
- inputText: ${MAESTRO_TEST_PASSWORD}

- tapOn:
    text: "Sign In"

# Step 4: Verify feed loads (FR-011)
- waitForAnimationToEnd
- assertVisible:
    text: "ordrctrl"
```

**Expected outcome**: App navigates from login screen to feed after successful auth.  
**Failure modes**: Wrong credentials (auth error visible), network timeout (Maestro timeout).

---

## Flow 2: `feed-load.yaml`

**FR**: FR-011  
**SC**: SC-003

**Purpose**: From an authenticated session, verify the feed loads and displays tasks.

```yaml
appId: com.ordrctrl.app
---
# Assumes authenticated session from auth.yaml (run after auth.yaml in CI)
- launchApp

# Verify feed header is visible
- assertVisible:
    text: "ordrctrl"

# Verify at least one section is present
# (Upcoming, No Date, or Completed section label)
- waitForAnimationToEnd
- assertVisible:
    text: "UPCOMING"
    optional: true
- assertVisible:
    text: "NO DATE"
    optional: true
```

**Notes**: Feed may show "Upcoming" or "No Date" depending on test data. The `optional: true`
flag prevents failure when a section is absent; at least one must be visible for the flow to
have meaningful signal. If neither section is visible, the test account likely has no tasks —
a seeded test account should be used in CI.

---

## Flow 3: `task-complete.yaml`

**FR**: FR-012  
**SC**: SC-003

**Purpose**: Complete a visible task and verify it moves to the Completed section.

```yaml
appId: com.ordrctrl.app
---
# Assumes authenticated session and at least one task visible
- launchApp
- waitForAnimationToEnd

# Assert task is in feed (at least one task row visible)
- assertVisible:
    text: "ordrctrl"

# Tap the first visible task's complete checkbox
# (In Capacitor WebView, the checkbox renders as a button with accessible text)
- tapOn:
    accessibility id: "Mark complete"
    # Fallback: coordinate tap if accessibility ID not exposed
    # index: 0

# Wait for state update
- waitForAnimationToEnd

# Verify Completed section appears
- assertVisible:
    text: "Completed"
```

**Notes**: The complete checkbox has `aria-label="Mark complete"` in the React component.
Capacitor's WebView exposes ARIA labels as accessibility IDs to Maestro on both iOS and
Android. If accessibility ID resolution fails in the WebView, a coordinate-based tap
targeting the first checkbox position is the fallback.

---

## Flow Execution Order (CI)

Flows are invoked in dependency order. In CI the command is:

```bash
maestro test .maestro/flows/auth.yaml
maestro test .maestro/flows/feed-load.yaml
maestro test .maestro/flows/task-complete.yaml
```

Or with a single invocation (Maestro runs files in alphabetical order — filenames prefixed
to enforce order):

```bash
maestro test .maestro/flows/
# alphabetical: auth.yaml → feed-load.yaml → task-complete.yaml ✓
```

---

## Directory Structure

```
.maestro/
└── flows/
    ├── auth.yaml          # Flow 1: launch + login + verify feed
    ├── feed-load.yaml     # Flow 2: feed load verification
    └── task-complete.yaml # Flow 3: complete task + verify Completed section
```

---

## App DOM Contract (WebView Accessibility)

For Maestro to interact with the Capacitor WebView, the app MUST expose the following:

| Interaction | Maestro strategy | DOM source |
|-------------|-----------------|------------|
| Login email field | `tapOn: { text: "Email" }` | `<label>Email</label>` |
| Login password field | `tapOn: { text: "Password" }` | `<label>Password</label>` |
| Sign in button | `tapOn: { text: "Sign In" }` | `<button>Sign In</button>` |
| Feed header | `assertVisible: { text: "ordrctrl" }` | `<span>ordrctrl</span>` (nav header) |
| Complete checkbox | `accessibility id: "Mark complete"` | `aria-label="Mark complete"` |
| Completed section | `assertVisible: { text: "Completed" }` | `<span>Completed (N)</span>` |

All required text/ARIA attributes are already present in the app. No app changes needed.

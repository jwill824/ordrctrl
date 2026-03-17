# Contract: Playwright Feed Tests

**File**: `frontend/tests/e2e/feed.spec.ts`  
**Runner**: Playwright 1.42, Chromium  
**Invocation**: `pnpm --filter frontend test:e2e`

---

## Overview

This contract defines the test cases, ARIA/DOM selectors, preconditions, and expected outcomes
for the new `feed.spec.ts` test file. It is the authoritative description of what the tests
must cover (FR-001, FR-002, SC-001) and the DOM contract the app must fulfil for them to pass.

---

## Preconditions

All feed interaction tests require an authenticated session. The describe block applies a global
skip when `E2E_SESSION_COOKIE` is absent:

```typescript
test.describe('Feed interactions — authenticated', () => {
  test.skip(
    !process.env.E2E_SESSION_COOKIE,
    'E2E_SESSION_COOKIE not set — skipping authenticated feed tests'
  );

  test.beforeEach(async ({ context }) => {
    await context.addCookies([{
      name: 'sessionId',
      value: process.env.E2E_SESSION_COOKIE!,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
    }]);
  });
});
```

---

## Test Cases

### TC-F01: Tasks visible in feed sections

**FR**: FR-001 (view)  
**SC**: SC-001

```
Given  an authenticated user with tasks in their feed
When   the user navigates to /feed
Then   the "UPCOMING" section header OR "NO DATE" section header is visible
And    at least one task item is rendered in the feed
```

**Selectors used**:
- Section label: `text=/upcoming/i` or `text=/no date/i` (case-insensitive)
- Task row: `[aria-label="Mark complete"]` (at least one present)

---

### TC-F02: Complete a task

**FR**: FR-001 (complete)  
**SC**: SC-001

```
Given  a visible task in the feed
When   the user clicks the task's complete checkbox (aria-label="Mark complete")
Then   the task moves to the "Completed" section
And    the task title has line-through styling
And    the "Completed (N)" toggle button is visible
```

**Selectors used**:
- Complete button: `[aria-label="Mark complete"]` (first visible)
- Post-complete verification: `button:has-text("Completed")`

**Notes**: The CompletedSection is collapsed by default; the toggle button becoming visible is
sufficient to assert the task was moved. Tests do NOT need to expand the section.

---

### TC-F03: Dismiss a task

**FR**: FR-001 (dismiss)  
**SC**: SC-001

```
Given  a visible task in the feed
When   the user hovers the task item
And    the user clicks the dismiss button (aria-label="Dismiss item")
Then   the task disappears from the main feed
```

**Selectors used**:
- Task container: first `[aria-label="Mark complete"]` parent row
- Dismiss button: `[aria-label="Dismiss item"]` (opacity-0; requires `.hover()` first)

**Critical**: Must call `await taskRow.hover()` before asserting/clicking the dismiss button.
The button has `opacity-0 group-hover:opacity-100` and is not interactable without hover.

---

### TC-F04: Restore a dismissed task

**FR**: FR-001 (restore)  
**SC**: SC-001

```
Given  a task has been dismissed
When   the user navigates to /feed?showDismissed=true
Then   the "Dismissed" section header is visible
And    the dismissed task is shown
When   the user clicks the "Restore" button (aria-label="Restore item")
Then   the task disappears from the dismissed view
When   the user navigates back to /feed
Then   the task is visible in the main feed again
```

**Selectors used**:
- Dismissed header: `text=/dismissed/i`
- Restore button: `[aria-label="Restore item"]`

**Notes**: The test may dismiss a task in the same run (TC-F03 → TC-F04 sequential) OR can
be written as independent tests if test isolation is preferred. The contract allows either
approach; the implementation must choose one and document it.

---

### TC-F05: Rename a task (title override)

**FR**: FR-002  
**SC**: SC-001

```
Given  a visible task in the feed
When   the user clicks the task's content area
Then   the EditTaskModal opens (input#edit-title is visible)
When   the user clears the title field and types "Custom Title"
And    the user clicks the Save button
Then   the modal closes
And    the task displays "Custom Title" in the feed
And    the original title is displayed as secondary text below it
```

**Selectors used**:
- Task content (click target): `.cursor-pointer` div or first task row content
- Title input: `#edit-title`
- Save button: `button:has-text("Save")` inside the modal
- Modal close detection: `input#edit-title` becomes non-visible

**Notes**: The `originalTitle` is only shown when a `titleOverride` is set on a sync-backed
item (`serviceId !== 'ordrctrl'`). Tests must use a sync-backed task for this assertion.
Native tasks (serviceId === 'ordrctrl') do not show secondary original title text.

---

## App DOM Contract

For the tests above to pass, the app MUST expose the following DOM contract:

| Element | Required ARIA / attribute | Current status |
|---------|--------------------------|----------------|
| Complete checkbox | `aria-label="Mark complete"` | ✅ Present (FeedItem.tsx:84) |
| Reopen checkbox | `aria-label="Reopen task"` | ✅ Present (FeedItem.tsx:84) |
| Dismiss button | `aria-label="Dismiss item"` | ✅ Present (FeedItem.tsx:64) |
| Restore button | `aria-label="Restore item"` | ✅ Present (FeedItem.tsx:172) |
| Clear completed | `aria-label="Clear all completed tasks"` | ✅ Present (CompletedSection.tsx:30) |
| Title input | `id="edit-title"` | ✅ Present (EditTaskModal.tsx:127) |
| Close modal | `aria-label="Close"` | ✅ Present (EditTaskModal.tsx:113) |

All required ARIA attributes are already present. No DOM changes needed to support these tests.

---

## File Location & Script

```
frontend/tests/e2e/feed.spec.ts
```

Run locally:
```bash
cd frontend
E2E_SESSION_COOKIE=<token> pnpm test:e2e --grep "Feed interactions"
```

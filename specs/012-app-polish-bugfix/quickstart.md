# Quickstart: App Polish & Bug Fix Bundle

**Branch**: `012-app-polish-bugfix`  
**Phase**: 1 — Design & Contracts  
**Generated**: 2025-07-24

---

## What This Bundle Fixes

| Issue | Summary | Files Changed |
|-------|---------|---------------|
| **#45** Manual Refresh Bug | `useFeed` polling loop hardcodes `showDismissed: false`, causing dismissed items to flicker during refresh | `frontend/src/hooks/useFeed.ts` |
| **#41** Menu Cleanup | Navigation menu items verified; stale `/settings/dismissed` route requires a `next.config.js` redirect | `frontend/next.config.js` |
| **#40** Dead Code Removal | `getDismissedItems()`, `DismissedItem`, `DismissedItemsResponse`, and `/settings/dismissed/page.tsx` removed | `frontend/src/services/feed.service.ts`, `frontend/src/app/settings/dismissed/page.tsx`, `frontend/tests/unit/services/feed.service.test.ts` |

---

## Development Setup

```bash
# From repo root
pnpm install

# Start backend (PostgreSQL + Redis must be running)
cd backend && pnpm dev

# Start frontend
cd frontend && pnpm dev
```

---

## Issue #45: Manual Refresh Fix

### The One-Line Change

In `frontend/src/hooks/useFeed.ts`, find the polling loop inside `refresh()` and change:

```typescript
// BEFORE (broken) — hardcodes showDismissed: false, omits includeCompleted
const feed = await feedService.fetchFeed({ showDismissed: false });
```

```typescript
// AFTER (fixed) — forwards hook options, matches reloadFeed() behaviour
const feed = await feedService.fetchFeed({ includeCompleted: true, showDismissed });
```

`showDismissed` is already in scope — it comes from the `useFeed` options passed by
the calling page component (e.g., `useFeed({ showDismissed: searchParams.showDismissed === 'true' })`).

### Optional UX Improvement (FR-005)

If the polling loop exhausts the 30 s deadline without sync completing, surface a
non-blocking error notice rather than falling through silently:

```typescript
// After the while loop, before reloadFeed():
if (Date.now() >= deadline) {
  setError('Sync is taking longer than expected. Showing latest available data.');
}
await reloadFeed();
```

### Verifying the Fix Manually

1. Open the app at `http://localhost:3000/feed?showDismissed=true`
2. Confirm dismissed items are visible
3. Connect at least one integration (Gmail or Apple Reminders)
4. Trigger a new task in the integration (e.g., flag an email)
5. Click the refresh button in the feed toolbar
6. **Expected**: Dismissed items remain visible throughout polling; new task appears after sync completes
7. **Was broken**: Dismissed items disappeared during polling and reappeared only after ~30 s

### Running the Tests

```bash
cd frontend
pnpm test tests/unit/hooks/useFeed.test.ts
```

Key test cases to add (see tasks.md for full task breakdown):
- `refresh() with showDismissed:true should pass showDismissed:true to fetchFeed during polling`
- `refresh() with showDismissed:false should pass showDismissed:false to fetchFeed during polling`
- `refresh() should include includeCompleted:true in polling calls`

---

## Issue #41: Navigation Menu Verification

### What Was Found

The `AccountMenu` is already correct:

| Menu Item | Route | Verdict |
|-----------|-------|---------|
| Inbox | `/inbox` | ✅ Current |
| Integrations | `/settings/integrations` | ✅ Current |
| Feed preferences | `/settings/feed` | ✅ Current |
| Dismissed items | `/feed?showDismissed=true` | ✅ Correct inline link |
| Sign out | action | ✅ N/A |

**No triage entries** — removed in 010/011.  
**No standalone dismissed page entry** — AccountMenu already uses the correct query-param URL.

### Required Change: next.config.js Redirect

The `/settings/dismissed` page currently exists only as a redirect page. Once that page
is deleted (issue #40), add a permanent redirect in `next.config.js` so any bookmarked
URL continues to resolve:

```js
// next.config.js
const nextConfig = {
  // ... existing config ...
  async redirects() {
    return [
      {
        source: '/settings/dismissed',
        destination: '/feed?showDismissed=true',
        permanent: true,   // 308 Permanent Redirect
      },
    ];
  },
};
```

### Verifying Menu Cleanup

1. Open the app and click through every menu item in AccountMenu
2. Confirm each navigates to a working page
3. Visit `http://localhost:3000/settings/dismissed` directly
4. **Expected**: Redirected to `/feed?showDismissed=true` (308)
5. Confirm no triage-related routes exist: `grep -r "triage" frontend/src` → zero results

---

## Issue #40: Dead Code Removal

### Files to Delete

```bash
# Remove the redirect-only settings page
rm frontend/src/app/settings/dismissed/page.tsx
# (if settings/dismissed/ directory is now empty, remove it too)
rmdir frontend/src/app/settings/dismissed/
```

### Code to Remove from feed.service.ts

Remove these lines from `frontend/src/services/feed.service.ts`:

1. `DismissedItem` interface (~line 35)
2. `DismissedItemsResponse` interface (~line 43)
3. `getDismissedItems()` function (~lines 109–120)
4. Any import of these that exists elsewhere

### Test File Cleanup

Remove the `getDismissedItems` test block from:
`frontend/tests/unit/services/feed.service.test.ts`

### Verifying Dead Code Removal

```bash
cd frontend

# 1. Build must succeed with zero errors
pnpm build

# 2. No remaining references to removed symbols
grep -r "getDismissedItems\|DismissedItem\|DismissedItemsResponse" src/
# Expected: zero results

# 3. No remaining reference to the deleted route from within src/
grep -r "settings/dismissed" src/
# Expected: zero results (next.config.js is outside src/ — that's fine)

# 4. Run full test suite
pnpm test
# Expected: all passing, no failures from removed test coverage
```

---

## Full Regression Check

After all three issues are addressed, run this sequence:

```bash
# Frontend
cd frontend
pnpm build          # Zero errors
pnpm test           # All tests pass

# Backend (unchanged, but smoke-test)
cd ../backend
pnpm test           # All tests still pass

# Manual smoke test
# 1. Start dev servers
# 2. Visit /feed — feed loads
# 3. Visit /inbox — inbox loads with badge count
# 4. Visit /feed?showDismissed=true — dismissed items visible
# 5. Click refresh on /feed?showDismissed=true — no flicker, items persist
# 6. Visit /settings/dismissed — redirects to /feed?showDismissed=true
# 7. Verify AccountMenu items all navigate correctly
```

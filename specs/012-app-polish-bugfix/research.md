# Research: App Polish & Bug Fix Bundle

**Branch**: `012-app-polish-bugfix`  
**Phase**: 0 — Outline & Research  
**Generated**: 2025-07-24  
**Resolves**: All NEEDS CLARIFICATION items from Technical Context

---

## 1. Manual Refresh Bug Root Cause (#45)

### Decision
Fix the **inbox** refresh button to trigger a sync before reloading — the button was only
re-fetching already-cached inbox data and never calling `triggerSync`.

Additionally (secondary fix applied during initial implementation): fix the `useFeed`
polling loop to forward the hook's `showDismissed`/`includeCompleted` options rather than
hardcoding `showDismissed: false`.

### Root Cause (Confirmed via Code Inspection + Runtime Reproduction)

#### Primary Bug — `useInbox.ts` / `InboxPage.tsx`

The inbox "↻ Refresh" button called `reload()` from `useInbox`, which only hits
`GET /api/inbox` to re-read items **already in the database**. It never called
`feedService.triggerSync()` (`POST /api/integrations/sync`).

**Consequence**: Clicking refresh in the inbox after adding a task in Microsoft To Do (or
any integration) showed no change — the new task was never fetched from the external service.
The button was effectively a no-op for surfacing new integration data.

**Fix**: Added `refresh()` + `refreshing` state to `useInbox`:
1. Calls `feedService.triggerSync()`.
2. Polls `fetchInbox()` every 2 s for up to 30 s, watching for inbox `total` to change.
3. Final reload regardless of whether count changed (handles silent new-item-with-same-count edge cases).

Updated `InboxPage.tsx` refresh button to call `refresh()` instead of `reload()`, with
disabled state and "↻ Syncing…" label while in progress.

**Files changed**: `frontend/src/hooks/useInbox.ts`, `frontend/src/components/inbox/InboxPage.tsx`

#### Secondary Bug — `useFeed.ts` polling loop

The `refresh()` function in `useFeed` was also found to hardcode `{ showDismissed: false }`
in its inner polling `fetchFeed` calls, causing dismissed items to flicker out during a feed
refresh cycle before `reloadFeed()` restored them.

**Fix**: Changed polling calls to forward `{ includeCompleted: true, showDismissed }` from
the hook's own options. Also added a timeout error notice when polling exhausts 30 s.

**File changed**: `frontend/src/hooks/useFeed.ts`

### Alternatives Considered

| Option | Verdict | Reason Rejected |
|--------|---------|-----------------|
| Remove polling loop; switch to server-sent events or WebSocket | Out of scope | Architectural change; spec scopes fix to the existing pipeline |
| Re-trigger full page load after sync | Rejected by spec | FR-001 explicitly forbids requiring a browser reload |
| Debounce rapid refresh clicks | Already solved | Button is `disabled={refreshing}` — no duplicate calls possible |

### Backend Unchanged

`POST /api/integrations/sync` returns 202 and queues jobs to BullMQ — this is correct
async behaviour. No backend changes needed.

---

## 2. Navigation Menu Scope (#41)

### Decision
The AccountMenu is already substantially correct. The only actionable item is the
`/settings/dismissed/page.tsx` redirect route, which is dead code rather than a live menu
entry — removal is categorized under #40 (dead code). No AccountMenu items need to change.

### Current Menu State (AccountMenu.tsx)

| Label | Route | Status |
|-------|-------|--------|
| Inbox | `/inbox` (with badge count) | ✅ Current, functional |
| Integrations | `/settings/integrations` | ✅ Current, functional |
| Feed preferences | `/settings/feed` | ✅ Current, functional |
| Dismissed items | `/feed?showDismissed=true` | ✅ Correct inline link per 011 design |
| Sign out | (action) | ✅ N/A |

**No triage entry** — cleanly removed during feature 010/011.  
**No standalone dismissed page entry** — AccountMenu already links directly to the
query-param URL, not to `/settings/dismissed`.

### Spec Requirement Coverage

- **FR-008** (no triage, inbox present): Already satisfied. No code change needed.
- **FR-009** (no standalone dismissed entry): AccountMenu satisfies this. The
  `/settings/dismissed` redirect page is dead but is addressed under #40.
- **FR-010** (old URLs redirect gracefully): The `/settings/dismissed` redirect currently
  handles any stale bookmarks. After it is removed, a Next.js permanent redirect in
  `next.config.js` should be added to handle the URL gracefully (→ `/feed?showDismissed=true`).
- **FR-011** (clear labels and grouping): Current labels are clear. No relabelling required.

### Alternatives Considered

| Option | Verdict | Reason Rejected |
|--------|---------|-----------------|
| Restructure AccountMenu into grouped sections | Out of scope | Spec says remove obsolete items, not redesign structure (Minimalism-First) |
| Add explicit "redirect" entry in Next.js config for all removed routes | Only needed for /settings/dismissed | Only one URL at risk of being bookmarked |

---

## 3. Dead Code Inventory (#40)

### Decision
Remove three items from `frontend/src/`: the `/settings/dismissed` page, the
`getDismissedItems()` function, and the `DismissedItem` / `DismissedItemsResponse` types.
Update the corresponding test file. Add a permanent redirect in `next.config.js` for the
deleted route.

### Confirmed Dead Code

| Item | File | Lines | Why Dead | Safe to Delete? |
|------|------|-------|----------|-----------------|
| `/settings/dismissed/page.tsx` | `frontend/src/app/settings/dismissed/page.tsx` | All | Redirect-only page; AccountMenu and all links already point to `/feed?showDismissed=true` directly. No component imports this page. | ✅ Yes — with redirect in next.config.js |
| `getDismissedItems()` | `frontend/src/services/feed.service.ts` | ~109–120 | Never called in production code. Dismissed items are fetched via `fetchFeed({ showDismissed: true })`. Only referenced in a test. | ✅ Yes — remove production fn + test |
| `DismissedItem` interface | `frontend/src/services/feed.service.ts` | ~35 | Exclusively used by `getDismissedItems()`. | ✅ Yes — with `getDismissedItems()` |
| `DismissedItemsResponse` interface | `frontend/src/services/feed.service.ts` | ~43 | Exclusively used by `getDismissedItems()`. | ✅ Yes — with `getDismissedItems()` |

### What Is NOT Dead (Confirmed Active)

| Item | Status |
|------|--------|
| FeedSection, FeedItem, CompletedSection, FeedEmptyState, IntegrationErrorBanner | ✅ All used in `feed/page.tsx` |
| useFeed, useInbox, useInboxCount, useLiveDate, useNativeTasks, useIntegrations | ✅ All used at call sites |
| All triage-related code | ✅ Already removed in 010/011; zero grep hits |
| AccountMenu | ✅ Used in layout |

### Redirect Strategy

`/settings/dismissed` should get a permanent (308) redirect to `/feed?showDismissed=true`
in `next.config.js` rather than a Next.js page so the URL resolves at the framework layer
without loading any React code.

```js
// next.config.js
redirects: async () => [
  {
    source: '/settings/dismissed',
    destination: '/feed?showDismissed=true',
    permanent: true,
  },
],
```

### Alternatives Considered

| Option | Verdict | Reason Rejected |
|--------|---------|-----------------|
| Keep `/settings/dismissed` page as redirect | Rejected | It is dead code with no active referrers; `next.config.js` redirect is lighter and doesn't require a React page to load |
| Leave `getDismissedItems()` with a deprecation comment | Rejected | YAGNI / Minimalism-First — it is superseded and untested by production paths |

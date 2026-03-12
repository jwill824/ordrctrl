# Research: Feed UX Enhancements & Cleanup (011)

## Decision 1: Onboarding Page — Redirect Approach

**Decision**: Replace the onboarding `page.tsx` with a Next.js server-side redirect using `redirect()` from `next/navigation`. Authenticated users → `/feed`. Unauthenticated users → `/sign-in`.

**Rationale**: A server-side redirect fires before any HTML is sent to the browser, so users never see a flash of the old onboarding content. Next.js App Router's `redirect()` in a Server Component is idiomatic and requires no new dependencies.

**Alternatives considered**:

| Option | Rejected Because |
|--------|-----------------|
| Keep page, add `useEffect` redirect | Client-side redirect shows the page briefly before navigating — poor UX |
| `next.config.js` redirect rule | Can't do auth-conditional redirects (session check requires server context) |
| Middleware redirect | Would work, but middleware already handles unauthenticated routes; redundant to add onboarding-specific logic there |

---

## Decision 2: Date/Time Staleness — Root Cause & Fix

**Decision**: The backend `cache.service.ts` `persistCacheItems()` UPDATE branch already updates `dueAt`, `startAt`, and `endAt` on every sync — this is working correctly. The UI staleness is a **frontend rendering issue**: relative-time labels (e.g., "due in 2 days") are computed once on render and never re-evaluated as real clock time advances. Fix by introducing a `useLiveDate` hook that ticks every minute, causing date label components to re-render and recompute relative strings without a full feed reload.

**Rationale**: The sync layer already solves source accuracy. The remaining gap is purely display-layer: `new Date()` called at component mount time freezes until the component unmounts and remounts. A ticking hook is the idiomatic React solution — no backend changes needed.

**Alternatives considered**:

| Option | Rejected Because |
|--------|-----------------|
| Periodic full feed reload for date freshness | Overkill — the feed already polls every 15 min; the display issue occurs within that window |
| Format all dates as absolute (e.g., "March 14, 2026") | Loses the relative context users find valuable ("due today", "overdue") |
| Store pre-formatted strings in the cache | Fragile; formatting is a UI concern and shouldn't be cached in the DB |

---

## Decision 3: Feed Sections by Date — Implementation

**Decision**: Add a `FeedSection` component that receives a label and items array. In `feed/page.tsx`, split the flat `items` array into two buckets before render: items where `effectiveDueAt` is non-null → "Upcoming" section; items where `effectiveDueAt` is null → "No Date" section. Section headers are rendered above each group. Preserve existing sort order within each section (already done by `buildFeed`: chronological for dated, `syncedAt` desc for undated).

**`effectiveDueAt`** = `userDueAt ?? dueAt` (user-assigned date takes precedence when source has none; source date takes precedence when both exist — see Decision 5).

**Rationale**: The sort order already produces the correct ordering (dated first, undated second). Adding visual section headers is a pure frontend change — no new API fields required because `FeedItem` already carries `dueAt`. The split logic lives in the page component, not in a new hook, keeping it simple.

**Alternatives considered**:

| Option | Rejected Because |
|--------|-----------------|
| Backend sends pre-grouped items | Couples presentation concerns to the API; harder to support future grouping changes |
| Use "Today / This Week / Later" time-horizon sections | Higher complexity, time-zone sensitivity, spec only requires "dated vs. undated" |
| CSS sticky section headers only | Inaccessible and doesn't convey semantic meaning |

---

## Decision 4: Dismissed Workflow — Inline Feed View

**Decision**: The feed page reads the `?showDismissed=true` query param (via `useSearchParams`) and, when set, fetches dismissed items from `GET /api/feed?showDismissed=true` (new query param on existing endpoint) instead of the normal feed. The `GET /api/feed` route passes the flag to `buildFeed()` which conditionally returns dismissed items. The old `/settings/dismissed` page becomes a server-side redirect to `/feed?showDismissed=true`.

**Note**: `AccountMenu.tsx` already links dismissed items to `/feed?showDismissed=true` — this is the correct destination. The `DismissedItemsPage` component and its route will be replaced/repurposed by this approach.

**Rationale**: Reusing the existing feed page and `FeedItemRow` components for dismissed items eliminates duplicate rendering logic. The query-param approach is bookmarkable, shareable, and works with browser history. Extending the existing `GET /api/feed` endpoint avoids a new route entirely.

**Alternatives considered**:

| Option | Rejected Because |
|--------|-----------------|
| Keep `/settings/dismissed` page but add permanent delete | Doesn't address the user's request to move it inline with the feed |
| Separate `GET /api/dismissed` endpoint | Duplicates feed construction logic; not necessary since dismissed items share the FeedItem shape |
| Store dismissed view state in React context | Less bookmarkable; harder to share or test |

---

## Decision 5: User-Assigned Due Dates on Synced Items

**Decision**: Add a `userDueAt DateTime?` column to `SyncCacheItem`. The `buildFeed()` function computes `effectiveDueAt = userDueAt ?? dueAt` and exposes it as `dueAt` in the `FeedItem` response (source is authoritative — `dueAt` from source overrides `userDueAt` when the source provides a date).

Wait: the spec says "source is authoritative" — meaning if the source provides a date, the source date wins. If the source provides no date (`dueAt = null`), then `userDueAt` is used. So the merge logic is:

```
effectiveDueAt = (source dueAt is non-null) ? dueAt : userDueAt
```

A new endpoint `PATCH /api/feed/items/:itemId/user-due-date` sets/clears `userDueAt` on a `SyncCacheItem`. Native tasks already have a `dueAt` field and use the existing `PATCH /api/tasks/:id` endpoint — no change needed for native tasks.

**Rationale**: A separate `userDueAt` field preserves the source's original date and allows the UI to reflect whichever is correct without overwriting sync data. This is the same pattern used by `completedInOrdrctrl` (user local state alongside source state). No new table needed.

**Alternatives considered**:

| Option | Rejected Because |
|--------|-----------------|
| Overwrite `dueAt` with user-assigned value | Loses source-provided date; can't restore it without re-syncing |
| New `SyncOverride` type `DATE_OVERRIDE` | SyncOverride stores intent, not data values — awkward to store a DateTime in the existing enum-based model |
| Edit only native tasks (skip synced) | Doesn't address the use case of undated synced tasks that the user wants to schedule |

---

## Decision 6: Permanent Delete of Dismissed Items

**Decision**: Add `DELETE /api/feed/items/:itemId/permanent` endpoint. For sync items: deletes the `SyncCacheItem` row (cascade-deletes any `SyncOverride` rows). For native items: deletes the `NativeTask` row. Requires the item to be dismissed first (404 if item is not in dismissed state, to prevent accidental deletion of active items).

**Rationale**: Hard delete is a simple DB row deletion — no new state needed. Requiring the item to already be dismissed creates a two-step safety gate: dismiss → then permanently delete. This matches the UX in the spec (permanent delete is only available from the dismissed view).

**Alternatives considered**:

| Option | Rejected Because |
|--------|-----------------|
| Soft-delete flag (`deletedAt` column) | Adds schema complexity for data that users explicitly want gone; privacy concern |
| Bulk permanent delete (delete all dismissed) | Not in scope for this feature; can be a future improvement |
| Allow permanent delete from active feed (skip dismiss step) | Too easy to accidentally delete; two-step model is safer |

---

## Technology Stack (confirmed from codebase)

- **Backend**: Node.js 20, TypeScript, Fastify 4, Prisma 5, PostgreSQL
- **Frontend**: Next.js 14.1.3, React 18, TypeScript, Tailwind CSS
- **Queue**: BullMQ + Redis (sync scheduling, unchanged by this feature)
- **Testing**: Vitest 1.3 (both backend and frontend)
- **Package manager**: pnpm (workspaces)
- **Ports**: Backend 4000, Frontend 3000

# Quickstart: Feed UX Enhancements & Cleanup (011)

## Overview

Five targeted improvements in one branch: onboarding redirect, live date labels, feed date sections, inline dismissed view with permanent delete, and user-assigned due dates on synced tasks.

---

## Architecture in One Sentence

Add `SyncCacheItem.userDueAt` for user-assigned dates, extend `GET /api/feed` with `?showDismissed`, add `DELETE /items/:id/permanent`, and replace the onboarding page and `/settings/dismissed` with server-side redirects.

---

## File Map

### Backend (modified)

| File | What Changes |
|------|-------------|
| `backend/prisma/schema.prisma` | Add `userDueAt DateTime?` to `SyncCacheItem` |
| `backend/prisma/migrations/` | New migration: `add_user_due_at_to_sync_cache_item` |
| `backend/src/feed/feed.service.ts` | Effective due date merge (`dueAt ?? userDueAt`); `showDismissed` param in `buildFeed()`; `permanentDeleteFeedItem()` function; add `dismissed` + `hasUserDueAt` to `FeedItem` |
| `backend/src/api/feed.routes.ts` | New routes: `PATCH /items/:id/user-due-date`, `DELETE /items/:id/permanent`; extend `GET /feed` to accept `?showDismissed` |
| `backend/tests/unit/feed/feed.service.test.ts` | Add tests for new service functions |
| `backend/tests/contract/feed.routes.test.ts` | Add tests for new/modified routes |

### Frontend (modified)

| File | What Changes |
|------|-------------|
| `frontend/src/app/onboarding/page.tsx` | Replace with server-side `redirect('/feed')` (or `/sign-in` if unauthed) |
| `frontend/src/app/settings/dismissed/page.tsx` | Replace with server-side `redirect('/feed?showDismissed=true')` |
| `frontend/src/app/feed/page.tsx` | Read `?showDismissed` param; split items into FeedSection groups (Upcoming / No Date / Dismissed); pass `onPermanentDelete` and `onSetUserDueAt` handlers |
| `frontend/src/components/feed/FeedItemRow.tsx` | Show permanent-delete button in dismissed view; use `useLiveDate()` for relative time labels |
| `frontend/src/components/feed/EditTaskModal.tsx` | Support editing `userDueAt` on synced items (not just native tasks); add "Clear date" option |
| `frontend/src/hooks/useFeed.ts` | Add `permanentDeleteItem()` and `setUserDueAt()` actions; accept `showDismissed` option |
| `frontend/src/services/feed.service.ts` | Add `permanentDeleteItem()`, `setUserDueAt()` API calls; extend `fetchFeed()` with `showDismissed` option |

### Frontend (new)

| File | Purpose |
|------|---------|
| `frontend/src/components/feed/FeedSection.tsx` | Section header + item list; accepts `label`, `items[]`, `emptyMessage` |
| `frontend/src/hooks/useLiveDate.ts` | Returns `Date` that ticks every 60s; use in any component that renders relative time strings |
| `frontend/tests/unit/components/feed/FeedSection.test.tsx` | Unit tests |

---

## Backend Implementation Guide

### Step 1: DB Migration

```bash
cd backend
# Add userDueAt to SyncCacheItem in schema.prisma, then:
pnpm prisma migrate dev --name add_user_due_at_to_sync_cache_item
pnpm prisma generate
```

### Step 2: `feed.service.ts` — Effective Due Date Merge

```typescript
// In buildFeed() item mapping:
const effectiveDueAt = item.dueAt ?? item.userDueAt ?? null;
const hasUserDueAt = item.dueAt === null && item.userDueAt !== null;

// Include in FeedItem:
dueAt: effectiveDueAt?.toISOString() ?? null,
hasUserDueAt,
```

### Step 3: `feed.service.ts` — Show Dismissed Items

```typescript
// Add overload to buildFeed or a new buildDismissedFeed():
async function buildDismissedFeed(userId: string): Promise<{ items: FeedItem[] }>
// Query: SyncCacheItem JOIN SyncOverride(DISMISSED) + NativeTask where dismissed=true
// Order by: dismissedAt DESC
```

### Step 4: `feed.service.ts` — Permanent Delete

```typescript
async function permanentDeleteFeedItem(userId: string, itemId: string): Promise<void> {
  if (itemId.startsWith('sync:')) {
    const id = itemId.replace('sync:', '');
    // Verify item is dismissed (SyncOverride(DISMISSED) exists) → else 409
    await prisma.syncCacheItem.delete({ where: { id, userId } });
  } else if (itemId.startsWith('native:')) {
    const id = itemId.replace('native:', '');
    // Verify item has dismissed=true → else 409
    await prisma.nativeTask.delete({ where: { id, userId } });
  }
}
```

### Step 5: `feed.routes.ts` — New Routes

```typescript
// PATCH /api/feed/items/:itemId/user-due-date
// BODY: { dueAt: string | null }
// → calls prisma.syncCacheItem.update({ data: { userDueAt: parsedDate } })

// DELETE /api/feed/items/:itemId/permanent
// → calls permanentDeleteFeedItem(userId, itemId)

// Extend GET /api/feed:
// ?showDismissed=true → calls buildDismissedFeed(userId)
// (normal request unchanged)
```

---

## Frontend Implementation Guide

### Onboarding Redirect

```typescript
// frontend/src/app/onboarding/page.tsx
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

export default async function OnboardingPage() {
  const session = await getServerSession();
  if (session) {
    redirect('/feed');
  } else {
    redirect('/sign-in');
  }
}
```

### `useLiveDate` Hook

```typescript
// frontend/src/hooks/useLiveDate.ts
export function useLiveDate(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
// Usage in any component that renders relative strings:
// const now = useLiveDate();
// const label = formatDistanceToNow(new Date(item.dueAt), { addSuffix: true, now });
```

### `FeedSection` Component

```tsx
// frontend/src/components/feed/FeedSection.tsx
interface FeedSectionProps {
  label: string;          // e.g., "Upcoming", "No Date", "Dismissed"
  items: FeedItem[];
  emptyMessage?: string;  // shown when items.length === 0
  // ...action handlers passed through
}

// Usage in feed/page.tsx:
const datedItems = items.filter(i => i.dueAt !== null);
const undatedItems = items.filter(i => i.dueAt === null);

<FeedSection label="Upcoming" items={datedItems} emptyMessage="No upcoming tasks" ... />
<FeedSection label="No Date" items={undatedItems} ... />
```

### Dismissed Inline View

```tsx
// frontend/src/app/feed/page.tsx
const searchParams = useSearchParams();
const showDismissed = searchParams.get('showDismissed') === 'true';

// In useFeed hook or directly:
const { items } = useFeed({ showDismissed });

// When showDismissed: render FeedSection with dismissed items + permanent delete button per item
// When !showDismissed: render Upcoming + No Date sections
```

### EditTaskModal — Synced Task Due Date

```tsx
// Allow editing for synced items too (not just native:)
// For sync: items, call setUserDueAt(itemId, date)
// For native: items, call updateTask(id, { dueAt: date })
// Show "(overridden)" badge next to date if hasUserDueAt === true
// Show "Clear date" button to call setUserDueAt(itemId, null)
```

---

## Key Gotchas

1. **`userDueAt` vs `dueAt` merge**: The merge happens in `buildFeed()`, NOT at the API response layer. The `FeedItem.dueAt` field always contains the effective date — the frontend never needs to know which field it came from (beyond the `hasUserDueAt` flag for UI purposes).

2. **Permanent delete requires prior dismiss**: Enforce this with a 409 guard on the backend. On the frontend, only show the permanent delete button in the `?showDismissed=true` view.

3. **`useLiveDate` tick interval**: 60 seconds is the recommended default. Shorter intervals (e.g., 5s) are unnecessary — "due in 2 days" doesn't change by the second.

4. **Feed sections with no items**: If all tasks are dated (no undated items), the "No Date" section should not render at all (not even the header). Use `items.length > 0` as the render condition.

5. **Native task editing is already wired**: `EditTaskModal` already handles native tasks via `useNativeTasks`. The change is to additionally call `setUserDueAt` when the item ID starts with `sync:`.

6. **`/settings/dismissed` redirect**: The page file still exists until deleted — replace its content with a redirect. The `DismissedItemsPage` component can be deleted once the inline view is working.

7. **`AccountMenu.tsx` already correct**: The dismissed menu entry already links to `/feed?showDismissed=true`. No change needed there.

---

## Test Checklist

### Backend unit tests (`feed.service.test.ts`)

- [x] `buildFeed()` returns `effectiveDueAt = dueAt` when source `dueAt` is non-null
- [x] `buildFeed()` returns `effectiveDueAt = userDueAt` when source `dueAt` is null and `userDueAt` is set
- [x] `buildFeed()` returns `dueAt = null` when both `dueAt` and `userDueAt` are null
- [x] `buildFeed()` sets `hasUserDueAt = true` when `userDueAt` is applied
- [x] `buildDismissedFeed()` returns only dismissed items
- [x] `permanentDeleteFeedItem()` deletes a dismissed sync item
- [x] `permanentDeleteFeedItem()` deletes a dismissed native item
- [x] `permanentDeleteFeedItem()` throws 409 for a non-dismissed active item

### Backend contract tests (`feed.routes.test.ts`)

- [x] `GET /api/feed` → 200 with `dismissed: false` and `hasUserDueAt: false` on normal items
- [x] `GET /api/feed?showDismissed=true` → 200 with `dismissed: true` on all returned items
- [x] `PATCH /api/feed/items/:id/user-due-date` → 200; updates displayed `dueAt` in subsequent feed call
- [x] `PATCH /api/feed/items/:id/user-due-date` with `null` → 200; clears user date
- [x] `PATCH /api/feed/items/native:xxx/user-due-date` → 400 `INVALID_ITEM_ID`
- [x] `DELETE /api/feed/items/:id/permanent` → 200 for dismissed item; item gone from dismissed feed
- [x] `DELETE /api/feed/items/:id/permanent` → 409 for active (non-dismissed) item

### Frontend unit tests

- [x] `FeedSection` renders label and items
- [x] `FeedSection` renders `emptyMessage` when items array is empty
- [x] `FeedSection` does not render when items array is empty and no `emptyMessage`
- [x] `FeedItemRow` renders permanent-delete button when `showDismissed=true`
- [x] `FeedItemRow` does NOT render permanent-delete button in normal view
- [x] `useLiveDate` updates `Date` value after interval fires
- [x] Feed page splits items correctly into Upcoming and No Date sections
- [x] Feed page renders dismissed section when `?showDismissed=true`

### Redirect tests

- [x] `/onboarding` redirects authenticated user to `/feed`
- [x] `/onboarding` redirects unauthenticated user to `/sign-in`
- [x] `/settings/dismissed` redirects to `/feed?showDismissed=true`

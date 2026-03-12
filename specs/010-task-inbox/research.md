# Research: Task Inbox (010)

## Decision 1: Inbox State Storage Model

**Decision**: Add `pendingInbox Boolean @default(false)` to the existing `SyncCacheItem` model.

**Rationale**: The inbox state is the simplest meaningful addition to the existing model.
- `false` (default) preserves all existing items in the feed — no migration needed.
- `true` set at CREATE time in `persistCacheItems` routes only new items to the inbox.
- UPDATE path never touches `pendingInbox`, so accepted items stay accepted across re-syncs.
- Keeps the data model minimal (no new table).

**Alternatives considered**:

| Option | Rejected Because |
|--------|-----------------|
| New `InboxItem` table | Extra join complexity with no benefit; SyncCacheItem already has the TTL/expiry lifecycle we need |
| New `OverrideType` value (INBOX_ACCEPTED) | SyncOverride tracks user intent against existing items; adding a "not-yet-seen" state inverts the semantic. Also requires querying both absence-of-override AND override — fragile. |
| Filter by `syncedAt` age on buildFeed() | "New" is relative to when the user last visited, not when the item was synced — unreliable without extra tracking |

---

## Decision 2: Inbox UI Surface

**Decision**: New `/inbox` page, accessible via a count badge in the AccountMenu navigation.

**Rationale**: The spec says "staging area — not directly into the feed." A separate page makes the separation clear and physical. The AccountMenu already serves as the app's secondary navigation surface.

**Alternatives considered**:

| Option | Rejected Because |
|--------|-----------------|
| Inbox section at top of `/feed` | Blurs the line between "pending" and "active"; clutters the primary surface (violates Constitution II: Minimalism) |
| Modal/drawer | Inbox can contain many items; a full page is more appropriate for bulk triage |
| Separate `/triage` route | Less discoverable than `/inbox` which is standard terminology |

---

## Decision 3: Feed Filter for Accepted Items

**Decision**: `buildFeed()` gains an additional filter: `pendingInbox = false`. This means only accepted items appear in the feed. No other feed logic changes.

**Rationale**: Minimal surgical change. The existing dismissed-IDs filter pattern is extended with the `pendingInbox` flag. No new query complexity.

---

## Decision 4: Native Tasks Bypass

**Decision**: `NativeTask` model is unchanged. Native tasks continue to go directly to the feed. No `pendingInbox` concept on `NativeTask`.

**Rationale**: Native tasks are user-created by definition — the user intentionally added them, so no inbox triage is needed.

---

## Decision 5: Inbox Count Badge & Navigation

**Decision**: `GET /api/inbox/count` feeds a badge on the AccountMenu "Inbox" link and the feed page Refresh button.

**Implementation**: When `inboxCount > 0`, the Refresh button on the feed page becomes a `<Link href="/inbox">` with the badge count — clicking navigates directly to the inbox staging page. When the inbox is empty, it renders as a standard refresh button. The AccountMenu also shows the count badge on the "Inbox" nav item.

**Rationale**: Making the badge itself the navigation target (not just an indicator) eliminates the ambiguity of a badge that shows inbox items but triggers a different action (feed triage). The user sees the count → clicks → arrives at the inbox. Zero cognitive disconnect.

**TriageSheet removed**: The pre-existing `TriageSheet` bottom-sheet component (which staged new sync items on manual refresh) was removed when the inbox was implemented. The two systems had overlapping responsibilities — items can only be in one place. All new sync items now flow exclusively through `/inbox`. This also simplified `useFeed.ts` by removing ~200 lines of triage state and logic.

---

## Decision 6: Re-sync & Deduplication Behavior

**Decision**: `pendingInbox` is NOT updated in the `persistCacheItems` upsert `update` branch. It is only set on `create`. Dismissed items (SyncOverride.DISMISSED) that are re-synced do NOT re-appear in the inbox on their own — only if the item's `externalId` changes (i.e., genuinely new item from source).

**Rationale**: Matches FR-010 — no re-appearance of previously triaged items. Consistent with existing DISMISSED override behavior.

**Edge case**: If a SyncCacheItem expires and is then re-synced, Prisma `upsert` will CREATE a new record (because the old one was deleted), setting `pendingInbox = true` again. This is acceptable because the item genuinely disappeared and came back.

---

## Decision 7: Existing Items Migration

**Decision**: DB migration adds `pendingInbox Boolean NOT NULL DEFAULT false`. All existing SyncCacheItems default to `false` (stay in feed). No data migration needed.

**Rationale**: Grandfathers existing items per FR-011. Safe and zero-downtime.

---

## Decision 8: Manual Refresh — Sync Completion Polling

**Decision**: After `POST /api/integrations/sync` (which returns 202 immediately), `refresh()` polls `GET /api/feed` every 2 seconds and compares `lastSyncAt` timestamps. Once all connected integrations show an updated `lastSyncAt`, the final feed reload fires. Timeout: 30 seconds.

**Problem solved**: `triggerSync()` enqueues BullMQ jobs and returns immediately. The original `reloadFeed()` call ran before any job completed, so the refresh button appeared to do nothing — a full browser reload was required to see new tasks.

**Rationale**: Polling the feed (which already includes integration `syncStatus.lastSyncAt`) requires no new API endpoint and leverages data already fetched. 2s interval is fast enough to feel responsive; 30s timeout handles edge cases like slow external APIs.

---

## Technology Stack (confirmed from codebase)

- **Backend**: Node.js 20, TypeScript, Fastify 4, Prisma 5, PostgreSQL
- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Queue**: BullMQ + Redis (sync scheduling)
- **Testing**: Vitest (backend unit + contract), Jest/RTL (frontend unit)
- **Package manager**: pnpm (workspaces)

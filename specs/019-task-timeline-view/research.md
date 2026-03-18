# Research: Task Timeline View

**Branch**: `019-task-timeline-view` | **Date**: 2026-03-17

---

## Decision 1: Swipe Gesture Implementation

**Decision**: Vanilla pointer events (`onPointerDown`, `onPointerMove`, `onPointerUp`) for swipe detection — no new gesture library.

**Rationale**: No gesture library exists in the codebase. Adding one (e.g., `@use-gesture/react`) would violate Constitution Principle V (no new dependency without written justification). Pointer events are natively available across all target platforms (Capacitor iOS/Android, Tauri macOS/Windows, and web). Horizontal-vs-vertical displacement tracking prevents conflict with vertical scroll.

**Implementation pattern**:
- Track `pointerdown` position as origin
- On `pointermove`, compute `deltaX` and `deltaY`
- Only commit a swipe when `|deltaX| > |deltaY|` AND `|deltaX| > 50px` threshold
- Use a CSS `transform: translateX()` for a live drag feel; snap to 0% or 100% on release
- `TimelineSwipeContainer` holds both feed and timeline side-by-side; `activeView` state drives the `translateX` offset

**Alternatives considered**:
- `@use-gesture/react` — capable but adds a new dependency; rejected per Principle V
- Capacitor Gesture API — mobile-only, not available in web/Tauri builds; rejected for inconsistency
- CSS `scroll-snap` — no programmatic control; cannot sync with preference persistence on page load; rejected

---

## Decision 2: View Preference Persistence

**Decision**: Extend the existing backend `UserSettings` JSON field and `/api/user/settings` PATCH endpoint.

**Rationale**: `User.settings` (Prisma schema) and `updateUserSettings()` (frontend `user.service.ts`) already exist and are used for `autoClearEnabled`/`autoClearWindowDays`. Extending this keeps preferences server-backed (survives app reinstall, syncs across devices) and avoids new infrastructure. The `NativePrefs`/`localStorage` pattern is scoped to ephemeral timestamps and notification state — not appropriate for a durable UX preference.

**Implementation**:
- Add `feedViewMode?: 'feed' | 'timeline'` to `UserSettings` interface in `backend/src/user/`
- On component mount, read from `getUserSettings()` (already fetched with the user session)
- On toggle, call `updateUserSettings({ feedViewMode: newMode })` — fire-and-forget, optimistically update local state
- Default: `'feed'` (no preference stored = show feed)

**Alternatives considered**:
- `@capacitor/preferences` / `localStorage` — simpler, but preference lost on reinstall and not cross-device; rejected
- Dedicated `userViewPreference` DB column — heavier schema change for a single string value; rejected in favour of the existing JSON settings bag

---

## Decision 3: Date Group Bucket Boundaries

**Decision**: Use local-midnight normalization (`setHours(0, 0, 0, 0)`) on both `now` and `dueAt` before computing day difference.

**Rationale**: The existing `formatDate()` in `FeedItem.tsx` computes `Math.ceil(diff / 86400000)` which can misclassify tasks due near midnight when the millisecond delta straddles a midnight boundary. For grouping — where misclassification means a task appears in the wrong bucket — local midnight boundaries are required for correctness.

**Bucket definitions** (implemented in `useTimeline`):
| Bucket | Condition |
|--------|-----------|
| Overdue | `diffDays < 0` |
| Today | `diffDays === 0` |
| This Week | `diffDays >= 1 && diffDays <= 7` |
| Later | `diffDays > 7` |
| Unscheduled | `dueAt === null` |

**Live date source**: `useLiveDate()` hook (already in codebase, updates every 60s) provides the `now` reference — ensuring buckets re-evaluate at midnight without a page reload.

**Alternatives considered**:
- Millisecond diff (existing `formatDate` approach) — incorrect near midnight boundaries; rejected for grouping
- UTC-based grouping — ignores user timezone; rejected (bucket labels are local concepts like "Today")

---

## Decision 4: FeedItemRow Reuse Strategy

**Decision**: Reuse `FeedItemRow` directly inside `TimelineGroup` with no adaptation.

**Rationale**: `FeedItemRow` is fully self-contained — it accepts `item: FeedItem` and callback props, renders a single row, and has no dependency on being inside `FeedSection`. The `TimelineGroup` component simply maps items to `FeedItemRow` using the same callback contract forwarded from `TimelineView` → `page.tsx` (same `useFeed` actions).

**Alternatives considered**:
- Wrapping `FeedItemRow` in a new `TimelineItem` adapter — unnecessary indirection; rejected
- Duplicating the row component for the timeline — violates DRY and Principle II; rejected

---

## Decision 5: Collapse State Management

**Decision**: Stateless `useState(defaultExpanded)` per `TimelineGroup`, matching the `CompletedSection.tsx` pattern. Collapse state is NOT persisted — resets to default (Overdue/Today expanded, This Week/Later collapsed) each time the timeline view is opened.

**Rationale**: `CompletedSection.tsx` uses the identical pattern (`useState(false)` + conditional render + `rotate-180` CSS transition). Resetting on open ensures users always land with urgent tasks visible, satisfying SC-001. Persisting collapsed state adds complexity with negligible user benefit.

**Implementation**: Each `TimelineGroup` receives `defaultExpanded: boolean` prop. Overdue and Today groups receive `true`; This Week and Later receive `false`.

**Alternatives considered**:
- Persisting collapse state in `UserSettings` — per-group state is too granular for server persistence; rejected
- `localStorage` per-group state — survives sessions, but contradicts the auto-collapse UX intent on open; rejected
- Global collapse context — overkill for 4 groups with no cross-group interaction; rejected

---

## Decision 6: Platform-Adaptive Navigation Entry Point

**Decision**: Use `usePlatform().isMobile` to conditionally render `TimelineSwipeContainer` (mobile) or a feed/timeline toggle UI (desktop/web) in `feed/page.tsx`.

**Rationale**: `usePlatform()` is already available app-wide via `PlatformContextProvider` and accurately distinguishes `isMobile` (Capacitor iOS/Android) from `isDesktop` (Tauri) and `web`. This is the established pattern for platform branching in the codebase (used in `notifications.ts`, `deep-link.ts`, `oauth.ts`).

**Alternatives considered**:
- CSS media queries alone — cannot distinguish Capacitor from web reliably; rejected
- Separate route for timeline — heavier navigation change, loses the fluid view-transition feel; rejected

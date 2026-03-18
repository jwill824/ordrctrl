# Quickstart: Task Timeline View

**Branch**: `019-task-timeline-view` | **Date**: 2026-03-17

---

## What This Feature Adds

A swipe-accessible (mobile) / toggle-accessible (desktop + web) timeline view of your active feed tasks, grouped into five date buckets: **Overdue**, **Today**, **This Week**, **Later**, and **Unscheduled**. Overdue and Today expand by default; This Week and Later are collapsed until tapped. The active view (feed vs. timeline) is persisted to your user account.

---

## New Files

| File | Purpose |
|------|---------|
| `frontend/src/components/timeline/TimelineView.tsx` | Root timeline container; renders `TimelineGroup` list |
| `frontend/src/components/timeline/TimelineGroup.tsx` | Single date bucket: sticky header, expand/collapse, item list |
| `frontend/src/components/timeline/TimelineSwipeContainer.tsx` | Mobile-only: pointer-event-based lateral swipe wrapping feed + timeline |
| `frontend/src/hooks/useTimeline.ts` | Groups `FeedItem[]` into `TimelineGroupData[]` by date bucket |
| `frontend/tests/timeline/useTimeline.test.ts` | Unit tests for grouping logic |
| `frontend/tests/timeline/timeline.e2e.ts` | Playwright e2e: swipe/toggle + collapse behavior |

---

## Modified Files

| File | Change |
|------|--------|
| `frontend/src/app/feed/page.tsx` | Add `TimelineSwipeContainer` (mobile) or toggle control (desktop/web); read/write `feedViewMode` preference |
| `frontend/src/plugins/notifications.ts` | Extend `UserSettings` to include `feedViewMode?: 'feed' \| 'timeline'` |
| `backend/src/user/user.service.ts` | Add `feedViewMode?: 'feed' \| 'timeline'` to `UserSettings` interface |

---

## Key Interfaces

### `useTimeline` hook

```typescript
import { useTimeline } from '@/hooks/useTimeline';

const groups = useTimeline(feedItems, now);
// Returns: TimelineGroupData[] — only non-empty buckets, in order:
// overdue → today → this-week → later → unscheduled
```

### `TimelineGroup` component

```typescript
<TimelineGroup
  bucket="overdue"
  label="Overdue"
  items={[...]}
  defaultExpanded={true}
  onComplete={handleComplete}
  onDismiss={handleDismiss}
  onEdit={handleEdit}
/>
```

### View toggle (desktop/web)

```typescript
const { isMobile } = usePlatform();
// isMobile → render TimelineSwipeContainer
// !isMobile → render toggle control + conditionally render FeedSection or TimelineView
```

---

## Running the Feature Locally

```bash
# From repo root — start both backend and frontend
pnpm dev

# Navigate to the feed (http://localhost:5173 or the device app)
# On mobile: swipe left from the feed to enter timeline view
# On desktop/web: use the toggle in the feed header
```

---

## Running Tests

```bash
# Unit tests (grouping logic)
pnpm --filter frontend test

# E2E tests (swipe + toggle + collapse)
pnpm --filter frontend test:e2e
```

---

## Acceptance Checklist (manual verification)

- [ ] Swipe left on mobile enters timeline; swipe right returns to feed
- [ ] Desktop/web toggle switches between feed and timeline
- [ ] View preference persists after closing and reopening the app
- [ ] Overdue and Today groups are expanded by default
- [ ] This Week and Later groups are collapsed by default; tap header to expand
- [ ] Tapping a group header toggles collapse/expand
- [ ] Inbox items (pending triage) do NOT appear in the timeline
- [ ] Tasks completed or dismissed in the timeline are removed immediately
- [ ] Source integration filter correctly hides groups with no matching tasks
- [ ] Empty state shown when no active tasks exist
- [ ] Offline: last cached state shown with stale indicator
- [ ] All-day calendar events (Apple Calendar) appear in the correct date bucket (e.g. a 3/18 all-day event shows as "This Week"/"Tomorrow", not "Today") regardless of timezone
- [ ] Calendar events with null `dueAt` but a valid `startAt` still appear in the timeline in the correct bucket
- [ ] Due date displayed in the task modal shows the user's local time (not UTC) for timed events; shows date only (no time) for all-day events

# Data Model: Task Timeline View

**Branch**: `019-task-timeline-view` | **Date**: 2026-03-17

---

## Overview

The timeline view introduces **no new database models** and **no new API endpoints**. All data originates from the existing `FeedItem[]` returned by `GET /api/feed`. The data model for this feature is entirely a frontend concern: grouping logic, view state, and one extension to the existing `UserSettings` type.

---

## Frontend Types

### `TimelineBucket`

The five canonical date group identifiers.

```typescript
export type TimelineBucket =
  | 'overdue'
  | 'today'
  | 'this-week'
  | 'later'
  | 'unscheduled';
```

### `TimelineGroupData`

A single resolved date bucket with its items and display metadata. Produced by `useTimeline`.

```typescript
export interface TimelineGroupData {
  /** Canonical bucket identifier */
  bucket: TimelineBucket;
  /** Human-readable label shown in the group header */
  label: string;
  /** Tasks belonging to this bucket, sorted by dueAt ASC then title ASC */
  items: FeedItem[];
  /** Whether this group is expanded by default on timeline open */
  defaultExpanded: boolean;
}
```

**Bucket → label mapping**:
| Bucket | Label | Default expanded |
|--------|-------|-----------------|
| `overdue` | Overdue | `true` |
| `today` | Today | `true` |
| `this-week` | This Week | `false` |
| `later` | Later | `false` |
| `unscheduled` | Unscheduled | `false` |

**Sort order within a bucket**: `dueAt ASC` (earliest first), then `title ASC` for items sharing the same `dueAt`. Items with `dueAt === null` (Unscheduled bucket) are sorted by `title ASC` only.

---

### `TimelineViewMode`

The user's persisted view preference. Extends the existing `UserSettings` type.

```typescript
// Addition to existing UserSettings in backend/src/user/
export type TimelineViewMode = 'feed' | 'timeline';

// Existing interface extension (backend/src/user/user.service.ts)
export interface UserSettings {
  autoClearEnabled: boolean;
  autoClearWindowDays: number;
  feedViewMode?: TimelineViewMode;  // NEW — defaults to 'feed' when absent
}
```

**Persistence**: Stored as `feedViewMode` key inside the existing `User.settings` JSON column in PostgreSQL. No schema migration required.

---

## Bucket Assignment Logic

> **Implementation**: This algorithm is implemented in `frontend/src/utils/dateUtils.ts` (`toLocalMidnight`, `isAllDayDate`) and called by `frontend/src/hooks/useTimeline.ts` (`getBucket`).

```
Given a FeedItem with dueAt and startAt (ISO 8601 strings or null) and the current local date (now):

1. dateKey = dueAt ?? startAt
   If dateKey is null → bucket = 'unscheduled'

   (Calendar events — e.g. Apple Calendar — may have dueAt: null and startAt populated.
    Always fall back to startAt when dueAt is absent.)

2. Normalize dateKey to local midnight via toLocalMidnight(dateKey):

   All-day sentinel detection (isAllDayDate):
     A date is "all-day" if its UTC time is exactly T00:00:00.000Z (legacy UTC midnight)
     or T12:00:00.000Z (UTC noon — canonical all-day sentinel safe for all UTC-12…UTC+11.5 timezones).

   For all-day sentinels:
     dueDay = new Date(UTC_year, UTC_month, UTC_date)   ← local midnight of the UTC calendar date
     (Do NOT call setHours() — that would shift the date in UTC-negative timezones)

   For timed events:
     dueDay = new Date(dateKey);  dueDay.setHours(0, 0, 0, 0)   ← local midnight

   today = new Date(now);  today.setHours(0, 0, 0, 0)

3. diffDays = Math.round((dueDay - today) / 86_400_000)

4. Assign bucket:
     diffDays < 0            → 'overdue'
     diffDays === 0          → 'today'
     diffDays >= 1 && <= 7   → 'this-week'
     diffDays > 7            → 'later'
```

**Why UTC noon for all-day events**: `new Date('YYYY-MM-DD')` in JavaScript is parsed as UTC midnight. In UTC-negative timezones, this represents the *previous* local calendar day. Storing all-day dates as UTC noon (`YYYY-MM-DDT12:00:00.000Z`) eliminates this shift: UTC noon is always positive-local for UTC-12 through UTC+11.5. The frontend detects both sentinels and extracts the UTC date components directly.

**Groups with zero items are omitted** — `useTimeline` returns only buckets that have at least one `FeedItem`.

---

## Existing Entities (unchanged)

### `FeedItem` (frontend, `feed.service.ts`)

Key fields used by the timeline:

| Field | Type | Usage |
|-------|------|-------|
| `id` | `string` | React key; passed to action callbacks |
| `dueAt` | `string \| null` | Primary bucket assignment key; sort key. Null for some integration events (e.g. Apple Calendar) — fall back to `startAt`. |
| `startAt` | `string \| null` | Fallback bucket key when `dueAt` is null (e.g. Apple Calendar events). All-day events use UTC noon sentinel (`T12:00:00.000Z`). |
| `title` | `string` | Secondary sort key; display |
| `source` | `string` | Source integration filter (FR-013) |
| `serviceId` | `string` | Integration color/icon in `FeedItemRow` |
| `completed` | `boolean` | Excluded from timeline (only active tasks shown) |
| `dismissed` | `boolean` | Excluded from timeline |

No new fields are added to `FeedItem`.

### `User.settings` (backend, Prisma)

Existing `Json?` column. Extended at the TypeScript type level only — no Prisma schema migration.

---

## State & Lifecycle

```
App start
  └─ Feed page mounts
       └─ getUserSettings() → read feedViewMode
            ├─ 'feed' (or absent) → render FeedSection (current behavior)
            └─ 'timeline'         → render TimelineView

User toggles view
  ├─ Optimistic local state update (instant UI response)
  └─ updateUserSettings({ feedViewMode }) → PATCH /api/user/settings

useFeed (unchanged)
  └─ Returns FeedItem[] → consumed by both FeedSection and useTimeline

useTimeline (new)
  ├─ Input: FeedItem[], now (from useLiveDate)
  ├─ Filters: completed === false && dismissed === false
  ├─ Groups into TimelineGroupData[]
  └─ Output: TimelineGroupData[] (only non-empty buckets)
```

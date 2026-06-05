# S03: Task List View and Toggle — Research

**Date:** 2026-06-03
**Researcher:** Auto-mode scout

## Summary

S03 adds a fourth segment ("List") to the existing three-tab pill control (Feed / Timeline / Planner) in FeedPage, and renders a simple flat list of all native tasks when that tab is active. The segmented control pattern, view-mode persistence, and FeedItemRow component all exist and just need extension. The only new concept is filtering `items` down to native tasks only (serviceId prefix `task:`) for the list view.

## Recommendation

Extend `TimelineViewMode` to include `'list'`, add the tab to the pill control array, add a `listJsx` branch in FeedPage, and update the three places that hard-code the `'feed' | 'timeline' | 'planner'` enum. The list view itself is a single FeedSection (or bare FeedItemRow loop) over native-task items — no new component required. Build order: types first, then backend/service enum, then FeedPage render branch.

## Implementation Landscape

### Segmented Control (current state)

In `FeedPage` header (line 108), the pill renders by mapping over a literal array:

```tsx
{(['feed', 'timeline', 'planner'] as TimelineViewMode[]).map((mode) => (
```

Each mode gets a pill button; active mode gets `bg-black text-white`. Adding `'list'` to the array is the only change needed in the template. The control is suppressed when `showDismissed` is true — that behavior stays unchanged.

### FeedPage Structure

View-mode rendering lives inside the `items.length > 0` IIFE (lines 244–297). It builds `feedJsx`, `timelineJsx`, then checks `viewMode === 'planner'` before falling back to `viewMode === 'timeline' ? timelineJsx : feedJsx`. A `listJsx` branch fits naturally as an additional early-return check before the final ternary.

View-mode is persisted via `getUserSettings` / `updateUserSettings` — both the frontend service (`UserSettings.feedViewMode`) and the backend Zod schema (`z.enum(['feed', 'timeline', 'planner'])`) need `'list'` added.

### List View Content

The list view shows all native tasks — items where `item.serviceId` starts with `task:` (or `item.source === 'native'` if that field exists). FeedSection already renders a labeled group of FeedItemRows with complete/dismiss/edit callbacks. A single `<FeedSection label="Tasks" items={nativeItems} ... />` is sufficient. An empty-state message ("No tasks yet.") should be provided.

The native-task filter can be a `useMemo` derived from `items` — analogous to the existing `datedItems`/`undatedItems` split already in FeedPage.

### Files to Change

- `frontend/src/types/timeline.ts` — add `'list'` to `TimelineViewMode` union
- `frontend/src/services/user.service.ts` — add `'list'` to `feedViewMode` string union in `UserSettings`
- `backend/src/api/user.routes.ts` — add `'list'` to `z.enum([...])` for `feedViewMode`
- `backend/src/user/user.service.ts` — add `'list'` to `feedViewMode` type union
- `frontend/src/app/feed/page.tsx` — (a) add `'list'` to pill array, (b) add `nativeItems` memo, (c) add `listJsx` constant, (d) add `viewMode === 'list'` branch before final ternary

### Verification

```bash

# Type-check frontend

cd frontend && npx tsc --noEmit

# Type-check backend

cd backend && npx tsc --noEmit

# Unit tests

cd frontend && npx vitest run

# Browser smoke: toggle to List tab, confirm only native tasks render

# Toggle back to Feed/Timeline/Planner — confirm no regression

# Reload page — confirm List mode persists (settings round-trip)

```

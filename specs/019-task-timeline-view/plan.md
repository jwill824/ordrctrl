# Implementation Plan: Task Timeline View

**Branch**: `019-task-timeline-view` | **Date**: 2026-03-17 | **Spec**: [spec.md](./spec.md)

## Summary

Add a swipe-accessible (mobile) / toggle-accessible (desktop/web) timeline view that renders the existing feed's `FeedItem[]` data grouped into five chronological buckets: Overdue, Today, This Week, Later, and Unscheduled. No new backend endpoints or database models are required — the timeline is a pure frontend rendering concern layered on top of the existing `useFeed` hook. The primary deliverables are a `useTimeline` grouping hook, a family of `TimelineView` / `TimelineGroup` components, a swipe gesture container for mobile, and a view-preference persistence layer extending the existing `NativePrefs` pattern.

## Technical Context

**Language/Version**: TypeScript 5.4 / React 18.2
**Primary Dependencies**: React Router DOM v6, Capacitor 8 (iOS/Android), Tauri 2 (macOS/Windows), Vite, Vitest, Playwright
**Storage**: No new storage — `FeedItem[]` from existing `useFeed` hook; view preference via existing `NativePrefs` pattern (`@capacitor/preferences` → `localStorage` fallback)
**Testing**: Vitest (unit — grouping logic, hook behavior), Playwright (e2e — swipe/toggle navigation, group expand/collapse)
**Target Platform**: iOS, Android (Capacitor), macOS, Windows (Tauri), Web browser
**Project Type**: Cross-platform mobile + desktop + web app
**Performance Goals**: Timeline renders all task groups within 1 second for up to 200 tasks (SC-002)
**Constraints**: No new API endpoints; no new DB models; swipe must not conflict with vertical scroll; preference persists across cold starts
**Scale/Scope**: Single-user feed; up to 200 active tasks per SC-002; 5 fixed date buckets

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Integration Modularity | ✅ Pass | No new integrations; timeline reads existing normalized `FeedItem[]` |
| II. Minimalism-First | ✅ Pass | Timeline justified by US1–US4 in spec; no new UI surfaces beyond the view itself |
| III. Security & Privacy | ✅ Pass | No new credentials, tokens, or raw data persisted; view preference is non-sensitive |
| IV. Test Coverage Required | ✅ Pass | Grouping logic unit tests + e2e swipe/toggle tests required before merge |
| V. Simplicity & Deferred Decisions | ✅ Pass | Reuses existing `useFeed`, `FeedItemRow`, `NativePrefs`; no new infra; swipe via vanilla touch events (no new dependency) |

**Gate result**: All principles pass. No complexity violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/019-task-timeline-view/
├── plan.md              ✅ This file
├── research.md          ✅ Phase 0 output
├── data-model.md        ✅ Phase 1 output
├── quickstart.md        ✅ Phase 1 output
└── tasks.md             ⬜ Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
frontend/src/
├── app/
│   └── feed/
│       └── page.tsx                    # Modified: add SwipeViewContainer + view toggle
├── components/
│   ├── feed/
│   │   └── (unchanged)
│   └── timeline/
│       ├── TimelineView.tsx            # New: root container, renders TimelineGroup list
│       ├── TimelineGroup.tsx           # New: single date bucket with sticky header + collapse
│       └── TimelineSwipeContainer.tsx  # New: wraps feed+timeline for mobile swipe gesture
├── hooks/
│   ├── useFeed.ts                      # Unchanged — timeline reuses this
│   └── useTimeline.ts                  # New: groups FeedItem[] into TimelineGroup[]
└── plugins/
    └── notifications.ts                # Modified: add viewPreference key to NativePrefs

frontend/tests/
└── timeline/
    ├── useTimeline.test.ts             # New: unit tests for grouping logic
    └── timeline.e2e.ts                 # New: Playwright e2e for swipe/toggle + collapse
```

**Structure Decision**: Frontend-only change. No backend modifications. Follows the existing `components/feed/` → `hooks/useFeed` → `services/feed.service` layering pattern. New `components/timeline/` directory mirrors `components/feed/` structure.

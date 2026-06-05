# Milestones

## v1.0 Timeline Visual Planner (Shipped: 2026-06-05)

**Phases completed:** 6 phases, 22 plans, 0 tasks

**Key accomplishments:**

- Added startAt (DateTime?) and duration (Int?) to NativeTask Prisma model with compound index and generated migration 20260604013807_add_startat_duration_to_native_task
- Wired startAt, duration, and computed endAt through Zod validation, service types, createTask/updateTask, and both native-task feed mappings
- Added Vitest unit tests for startAt, duration, computed endAt, and validation across task.service.test.ts, task.routes.test.ts, and feed.service.test.ts
- Extended TimelineViewMode to include 'planner', updated NativeTask type with startAt/endAt/duration fields, and threaded 'planner' through backend Zod validation and user service types.
- Created usePlannerTimeline hook splitting FeedItems into scheduled/unscheduled with durationMinutes, plus 8 passing unit tests
- Created PlannerTimeBlock and DailyPlannerView components — 24-hour scrollable canvas with hour markers, absolutely-positioned task blocks, current-time indicator, and unscheduled section
- Wired DailyPlannerView into FeedPage with a unified three-segment pill control (Feed / Timeline / Planner) replacing the old icon toggle and swipe container
- Browser-verified planner view renders correctly — segmented control, 24-hour time axis, scheduled task block, unscheduled section, and current-time indicator all confirmed; Feed and Timeline modes show no regression
- Added 'list' to TimelineViewMode union and all four settings type/enum definitions across frontend and backend
- Wired 'list' tab into FeedPage segmented control showing only native tasks via FeedSection
- Browser-verified List tab, tab switching across all four modes, and settings persistence via code inspection and full test suite pass
- Added getWeekStart/addDays to dateUtils, added 'week' to TimelineViewMode and feedViewMode, and added backward-compatible targetDate filtering to usePlannerTimeline.
- Created useWeeklyPlanner hook that partitions FeedItems into a Map<string, PlannerItem[]> keyed by local YYYY-MM-DD date, with 9 passing unit tests.
- Added compact prop to PlannerTimeBlock and built WeeklyPlannerView with 7 horizontal day-columns, hour markers, and tappable column headers.
- Wired WeeklyPlannerView into FeedPage with 'week' segmented control, weekStart/plannerDate state, day-tap navigation to daily planner, and full-width horizontal scroll layout.
- Verified weekly view rendering, horizontal scroll, day highlight, and day-tap navigation via code inspection + tsc (clean) + Vitest (145/145 passing).
- Created nativeTaskToFeedItem utility and extended useNativeTasks.create to accept startAt and duration
- Added createScheduledTask to useFeed with optimistic insert, server reconciliation, and revert-on-failure
- Created QuickCreateSheet fixed bottom-panel component with title, startAt, and duration fields, local-to-UTC conversion, inline error display, and loading state.
- Wired QuickCreateSheet into FeedPage FAB for planner mode; fixed useNativeTasks tests to match extended create signature.
- Made dismiss button always visible, increased touch targets on filter pills and day headers, improved hour-marker legibility, applied safe-area-inset bottom padding, and deleted orphaned TimelineSwipeContainer.
- All T01 fixes verified: frontend tsc clean, 145 vitest tests passing, all grep checks confirm patches landed, TimelineSwipeContainer confirmed deleted with no remaining imports.

---

## M001 M001 (Shipped: 2026-06-05)

**Phases completed:** 0 phases, 0 plans, 0 tasks

**Key accomplishments:**

- (none recorded)

---

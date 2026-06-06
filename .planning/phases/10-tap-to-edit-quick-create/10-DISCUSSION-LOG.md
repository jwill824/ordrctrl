# Phase 10: Tap to Edit + Quick-Create UX - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-05
**Phase:** 10-tap-to-edit-quick-create
**Areas discussed:** Create/Edit sheet unification, Scroll-wheel time picker, Sheet state ownership, Tap detection wiring

---

## Create/Edit Sheet Unification

| Option | Description | Selected |
|--------|-------------|----------|
| Upgrade QuickCreateSheet | One component, fewer files, consistent UX for create and edit | ✓ |
| Separate TaskEditSheet | Keeps create flow lighter, edit can have extra fields | |
| You decide | Agent discretion | |

**User's choice:** Upgrade QuickCreateSheet

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — Delete button in edit mode (confirm step) | Show "Are you sure?" confirmation | ✓ |
| No — no delete in this phase | Deletion handled elsewhere | |

**User's choice:** Yes, with confirm step (not single-tap red)

| Option | Description | Selected |
|--------|-------------|----------|
| Rename to TaskSheet | Reflects both create and edit modes | ✓ |
| Keep QuickCreateSheet | No rename, just extend props | |

**User's choice:** Rename to TaskSheet

| Option | Description | Selected |
|--------|-------------|----------|
| Slide up from bottom | Consistent with current sheet behavior | ✓ |
| Full modal overlay | Darkened backdrop, centered | |

**User's choice:** Slide up from bottom

| Option | Description | Selected |
|--------|-------------|----------|
| Both — backdrop tap and swipe-down | Either gesture dismisses | ✓ |
| Backdrop tap only | | |
| Swipe down only | | |
| Cancel button only | | |

**User's choice:** Both

| Option | Description | Selected |
|--------|-------------|----------|
| title + startAt + duration | Core planner fields only | ✓ |
| title + startAt + duration + dueAt | | |
| title + startAt + duration + dueAt + completed toggle | | |

**User's choice:** title + startAt + duration (core fields only)
**Notes:** User initially selected "all task fields" but when presented with the actual NativeTask model, clarified they want just the core three. Recurrence was explored but deferred — NativeTask has no recurrence fields yet.

---

## Scroll-wheel Time Picker

| Option | Description | Selected |
|--------|-------------|----------|
| Use a library | react-mobile-picker or similar, faster, battle-tested | ✓ |
| Build custom | Vanilla scroll-snap CSS, no new dep | |

**User's choice:** Use a library

| Option | Description | Selected |
|--------|-------------|----------|
| 24-hour (Hour + Minute columns) | 0–23, 0–59 | ✓ |
| 12-hour (with AM/PM) | | |

**User's choice:** 24-hour

| Option | Description | Selected |
|--------|-------------|----------|
| Every 15 minutes | Matches snap grid (0, 15, 30, 45) | ✓ |
| Every 5 minutes | | |
| Every minute | | |

**User's choice:** Every 15 minutes

| Option | Description | Selected |
|--------|-------------|----------|
| Separate hour and minute columns | iOS-style side by side | |
| Single combined scrollable list | Formatted time strings, one column | ✓ |

**User's choice:** Single scrollable column of time slots
**Notes:** User referenced Structured explicitly — a single-column scroll list of times (not split hour/minute columns). Full day range 12:00 AM to 11:45 PM. Picker scrolls to current task time on open.

| Option | Description | Selected |
|--------|-------------|----------|
| Full day range 12:00 AM – 11:45 PM | All slots visible | ✓ |
| Contextual ±4 hours around current time | Shorter list | |

**User's choice:** Full day range

---

## Sheet State Ownership

| Option | Description | Selected |
|--------|-------------|----------|
| Keep in feed/page.tsx | Add editingTask state alongside showQuickCreate | |
| Move to useTaskSheet hook | Encapsulates open/task state, callable from both page and planner | ✓ |

**User's choice:** Move to useTaskSheet custom hook

---

## Tap Detection Wiring

| Option | Description | Selected |
|--------|-------------|----------|
| Add onTap callback to useDragToReschedule | Fires from pointer event path, works on touch | ✓ |
| Keep onClick on block overlay | Simpler but may fire during drag on desktop | |

**User's choice:** Add onTap callback to useDragToReschedule

---

## Deferred Ideas

- **Recurrence / Repeating Tasks** — User described specific recurrence requirements (Apple Reminders-style, multi-day multi-time rules). Noted for a dedicated future phase. NativeTask schema needs additions.

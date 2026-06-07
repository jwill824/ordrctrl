# ordrctrl

## What This Is

A multi-source task aggregation and visual planning app built with React 18 + Vite + Tailwind, deployed via Capacitor (mobile) and Tauri (desktop). Pulls tasks and events from Gmail, Microsoft To Do, and Apple Calendar alongside native task creation. The feed page offers a bucketed list view (Overdue/Today/This Week/Later/Unscheduled) **and** a time-axis visual planner with a unified `TimelineCanvas` component for Day and Week views, drag-to-reschedule, tap-to-edit, per-task color coding, and weekly navigation.

## Core Value

An ADHD-friendly visual time planner where your day is a spatial, navigable timeline — not an overwhelming list.

## Project Shape

- **Complexity:** complex
- **Why:** Multi-platform app (Capacitor + Tauri) with existing backend (Prisma/PostgreSQL), integration infrastructure, and a new visual timeline UI that must feel polished and responsive across form factors.

## Current State

**Shipped: v1.1 (2026-06-07)**

- Backend: Fastify + Prisma + PostgreSQL with auth, task CRUD (startAt/duration/endAt/color/icon), sync scheduler, feed/inbox services — ~250 passing backend tests
- Frontend: React 18 + Vite + Tailwind, 3-tab bottom nav (Planner | Inbox | Integrations), unified `TimelineCanvas` (Day/Week), drag-to-reschedule, tap-to-edit TaskSheet, scroll-wheel time picker, per-task color/icon — 211 passing frontend tests
- Integrations: Gmail, Microsoft Tasks, Apple Calendar adapters with sync cache
- Capacitor (iOS/Android) + Tauri (desktop) targets — verified at mobile (430×932) and desktop (1280×800) viewports

<details>
<summary>v1.0 state (2026-06-05)</summary>

- Backend: Fastify + Prisma + PostgreSQL with auth, task CRUD (startAt/duration/endAt), sync scheduler, feed/inbox services — 254 passing backend tests
- Frontend: React 18 + Vite + Tailwind, 5-tab segmented control (Feed / Timeline / Planner / List / Week), DailyPlannerView, WeeklyPlannerView, QuickCreateSheet — 145 passing frontend tests
- Integrations: Gmail, Microsoft Tasks, Apple Calendar adapters with sync cache
- Capacitor (iOS/Android) + Tauri (desktop) targets — verified at mobile (430×932) and desktop (1280×800) viewports

</details>

## Architecture / Key Patterns

- Monorepo: `backend/` (Fastify + Prisma), `frontend/` (React + Vite + Tailwind), `docs/`, `specs/`
- Backend: Route modules (`api/*.routes.ts`), service layer (`feed/`, `inbox/`, `sync/`, `integrations/`), Prisma ORM
- Frontend: Page components, custom hooks (`useFeed`, `useTimeline`), Tailwind utility classes, vanilla pointer-event gestures
- Timeline: `TimelineCanvas` (columns=1 Day, columns=7 Week), `DraggableTimeBlock`, `useDragToReschedule`, `PX_PER_HOUR=80`
- Auth: Session-based with Apple/Google OAuth providers
- Sync: Scheduler-driven integration sync with cache layer (`SyncCacheItem`)
- Build: pnpm workspaces, Vite, Capacitor + Tauri for cross-platform

## Capability Contract

Requirements are archived per milestone. See `.planning/milestones/v1.1-REQUIREMENTS.md` for the v1.1 capability contract.
Fresh requirements for the next milestone are defined during `/gsd-new-milestone`.

## Milestone Sequence

- [x] v1.0: Timeline Visual Planner — ADHD-friendly visual time planner with daily/weekly views, schedulable native tasks, quick-create, and consistent UI theme *(shipped 2026-06-05)*
- [x] v1.1: Timeline & Planner UX Polish — Structured-like planner behavior, drag-to-reschedule, inline editing, unified TimelineCanvas, view polish across all tabs *(shipped 2026-06-07)*
- [ ] v1.2: TBD — define via `/gsd-new-milestone`

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-07 after v1.1 milestone shipped*


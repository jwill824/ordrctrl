# Feature Specification: Task Rename, Console Error Fix & Documentation Polish

**Feature Branch**: `017-task-rename-polish`
**Created**: 2026-03-15
**Status**: Draft
**Closes**: [#49](https://github.com/jwill824/ordrctrl/issues/49), [#48](https://github.com/jwill824/ordrctrl/issues/48), [#58](https://github.com/jwill824/ordrctrl/issues/58)

## Overview

This spec groups three small but meaningful polish items:

1. **Task rename** (#49) — Users can rename any task to a custom title while the original content is preserved in the task description. Today, the only way to "customize" a task title is via the description override, which replaces the description instead of preserving it.
2. **Console error fix** (#48) — A recurring `TypeError: Cannot read properties of null (reading 'id')` appeared in the developer console on every session. Confirmed to originate from the Fetch browser extension (`content.js`), not app code. Documented in `docs/development.md` under "Known browser noise"; no app code change required.
3. **Documentation polish** (#58) — Four targeted doc improvements: update branch naming conventions to reflect how the project actually works (spec-numbered branches), move the speckit workflow section from README to CONTRIBUTING where it belongs, remove the redundant TL;DR from the development guide, and convert the plain-text architecture diagram to Mermaid for maintainability.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Rename a Task (Priority: P1)

A user has a task in their feed synced from an integration (e.g., a Gmail subject line like "Re: Re: Re: Q3 budget review"). The title is awkward or too long. They want to rename it to something meaningful (e.g., "Q3 budget") while keeping the original content accessible for context.

**Why this priority**: This is the only net-new user-facing capability in this spec. Synced task titles are often verbose or cryptic; the rename addresses a real daily friction point. The original content is valuable context and must not be discarded.

**Independent Test**: Open the app, find any task, rename it, verify the new title appears in the feed, and verify the original title appears in the task detail view as part of the description.

**Acceptance Scenarios**:

1. **Given** a task is visible in the feed, **When** the user selects "Rename", **Then** an editable field pre-filled with the current title appears
2. **Given** the user enters a new title and confirms, **When** the task is saved, **Then** the feed shows the new custom title
3. **Given** the task had no existing description, **When** the user renames it, **Then** the task description is set to the original title with a label (e.g., "Original: [original title]")
4. **Given** the task already had a description, **When** the user renames it, **Then** the original title is prepended to the existing description and the existing description content is preserved
5. **Given** the user has renamed a task, **When** they open the task detail, **Then** both the new custom title and the original title (in the description) are visible
6. **Given** a renamed task, **When** the integration re-syncs, **Then** the custom title is retained and NOT overwritten by the synced title
7. **Given** the user wants to undo a rename, **When** they clear the custom title field and save, **Then** the task reverts to displaying its original synced/native title

---

### User Story 2 — Clean Developer Console (Priority: P2)

A developer working on ordrctrl opens the app and sees no recurring errors in the browser console under normal usage. The existing `TypeError: Cannot read properties of null (reading 'id')` that appears on every session is gone.

**Why this priority**: Console noise hides real bugs. This is a code quality and reliability issue — not user-visible, but it degrades developer confidence and makes debugging harder.

**Independent Test**: Open the app in a browser, log in, navigate through the feed and settings, and confirm the developer console shows no recurring uncaught errors during normal use.

**Acceptance Scenarios**:

1. **Given** a user is logged in and on the feed page, **When** the page loads, **Then** no `TypeError: Cannot read properties of null` errors appear in the developer console
2. **Given** a user navigates between pages (feed → settings → feed), **When** each page loads, **Then** no recurring uncaught errors appear in the console
3. **Given** the fix is in place, **When** a real runtime error occurs elsewhere, **Then** it is visible in the console without being masked by noise

---

### User Story 3 — Accurate, Navigable Documentation (Priority: P3)

A new contributor reads the README and CONTRIBUTING guide and comes away with a clear understanding of how to get the project running, how the speckit workflow works, and what the branch naming convention actually is. The architecture diagram is in Mermaid so future changes can be made alongside code changes.

**Why this priority**: Documentation quality directly affects contributor onboarding and long-term maintainability. These are targeted corrections to things that are currently inaccurate or in the wrong place — not new content.

**Independent Test**: Read through README, CONTRIBUTING, docs/development.md, and docs/architecture.md in sequence and verify each addresses its target audience with no duplicated sections and no inaccurate conventions.

**Acceptance Scenarios**:

1. **Given** a new contributor reads CONTRIBUTING.md, **When** they reach the branching section, **Then** they see that branches follow the spec-number format (`NNN-short-name`) as the standard
2. **Given** a developer reads the README, **When** they want to understand the speckit workflow, **Then** they are directed to CONTRIBUTING.md rather than reading a duplicate section in the README
3. **Given** a developer opens docs/development.md, **When** they read the top of the file, **Then** there is no TL;DR section
4. **Given** a developer reads docs/architecture.md, **When** they view the system diagram, **Then** it renders as a proper Mermaid diagram (not a plain-text ASCII block)
5. **Given** an architectural change is made in a future spec, **When** the developer updates docs/architecture.md, **Then** they update Mermaid source directly rather than re-drawing ASCII art

---

### Edge Cases

- What if the user renames a task to the same title it already has? → Save silently with no change; no error shown.
- What if the original title was already prepended from a previous rename? → Prepending is idempotent — check before inserting to avoid duplication.
- What if a synced task's original title is empty? → Skip the "Original:" prepend; just apply the new title.
- What if the console error originates from a third-party browser extension rather than app code? → Document the finding and close the issue with explanation; no code change required if the error is not ours.

---

## Requirements *(mandatory)*

### Functional Requirements

**Task Rename (#49)**

- **FR-001**: Users MUST be able to rename any task (native or synced) from within the feed or task detail view
- **FR-002**: When a task is renamed, the system MUST preserve the original title in the task's description field
- **FR-003**: If the task already has a description, the original title MUST be prepended to the existing description (not replace it)
- **FR-004**: The custom title MUST persist across integration re-syncs — synced title updates MUST NOT overwrite a user-set custom title
- **FR-005**: Users MUST be able to revert a rename by clearing the custom title field
- **FR-006**: The rename action MUST be available on both native tasks and synced tasks

**Console Error Fix (#48)**

- **FR-007**: The recurring `TypeError: Cannot read properties of null (reading 'id')` MUST be investigated and its origin documented. *(Resolved: confirmed as Fetch browser extension artifact from `content.js` — not app code.)*
- **FR-008**: If the error is determined to originate outside app code (e.g., a browser extension), the issue MUST be documented with a clear explanation and may be closed without a code change. *(Resolved: documented in `docs/development.md` § "Known browser noise".)*

**Documentation Polish (#58)**

- **FR-009**: CONTRIBUTING.md MUST document the spec-numbered branch convention (`NNN-short-name`) as the standard for all feature branches
- **FR-010**: The speckit workflow section MUST exist only in CONTRIBUTING.md; README.md MUST replace any duplicate section with a reference link to CONTRIBUTING.md
- **FR-011**: docs/development.md MUST NOT contain a TL;DR section
- **FR-012**: The system architecture diagram in docs/architecture.md MUST be a Mermaid diagram

### Key Entities

- **Task** (existing entity, modified): Gains an optional `customTitle` field. The feed displays `customTitle` when set, falling back to the original synced or native title. The existing `description` field stores the original title when a rename occurs.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can rename any task and see the new title appear in the feed in under 10 seconds from initiating the action
- **SC-002**: After renaming a task, the original title is visible in the task detail view 100% of the time — no data is discarded
- **SC-003**: After a full re-sync cycle, 100% of renamed tasks retain their custom title
- **SC-004**: Zero recurring uncaught TypeErrors appear in the developer console during a normal session (log in → navigate feed → open settings → log out)
- **SC-005**: A new contributor can read README → CONTRIBUTING in sequence and find the complete speckit workflow and branching convention with zero duplication between the two documents
- **SC-006**: The architecture diagram in docs/architecture.md renders correctly as a Mermaid diagram in GitHub's markdown preview

---

## Assumptions

- The custom title is stored as a `TITLE_OVERRIDE` value in the existing `SyncOverride` table — the same pattern used for `DESCRIPTION_OVERRIDE`. No new table or field on the task record is needed.
- "Rename" is exposed as a menu action on the existing task action sheet/context menu, consistent with existing edit and dismiss actions
- The console error investigation happens first; if confirmed to be a third-party extension issue, SC-004 is satisfied by documenting the finding
- The documentation changes are surgical edits to existing files — no new content is added beyond what is required to satisfy the requirements above

# Feature Specification: Selective Task Import

**Feature Branch**: `003-selective-import`
**Created**: 2026-03-08
**Status**: Draft
**Input**: Selective task import — allow users to choose which tasks to pull from each integration source. Per-integration import filter configuration (set at onboarding, editable later). Gmail: choose labels/filters. Apple Reminders: choose which reminder lists. Microsoft Tasks: choose which task lists or plans. Apple Calendar: choose which calendars. Single toggle to import all items from a source. Supersedes #6.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Configure Import Filters During Integration Onboarding (Priority: P1)

When a user connects a new integration (Gmail, Apple Reminders, Microsoft Tasks, or Apple Calendar), they are immediately presented with the available sub-sources from that integration (labels, lists, calendars, or plans) and can choose which ones to import into their ordrctrl feed. A "Import everything" toggle is available as a fast path. Their selection is saved and takes effect on the first sync.

**Why this priority**: Without any filtering, users connecting active integrations will immediately be overwhelmed by irrelevant items in their feed. This is the primary pain point and the gating issue for the app being genuinely useful at scale.

**Independent Test**: Connect any integration in a fresh account → select a subset of sub-sources → trigger a sync → verify only items from selected sub-sources appear in the feed. No other user story needed.

**Acceptance Scenarios**:

1. **Given** a user connecting Gmail for the first time, **When** the OAuth flow completes, **Then** the user is shown their Gmail labels and can select which ones to import before the first sync runs.
2. **Given** a user who selects 2 of 5 Apple Reminders lists, **When** the first sync runs, **Then** only reminders from the 2 selected lists appear in the feed.
3. **Given** a user who enables "Import everything" toggle, **When** the sync runs, **Then** all items from that integration appear in the feed.
4. **Given** a user who enables "Import everything" and then disables it, **When** they save, **Then** the individual sub-source checkboxes become active and reflect the current import state.
5. **Given** an integration with no sub-sources available (e.g., source API returns empty), **When** the user reaches the filter step, **Then** the "Import everything" toggle is shown as the only option with a message explaining no sub-sources were found.

---

### User Story 2 — Edit Import Filters After Initial Setup (Priority: P2)

A user who has already connected an integration can return to their integration settings at any time and change which sub-sources are imported. Adding a new sub-source causes items from it to appear on the next sync. Removing a sub-source causes existing items from it to stop appearing in the feed (they are not retroactively deleted — they simply won't be refreshed).

**Why this priority**: User needs change over time — new lists get created, projects wrap up, inboxes evolve. Without this, the initial selection becomes permanent friction. Editable filters are essential for long-term usability, but the app still delivers value with P1 only.

**Independent Test**: Connect an integration with P1 flow → select subset A → sync → verify only subset A items appear → change selection to subset B → sync → verify only subset B items appear. No new integration connection needed.

**Acceptance Scenarios**:

1. **Given** a user with a connected Gmail integration importing "Work" and "Receipts" labels, **When** they navigate to integration settings and deselect "Receipts", **Then** Gmail items from "Receipts" no longer appear in the feed after the next sync.
2. **Given** a user who adds a new Apple Reminders list to their import selection, **When** the next sync runs, **Then** items from that newly added list appear in the feed.
3. **Given** a user who removes all sub-source selections and does not enable "Import everything", **When** they try to save, **Then** they see a validation message requiring at least one selection before saving.
4. **Given** a user who had previously imported items from a list they now deselect, **When** they view the feed, **Then** those previously imported items remain visible until they naturally expire (they are not forcibly removed).

---

### User Story 3 — "Import Everything" Quick Toggle Per Integration (Priority: P3)

A user who doesn't want fine-grained control can enable a single "Import everything" toggle per integration to pull all items from that source without selecting individual sub-sources. This is the default state when an integration is first connected.

**Why this priority**: Some users have simple setups or trust all sub-sources. The toggle is a quality-of-life improvement but not blocking — users can always manually check all sub-sources to achieve the same result.

**Independent Test**: Connect an integration → leave "Import everything" enabled (default) → verify all items from the integration appear in the feed without needing to select sub-sources.

**Acceptance Scenarios**:

1. **Given** a newly connected integration, **When** the user reaches the import filter step, **Then** "Import everything" is enabled by default and all sub-source checkboxes are pre-selected/disabled.
2. **Given** a user with "Import everything" enabled for Microsoft Tasks, **When** a new plan is added to their Microsoft account, **Then** items from the new plan appear in the feed on the next sync without the user needing to update their settings.
3. **Given** a user who disables "Import everything" for Apple Calendar, **When** the selection screen appears, **Then** all previously imported calendars remain checked so the user can deselect specific ones.

---

### Edge Cases

- What happens when a sub-source (list, label, calendar) is deleted from the source system after it has been selected for import? The integration settings should gracefully indicate the sub-source is no longer available and treat it as deselected on the next sync.
- What happens if fetching available sub-sources from the integration API fails during onboarding? The user is shown an error with a retry option; "Import everything" is offered as a fallback so onboarding can still complete.
- What happens when a user has 50+ labels in Gmail? The selection UI must be scrollable and searchable; no hard limit on sub-source count.
- What happens if a user saves import settings but the integration credentials have expired? The settings are saved; the user is prompted to re-authenticate before the next sync runs.
- What happens when a user removes an integration entirely? All import filter settings for that integration are deleted along with the integration record.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When connecting an integration, the system MUST fetch and display the available sub-sources (labels, lists, calendars, plans) from that integration before the first sync runs.
- **FR-002**: Users MUST be able to select one or more sub-sources per integration to limit what is imported into the feed.
- **FR-003**: Each integration MUST offer an "Import everything" toggle that, when enabled, imports all items from that integration regardless of sub-source.
- **FR-004**: "Import everything" MUST be the default state when an integration is first connected.
- **FR-005**: When "Import everything" is disabled, the system MUST show individual sub-source checkboxes for that integration.
- **FR-006**: Import filter settings MUST persist across sessions and survive app reloads.
- **FR-007**: Users MUST be able to edit import filter settings for any connected integration at any time from integration settings.
- **FR-008**: The system MUST re-evaluate import filters on every sync cycle — only items from currently selected sub-sources are refreshed into the feed.
- **FR-009**: Removing a sub-source from the import selection MUST NOT retroactively delete previously imported items; those items simply stop being refreshed after their TTL expires.
- **FR-010**: The system MUST prevent saving import settings with zero sub-sources selected and "Import everything" disabled; at least one sub-source or the toggle must be active.
- **FR-011**: If fetching available sub-sources fails during onboarding, the system MUST offer "Import everything" as a fallback so the user can complete integration setup.
- **FR-012**: Sub-source selection UI MUST be scrollable and support text search when an integration has more than 10 sub-sources.
- **FR-013**: When a sub-source that was previously selected no longer exists in the source system, the system MUST gracefully ignore it on sync (no error) and indicate in settings that it is unavailable.

### Key Entities

- **Integration Import Filter**: Represents the user's import preferences for a single connected integration. Belongs to an Integration. Contains: the "import everything" flag and a list of selected sub-source identifiers. Updated by the user at any time.
- **Sub-source**: A logical grouping within an integration (Gmail label, Reminders list, Tasks plan, Calendar). Has a stable external identifier and a display name. Fetched live from the integration source; not permanently stored — only the user's selection (by identifier) is persisted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete import filter configuration for a new integration in under 2 minutes from the point the OAuth/connection flow completes.
- **SC-002**: 100% of items appearing in the feed after a sync belong to a sub-source the user has selected (or "Import everything" is enabled) — zero items from deselected sub-sources appear.
- **SC-003**: Changes to import filter settings take effect within one sync cycle (no more than 15 minutes, matching the existing auto-sync interval).
- **SC-004**: Users with "Import everything" enabled experience no change to their existing sync behavior — the feature is additive and non-breaking for users who don't configure filters.
- **SC-005**: Import filter settings survive integration re-authentication — users do not lose their selections when refreshing OAuth credentials.

## Assumptions

- Each integration source exposes a way to enumerate sub-sources before syncing (Gmail labels API, Reminders lists, Tasks plans, Calendar list). If an integration does not support sub-source enumeration, "Import everything" is the only option for that integration.
- Sub-sources are identified by a stable external ID from the source system (not just display name), so renames don't break selections.
- This feature supersedes issue #6 (Gmail-only fine-grained filters) — the per-integration filter model covers Gmail as a specific case.
- The existing sync TTL behavior (24h expiry on `SyncCacheItem`) naturally handles removal of deselected items without requiring an active deletion step.
- Apple Calendar events are included in scope even though they are non-task items — "selective import" applies uniformly to all item types from each integration.
- Two-way sync (issue #10) is explicitly out of scope for this feature. The `SyncOverride` model from `002-uncheck-completed` is unchanged.
- Onboarding flow changes are limited to adding a filter selection step after the existing OAuth/connection step — the overall onboarding structure is not redesigned here.

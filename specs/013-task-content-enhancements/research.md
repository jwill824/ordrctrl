# Research: Task Content Enhancements

**Branch**: `013-task-content-enhancements` | **Feature**: #44 description overrides + #38 source links  
**Status**: Complete — all NEEDS CLARIFICATION resolved

---

## 1. DESCRIPTION_OVERRIDE Storage Approach

### Question
Where should the user-authored description override live: extend `SyncOverride` with a `value`
column, create a new `DescriptionOverride` table, or store it as a field directly on
`SyncCacheItem`?

### Decision
**Extend `SyncOverride` with an optional `value TEXT` column** and add `DESCRIPTION_OVERRIDE` to
the `OverrideType` enum.

### Rationale
The existing `SyncOverride` table already expresses "a user-authored mutation layered on top of a
synced item." The `DISMISSED` and `REOPENED` entries use a flag-only pattern (no value payload);
`DUE_DATE_OVERRIDE` stores a date in a separate column. `DESCRIPTION_OVERRIDE` follows the same
pattern: one new enum member + one nullable `value TEXT` column shared across all override types
that carry a payload. The unique constraint `(syncCacheItemId, overrideType)` naturally enforces
one description override per item.

The `buildFeed` service already joins `syncOverrides` when assembling `FeedItem`; adding
`DESCRIPTION_OVERRIDE` lookup to that join adds zero new queries.

### Alternatives Considered

| Alternative | Rejected because |
|---|---|
| New `DescriptionOverride` table | Extra table, extra join, and a new access pattern for a concept that is logically identical to existing override types. Violates Constitution V (unnecessary complexity). |
| Add `userDescription TEXT` column on `SyncCacheItem` | Conflates user-authored data with integration-sourced cache data; makes the TTL / cascade semantics ambiguous. Constitution III discourages storing user-authored content on the sync cache row itself. |
| Store in `rawPayload` JSON | `rawPayload` is intentionally opaque and "never exposed in API responses" — it cannot safely carry user-authored data that must survive structured queries. |

---

## 2. Source Link Open Strategy

### Question
How should the frontend open a task's source URL — `window.open`, a plain `<a>` tag, or custom
OS protocol handlers?

### Decision
**`<a href={sourceUrl} target="_blank" rel="noopener noreferrer">` rendered as a button-styled
link.** No `window.open` call; no custom protocol handler logic.

### Rationale
- `<a target="_blank">` is the simplest approach; the browser delegates to the OS URL handler
  automatically, enabling Gmail deep-links (`https://mail.google.com/...`), To Do web links, and
  `webcal://` / `x-apple-reminder://` URIs where the OS has a registered handler.
- `window.open` adds no benefit over `<a>` for external URLs and triggers popup blockers on
  mobile browsers more aggressively.
- Implementing custom protocol detection (e.g., sniffing `mailto:` vs `https://`) is premature
  per Constitution V — the plain `<a>` approach handles every integration that supplies a valid
  URL without per-integration branching in the frontend.
- `rel="noopener noreferrer"` prevents the opened page from accessing `window.opener`, closing
  a common cross-origin reference leak.

### Alternatives Considered

| Alternative | Rejected because |
|---|---|
| `window.open(url, '_blank')` | Functionally equivalent to `<a target="_blank">` but bypasses the browser's native link handling and is more likely to be blocked by popup blockers. |
| Per-integration deep-link construction | Overly complex, brittle (integration URL formats change), and unnecessary — adapters already populate the `url` field with the correct deep-link at sync time. |
| Navigator Share API | Mobile-only, not universally supported, and opens a share sheet rather than navigating to the source item. |

---

## 3. Description Field Length & Sanitization

### Question
Should the description override enforce a character limit? Does user input need sanitization
before storage?

### Decision
**No hard character limit enforced in the database** (Postgres `TEXT` is unbounded). The API
validates that the value is a non-empty string when setting and `null` when clearing. The
frontend renders the value as plain text — no HTML or markdown interpretation — so XSS
sanitization beyond standard React escaping is not required.

### Rationale
- The spec explicitly states: "no hard character limit is imposed, but the UI may truncate
  display with a scroll/expand affordance." Imposing a `VARCHAR(N)` would contradict the spec.
- Because the description is rendered via React's default text-node rendering (not
  `dangerouslySetInnerHTML`), stored HTML or script tags appear as literal text and pose no XSS
  risk.
- Backend sanitization (strip tags, trim whitespace) is still applied at the API layer as a
  defensive measure: leading/trailing whitespace is trimmed; the value is stored verbatim
  otherwise.
- The `SyncOverride.value` column is `TEXT` (Postgres), so very long inputs are stored without
  truncation. The API does enforce a soft maximum of **50 000 characters** to prevent obviously
  abusive payloads; this is well above any realistic use case and can be raised without a
  migration.

### Alternatives Considered

| Alternative | Rejected because |
|---|---|
| `VARCHAR(1000)` hard limit | Contradicts spec requirement; adds a migration if the limit needs to be raised. |
| Rich-text / markdown support | Explicitly out of scope per spec ("a single text area (no rich-text formatting) is sufficient"). |
| Server-side HTML sanitization library | Adds a dependency for a problem that React's default rendering already prevents. Constitution V: prefer the simpler approach. |

---

## 4. Per-Integration Label Mapping

### Question
Where should the per-integration "Open in X" label live — frontend constants, backend API
response, or a shared config package?

### Decision
**Frontend-only constant map** keyed by `serviceId`. The backend does not need to know about
display labels.

### Rationale
- The `serviceId` is already present on every `FeedItem` response (`"gmail"`, `"microsoft_tasks"`,
  `"apple_calendar"`, `"apple_reminders"`). The frontend can derive the label from it without a
  new API field.
- Labels are UI copy — they belong in the presentation layer. Storing them in the backend would
  require a new migration or config table just to serve static strings to one client.
- The mapping is small, stable, and shared between `FeedItem` and `EditTaskModal` components,
  making a single `INTEGRATION_LABELS` constant in a shared utility file the correct home.

### Label Map

```ts
// frontend/src/lib/integrationLabels.ts
export const SOURCE_LINK_LABELS: Record<string, string> = {
  gmail:            'Open in Gmail',
  microsoft_tasks:  'Open in To Do',
  apple_calendar:   'Open in Calendar',
  apple_reminders:  'Open in Reminders',
};
```

### Alternatives Considered

| Alternative | Rejected because |
|---|---|
| Backend `sourceLabel` field in FeedItem | The backend would have to know about UI copy for one client. Violates separation of concerns and adds a field to every feed response. |
| i18n / translation system | Premature — the app currently has no i18n infrastructure, and labels for these four integrations are stable English strings. |
| Per-component hard-coded strings | Duplication risk; the label would need to be kept in sync across `FeedItem.tsx` and `EditTaskModal.tsx`. A shared constant eliminates that. |

---

## 5. `SyncCacheItem.body` Retention & Privacy

### Question
Is storing the integration body text in `SyncCacheItem.body` compliant with Constitution III
("raw email content MUST NOT be persisted beyond a short-lived sync cache")?

### Decision
**Yes — `body` on `SyncCacheItem` is within the existing sync-cache exception.** The column
inherits the same 24-hour TTL (`expiresAt`) and cascade-delete semantics as the rest of the row.
This is documented in the plan's Complexity Tracking table.

### Rationale
The constitution permits storage in "a short-lived sync cache necessary for rendering the
consolidated view." `SyncCacheItem` already stores `title`, `dueAt`, and `rawPayload` under
this exception. Adding `body` extends that same cache entry — it does not introduce a new
long-lived store. The user-authored description override (`SyncOverride.value`) contains no raw
integration content.

---

## Summary of All Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Override storage | Extend `SyncOverride` with `value TEXT` + `DESCRIPTION_OVERRIDE` enum value |
| 2 | Source link open | `<a target="_blank" rel="noopener noreferrer">` |
| 3 | Description length | No DB limit; API soft cap 50 000 chars; React plain-text rendering (no sanitization lib needed) |
| 4 | Label mapping | Frontend constant map keyed by `serviceId` |
| 5 | Body storage privacy | Permitted under existing sync-cache exception (24 h TTL, cascade-delete) |

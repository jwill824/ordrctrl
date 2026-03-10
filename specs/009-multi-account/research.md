# Research: Multi-Account Support (009)

## Decision 1: How to remove the `@@unique([userId, serviceId])` constraint

**Decision**: Drop `@@unique([userId, serviceId])` and replace it with `@@unique([userId, serviceId, accountIdentifier])` where `accountIdentifier` is the external account's stable ID (email address or provider user ID).

**Rationale**: The unique constraint currently enforces one integration per user per service. To allow multiple accounts, the uniqueness must include the account identity. Email address is the most human-readable and universally available identifier — every OAuth provider returns it in the token response (`id_token` claims for Google, `/me` endpoint for Microsoft). This gives us:
- Deduplication: prevents the same account being added twice (`(userId, serviceId, accountIdentifier)` is unique)
- Migration safety: existing rows need their `accountIdentifier` backfilled from the token

**Alternatives considered**:
- Remove unique constraint entirely and deduplicate in application logic: Rejected — DB constraint is the safer guarantee against race conditions.
- Use a provider-specific user ID (Google's `sub` claim): Acceptable, but less human-readable in logs/debugging. Email is more intuitive and universally available.
- Composite key on `(userId, serviceId, label)`: Rejected — labels are user-mutable, making them a poor deduplication key.

---

## Decision 2: How to retrieve the account identifier during OAuth

**Decision**: Each adapter's `connect()` method MUST fetch the account identifier during token exchange and include it in the Integration record. For Gmail/Google, parse the `id_token` (JWT) for `email`. For Microsoft, call the `/v1.0/me` endpoint to get `mail`. For Apple Calendar, use the provided email credential.

**Rationale**: This information is available immediately during the OAuth handshake at no extra cost. Storing it at connect time avoids a later lookup. The `id_token` for Google and the `/me` endpoint for Microsoft are already used in similar OAuth flows across the industry.

**Alternatives considered**:
- Fetch account email lazily on first sync: Rejected — creates a window where `accountIdentifier` is null, breaking uniqueness enforcement.
- Ask the user to type their email manually: Rejected — error-prone and terrible UX when we can retrieve it automatically.

---

## Decision 3: Frontend grouping — how to show multiple accounts per service

**Decision**: The integration settings page groups accounts by `serviceId` in a single card. When a service has multiple accounts, the card lists each account as a row within it. A permanent "Add account" action appears on the card (up to the 5-account limit).

**Rationale**: This matches the mental model in apps like Spark Mail and Mimestream, where one "Gmail" section shows multiple addresses. It avoids UI fragmentation (one card per service is cleaner than duplicated service cards). The `useIntegrations` hook must be updated to return accounts grouped by serviceId.

**Alternatives considered**:
- Show a separate card per account (e.g., two Gmail cards): Rejected — violates minimalism principle; doubles the visual noise for existing single-account users.
- Show accounts in a drawer or modal: Considered but adds navigation complexity. Inline expansion of the existing card is sufficient.

---

## Decision 4: How to label accounts in the feed

**Decision**: The feed item's `source` field currently shows `SERVICE_DISPLAY_NAMES[serviceId]`. For multi-account services, this becomes `integration.label ?? integration.accountIdentifier` (e.g., "personal@gmail.com" or "Work"). The service display name is surfaced separately as the group/badge (e.g., a Gmail icon) rather than as the primary label.

**Rationale**: When two Gmail accounts are connected, "Gmail" is not a useful label — users need the account identity. The email address is the natural default. This approach has no breaking change for single-account users: they continue to see the service name in the badge, plus the email if they want it.

**Alternatives considered**:
- Always show the service name in `source`, add a secondary `accountLabel` field to FeedItem: Viable, but adds a new field to the FeedItem contract. Preferred to update `source` since the field already exists and is already shown in the UI.
- Only show the custom nickname when set, otherwise just show service name: Rejected — with two accounts both showing "Gmail", there's no differentiation.

---

## Decision 5: Where to store per-account label (nickname)

**Decision**: Add a `label` field (`String?`) to the `Integration` model. Null means "use `accountIdentifier` as display name." Users can set a nickname via `PATCH /api/integrations/:integrationId/label`. The label is capped at 50 characters.

**Rationale**: The label is an account-level property, not a service-level one. Since each account is already an `Integration` row, the field belongs there. This avoids a separate `AccountLabel` table.

**Alternatives considered**:
- Store label in `settings Json?` on User: Rejected — this is account-specific data, not a user-global setting. Storing it on Integration is the correct entity.
- Use `selectedSubSourceIds` as a proxy for label: Obviously wrong — different purpose.

---

## Decision 6: How to handle the P3 pause feature

**Decision**: Add a `paused Boolean @default(false)` field to `Integration`. The sync scheduler and manual sync trigger skip integrations where `paused = true`. A paused account retains its cached items but receives no new ones.

**Rationale**: Pause is a soft stop — the account stays connected, tokens are not revoked, and re-enabling is instant (just flip the flag and queue a sync). This is strictly less destructive than disconnect. The implementation is minimal: one boolean + one WHERE clause addition.

**Alternatives considered**:
- Implement pause as a separate `IntegrationStatus` enum value (e.g., `paused`): Would work but the `status` enum is used for connection health (connected/error/disconnected). Mixing pause state with health state adds confusion. A separate boolean is cleaner.

---

## Decision 7: Import filter (FR-011) — defer or implement per account?

**Decision**: Import filter stays per-account (it already is, since it lives on the `Integration` row). No migration needed — each account's `importEverything`/`selectedSubSourceIds` is already independent. FR-011 is satisfied by the existing data model, requiring only UI changes to surface the per-account filter UI for each account row.

**Rationale**: The filter is already stored on `Integration`, not on a service-level entity. Multi-account does not change this architecture — it just means multiple Integration rows per service, each with independent filter settings. This is a design win that requires no backend change for the filter itself.

---

## Decision 8: Migration strategy for existing rows

**Decision**: Write a Prisma migration that:
1. Adds `accountIdentifier String?` and `label String?` and `paused Boolean @default(false)` with nullable/default.
2. Backfills `accountIdentifier` using a data migration step that reads the stored encrypted token, decrypts it, and extracts the email. If decryption fails or email is unavailable, sets a placeholder (`unknown@<serviceId>`).
3. After backfill, sets `accountIdentifier` to `NOT NULL` with a new `@@unique([userId, serviceId, accountIdentifier])` constraint and removes the old `@@unique([userId, serviceId])`.

**Rationale**: Existing users must not lose their connections. A zero-downtime migration path requires nullable → backfill → not-null promotion. The backfill can be done in the migration script since we have access to the encryption key at migration time.

**Alternatives considered**:
- Skip backfill, set `accountIdentifier = "legacy"` for old rows: Quick but leaves stale data that may surface confusingly in the UI. Email backfill is more user-friendly.
- Require users to reconnect: Rejected — unacceptable UX regression for existing users.

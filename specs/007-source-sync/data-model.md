# Data Model: Inbound Source Sync (007)

## Schema Changes

### New Enum: GmailCompletionMode

```prisma
enum GmailCompletionMode {
  inbox_removal   // Default: email no longer in inbox = complete (zero-inbox)
  read            // Alternative: email marked as read = complete
}
```

---

### Modified: Integration model

Add one optional field:

```prisma
// New field (add after gmailSyncMode)
gmailCompletionMode  GmailCompletionMode?   // null = default (inbox_removal)
```

Full updated model reference fields (Gmail-specific config block):
```prisma
gmailSyncMode         GmailSyncMode?
gmailCompletionMode   GmailCompletionMode?  // NEW
calendarEventWindowDays Int @default(30)
```

---

### Modified: SyncCacheItem model

Add one new field:

```prisma
// New field (add after completedAt)
completedAtSource  Boolean  @default(false)
```

Updated completion-related fields:
```prisma
completedInOrdrctrl  Boolean   @default(false)   // user's local state (never overwritten by sync)
completedAt          DateTime?                    // when locally completed
completedAtSource    Boolean   @default(false)    // NEW: source system's completion state
```

Add a new index for efficient source-completion queries:
```prisma
@@index([integrationId, completedAtSource])   // NEW: for source completion apply queries
```

---

### Modified: NormalizedItem interface (TypeScript)

```typescript
export interface NormalizedItem {
  externalId: string;
  itemType: 'task' | 'event' | 'message';
  title: string;
  dueAt: Date | null;
  startAt: Date | null;
  endAt: Date | null;
  subSourceId?: string;
  rawPayload: Record<string, unknown>;
  completed?: boolean;    // NEW: optional; undefined = not reported by adapter
}
```

---

## Entity Relationships

No new entities or relations. All changes are additive fields on existing models.

```
Integration (1) ──── (many) SyncCacheItem
                               │
                               └── (many) SyncOverride
                                     overrideType: REOPENED | DISMISSED
```

**Override resolution rules (unchanged from spec 002, extended here):**

| completedAtSource | SyncOverride(REOPENED) exists? | Result |
|-------------------|-------------------------------|--------|
| false             | —                             | No change to completedInOrdrctrl |
| true              | No                            | Set completedInOrdrctrl = true |
| true              | Yes                           | No change — override wins |

---

## State Transitions

### SyncCacheItem completion state machine

```
[created: completedInOrdrctrl=false, completedAtSource=false]
        │
        ├── Source marks complete (next sync)
        │   completedAtSource = true
        │        │
        │        ├── No REOPENED override → completedInOrdrctrl = true  [SOURCE COMPLETED]
        │        └── REOPENED override exists → no change                [OVERRIDE WINS]
        │
        ├── User completes in ordrctrl
        │   completedInOrdrctrl = true, completedAt = now()             [USER COMPLETED]
        │        │
        │        └── Clears REOPENED override if present
        │
        └── User uncompletes in ordrctrl (spec 002)
            completedInOrdrctrl = false
            Creates REOPENED override                                    [USER REOPENED]
```

### Gmail completion detection flow

```
Sync runs for Gmail integration
        │
        ├── gmailCompletionMode == 'inbox_removal' (default)
        │   Query: is:unread (or is:starred is:unread)
        │   After upsert: items in cache NOT in results → completedAtSource = true
        │
        └── gmailCompletionMode == 'read'
            Query: in:inbox (all inbox messages, limited)
            Items where UNREAD not in labelIds → NormalizedItem.completed = true
            Items where UNREAD in labelIds → NormalizedItem.completed = false
```

---

## Migration Plan

Single migration:
1. Add `GmailCompletionMode` enum
2. Add `gmailCompletionMode` column to `Integration` (nullable, no default needed — null = use inbox_removal)
3. Add `completedAtSource` column to `SyncCacheItem` with `@default(false)`
4. Add index on `[integrationId, completedAtSource]`

Existing data: all `completedAtSource` values default to `false` — no backfill needed.

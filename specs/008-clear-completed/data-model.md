# Data Model: Clear Completed Tasks

**Branch**: `008-clear-completed` | **Date**: 2026-03-10

## P1 Schema Changes — None

The P1 implementation (manual bulk clear) reuses the existing dismiss mechanism entirely:
- `SyncOverride` records with `overrideType: 'DISMISSED'` for sync-backed items
- `NativeTask.dismissed = true` flag for native tasks

No migrations are required for P1.

## P2 Schema Change — User Settings Column

To support the auto-clear window preference, a `settings` JSON column is added to `User`.

### Updated User Model

```prisma
model User {
  id                  String    @id @default(uuid())
  email               String    @unique
  passwordHash        String?
  authProvider        AuthProvider
  providerAccountId   String?
  emailVerified       Boolean   @default(false)
  emailVerifyToken    String?
  passwordResetToken  String?
  passwordResetExpiry DateTime?
  loginAttempts       Int       @default(0)
  lockedUntil         DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  settings            Json?     // user-level preferences, e.g. { autoClearWindowDays: 7 }

  integrations  Integration[]
  nativeTasks   NativeTask[]
  syncOverrides SyncOverride[]
}
```

### Settings JSON Schema

```typescript
interface UserSettings {
  autoClearWindowDays?: number | null; // null or absent = auto-clear disabled
}
```

**Valid values for `autoClearWindowDays`**: `1`, `3`, `7`, `30`, or `null` (disabled, default).

## State Transitions

### Manual Clear (P1)

```
Completed (SyncCacheItem.completedInOrdrctrl = true)
    ↓ POST /api/feed/completed/clear
Dismissed (SyncOverride.overrideType = 'DISMISSED')
    ↓ DELETE /api/feed/items/:itemId/dismiss (per item, existing endpoint)
Active again (SyncOverride deleted)
```

```
Completed (NativeTask.completed = true, dismissed = false)
    ↓ POST /api/feed/completed/clear
Dismissed (NativeTask.dismissed = true)
    ↓ DELETE /api/feed/items/:itemId/dismiss (existing endpoint)
Active again (NativeTask.dismissed = false)
```

### Auto-Clear (P2)

```
Completed (completedAt < now() - autoClearWindowDays * 86400s)
    ↓ Sync cycle post-step (clearExpiredCompleted)
Dismissed (same SyncOverride / dismissed flag as manual clear)
```

## Eligibility Rules

A completed item is eligible for clearing if ALL of the following are true:

| Rule | Sync Item | Native Item |
|------|-----------|-------------|
| Completed | `completedInOrdrctrl = true` | `completed = true` |
| Not already dismissed | No `SyncOverride(DISMISSED)` exists | `dismissed = false` |
| Not reopened | No `SyncOverride(REOPENED)` exists | N/A (no concept) |

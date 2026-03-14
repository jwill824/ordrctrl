# Contract: Local Notification Payload Schema

**Feature**: 015-native-app-targets  
**Version**: 1.0

---

## Overview

Local notifications are generated entirely on-device by the frontend's `NotificationService`. No backend push endpoint is involved. This contract defines the canonical payload passed to `NotificationService.schedule()`, which dispatches to the appropriate platform plugin.

---

## TypeScript Interface

```typescript
// frontend/src/plugins/notifications.ts

export interface NotificationPayload {
  /** 
   * Unique numeric ID. Capacitor uses integers for notification identity.
   * Collisions overwrite the previous notification with the same ID.
   * Convention: use a stable hash of the source item ID.
   * Range: 1–2147483647
   */
  id: number;

  /** Short title. Displayed in bold. Max ~50 chars (OS will truncate). */
  title: string;

  /**
   * Body text. Max ~100 chars (OS will truncate on lock screen).
   * Should describe the event concisely without the need for context.
   */
  body: string;

  /**
   * Deep link URL for navigation when the notification is tapped.
   * Must be a valid `ordrctrl://` deep link (see deep-link-scheme.md).
   * Examples: "ordrctrl://feed", "ordrctrl://inbox"
   */
  actionUrl: string;

  /**
   * Optional future delivery time. If absent or in the past, delivers immediately.
   * ISO 8601 string or Date object.
   */
  scheduledAt?: Date | string;

  /**
   * Optional thread/group key for notification grouping (iOS: threadIdentifier, 
   * Android: channelId, desktop: no-op).
   * Allowed values: "feed" | "inbox" | "system"
   */
  group?: 'feed' | 'inbox' | 'system';
}
```

---

## Notification Types

### Feed Item Notification

Triggered when new feed items arrive during the feed polling interval.

```typescript
{
  id: stableHash(feedItem.id),   // deterministic ID from source item
  title: 'New items in your feed',
  body: `${count} new item${count > 1 ? 's' : ''} since your last visit`,
  actionUrl: 'ordrctrl://feed',
  group: 'feed',
}
```

### Inbox Message Notification

Triggered when new inbox messages arrive.

```typescript
{
  id: stableHash(inboxItem.id),
  title: 'New message',
  body: truncate(inboxItem.subject, 100),
  actionUrl: 'ordrctrl://inbox',
  group: 'inbox',
}
```

---

## Platform Translation

`NotificationService.schedule(payload)` translates the canonical payload to the platform format:

### Capacitor (`@capacitor/local-notifications`)

```typescript
await LocalNotifications.schedule({
  notifications: [{
    id: payload.id,
    title: payload.title,
    body: payload.body,
    extra: { actionUrl: payload.actionUrl },
    threadIdentifier: payload.group,        // iOS only
    channelId: payload.group ?? 'default',  // Android only
    schedule: payload.scheduledAt
      ? { at: new Date(payload.scheduledAt) }
      : undefined,
  }]
});
```

### Tauri (`@tauri-apps/plugin-notification`)

```typescript
await sendNotification({
  title: payload.title,
  body: payload.body,
  // Tauri desktop: tag used to identify on-click in event listener
  // actionUrl stored in app state, keyed by tag
});
```

> **Tauri limitation**: `tauri-plugin-notification` v2 does not support embedding arbitrary data in notification payloads. The `actionUrl` is stored in a local Map keyed by notification title+body hash; when the `notification-action-performed` event fires, the Map is consulted.

---

## Permission Handling

Before scheduling any notification, `NotificationService` checks and requests permissions:

```
1. Check NativePreferences.notificationsPermissionAsked
2. If false: call platform permission request API → update flag
3. If permission denied: silently skip scheduling (no error to user)
4. If permission granted: proceed with schedule()
```

On web platform: `NotificationService` is a no-op (does not call the browser Notification API — out of scope for this spec).

---

## Constraints

| Constraint | Value | Source |
|-----------|-------|--------|
| Max notifications scheduled at once | 64 (iOS limit) | Capacitor docs |
| Min scheduling interval | 5 seconds in future | iOS requirement |
| Notification ID range | 1–2147483647 | Capacitor requirement (Java int) |
| Max title length | ~50 chars before OS truncation | iOS/Android behaviour |
| Max body length | ~100 chars on lock screen | iOS/Android behaviour |

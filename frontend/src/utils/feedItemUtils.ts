import type { NativeTask } from '@/services/tasks.service';
import type { FeedItem } from '@/services/feed.service';

export function nativeTaskToFeedItem(task: NativeTask): FeedItem {
  return {
    id: `native:${task.id}`,
    source: 'ordrctrl',
    serviceId: 'ordrctrl',
    itemType: 'task',
    title: task.title,
    originalTitle: null,
    hasTitleOverride: false,
    dueAt: task.dueAt,
    startAt: task.startAt,
    endAt: task.endAt,
    completed: task.completed,
    completedAt: task.completedAt,
    isDuplicateSuspect: false,
    dismissed: false,
    hasUserDueAt: false,
    isAllDay: task.isAllDay,
    originalBody: null,
    description: null,
    hasDescriptionOverride: false,
    descriptionOverride: null,
    descriptionUpdatedAt: null,
    sourceUrl: null,
  };
}

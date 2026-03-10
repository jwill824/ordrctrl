// T056 — Feed API service (frontend)

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface FeedItem {
  id: string;
  source: string;
  itemType: 'task' | 'event' | 'message';
  title: string;
  dueAt: string | null;
  startAt: string | null;
  endAt: string | null;
  completed: boolean;
  completedAt: string | null;
  isDuplicateSuspect: boolean;
  isJustReopened?: boolean;
}

export interface SyncStatusEntry {
  status: 'connected' | 'error' | 'disconnected';
  lastSyncAt: string | null;
  error: string | null;
}

export interface FeedResponse {
  items: FeedItem[];
  completed: FeedItem[];
  syncStatus: Record<string, SyncStatusEntry>;
}

// T021 — dismissed item shape
export interface DismissedItem {
  id: string;
  title: string;
  source: string;
  itemType: 'sync' | 'native';
  dismissedAt: string;
}

export interface DismissedItemsResponse {
  items: DismissedItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

export async function fetchFeed(includeCompleted = false): Promise<FeedResponse> {
  const url = `${API_URL}/api/feed${includeCompleted ? '?includeCompleted=true' : ''}`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load feed');
  return res.json();
}

export async function completeItem(itemId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/feed/items/${itemId}/complete`, {
    method: 'PATCH',
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to complete item');
  }
}

export async function uncompleteItem(
  itemId: string
): Promise<{ id: string; completed: false; completedAt: null; isLocalOverride: boolean }> {
  const res = await fetch(`${API_URL}/api/feed/items/${itemId}/uncomplete`, {
    method: 'PATCH',
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to reopen item');
  }
  return res.json();
}

// T010 — dismiss a feed item
export async function dismissItem(itemId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/feed/items/${itemId}/dismiss`, {
    method: 'PATCH',
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to dismiss item');
  }
}

// T015 — restore (undo) a dismissed feed item
export async function restoreItem(itemId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/feed/items/${itemId}/dismiss`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to restore item');
  }
}

// T021 — get paginated list of dismissed items
export async function getDismissedItems(params?: {
  limit?: number;
  cursor?: string;
}): Promise<DismissedItemsResponse> {
  const url = new URL(`${API_URL}/api/feed/dismissed`);
  if (params?.limit) url.searchParams.set('limit', String(params.limit));
  if (params?.cursor) url.searchParams.set('cursor', params.cursor);

  const res = await fetch(url.toString(), { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load dismissed items');
  return res.json();
}

export async function triggerSync(): Promise<void> {
  await fetch(`${API_URL}/api/integrations/sync`, {
    method: 'POST',
    credentials: 'include',
  });
}

// T005 — clear all completed tasks (sends them to dismissed items)
export async function clearAllCompleted(): Promise<{ clearedCount: number }> {
  const res = await fetch(`${API_URL}/api/feed/completed/clear`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to clear completed items');
  }
  return res.json();
}

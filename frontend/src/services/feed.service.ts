// T056 — Feed API service (frontend)

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface FeedItem {
  id: string;
  source: string;
  serviceId: string;
  itemType: 'task' | 'event' | 'message';
  title: string;
  dueAt: string | null;
  startAt: string | null;
  endAt: string | null;
  completed: boolean;
  completedAt: string | null;
  isDuplicateSuspect: boolean;
  isJustReopened?: boolean;
  dismissed: boolean;
  hasUserDueAt: boolean;
  // Task content enhancement fields
  originalBody: string | null;
  description: string | null;
  hasDescriptionOverride: boolean;
  descriptionOverride: string | null;
  descriptionUpdatedAt: string | null;
  sourceUrl: string | null;
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

export async function fetchFeed(options: { includeCompleted?: boolean; showDismissed?: boolean } = {}): Promise<FeedResponse> {
  const params = new URLSearchParams();
  if (options.includeCompleted) params.set('includeCompleted', 'true');
  if (options.showDismissed) params.set('showDismissed', 'true');
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_URL}/api/feed${query}`, { credentials: 'include' });
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

export async function permanentDeleteItem(itemId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/feed/items/${itemId}/permanent`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to permanently delete item');
  }
}

export async function setUserDueAt(itemId: string, dueAt: string | null): Promise<void> {
  const res = await fetch(`${API_URL}/api/feed/items/${itemId}/user-due-date`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dueAt }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to set due date');
  }
}

export interface SetDescriptionOverrideResult {
  hasDescriptionOverride: boolean;
  descriptionOverride: string | null;
  descriptionUpdatedAt: string | null;
}

export async function setDescriptionOverride(
  itemId: string,
  value: string | null
): Promise<SetDescriptionOverrideResult> {
  const res = await fetch(`${API_URL}/api/feed/items/${itemId}/description-override`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to set description override');
  }
  return res.json();
}

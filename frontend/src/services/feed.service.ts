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

export async function triggerSync(): Promise<void> {
  await fetch(`${API_URL}/api/integrations/sync`, {
    method: 'POST',
    credentials: 'include',
  });
}

// T010 — Inbox API service (frontend)

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export interface InboxItem {
  id: string; // "inbox:<syncCacheItemId>"
  externalId: string;
  title: string;
  itemType: 'task' | 'event' | 'message';
  dueAt?: string;
  startAt?: string;
  endAt?: string;
  syncedAt: string;
  integration: {
    id: string;
    serviceId: string;
    label?: string;
    accountIdentifier: string;
  };
}

export interface InboxGroup {
  integrationId: string;
  serviceId: string;
  accountLabel: string;
  accountIdentifier: string;
  items: InboxItem[];
}

export interface InboxResult {
  groups: InboxGroup[];
  total: number;
}

export async function fetchInbox(): Promise<InboxResult> {
  const res = await fetch(`${API_URL}/api/inbox`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load inbox');
  return res.json();
}

export async function fetchInboxCount(): Promise<number> {
  const res = await fetch(`${API_URL}/api/inbox/count`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load inbox count');
  const data = await res.json();
  return data.count as number;
}

export async function acceptItem(itemId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/inbox/items/${itemId}/accept`, {
    method: 'PATCH',
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.message ?? 'Failed to accept item') as Error & { code?: string };
    err.code = data.code;
    throw err;
  }
}

export async function dismissItem(itemId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/inbox/items/${itemId}/dismiss`, {
    method: 'PATCH',
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.message ?? 'Failed to dismiss item') as Error & { code?: string };
    err.code = data.code;
    throw err;
  }
}

export async function acceptAllItems(integrationId: string): Promise<number> {
  const res = await fetch(`${API_URL}/api/inbox/accept-all`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ integrationId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? 'Failed to accept all items');
  }
  const data = await res.json();
  return data.accepted as number;
}

export async function dismissAllItems(integrationId: string): Promise<number> {
  const res = await fetch(`${API_URL}/api/inbox/dismiss-all`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ integrationId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? 'Failed to dismiss all items');
  }
  const data = await res.json();
  return data.dismissed as number;
}

// T062 — Tasks API service (frontend)

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface NativeTask {
  id: string;
  source: 'ordrctrl';
  itemType: 'task';
  title: string;
  dueAt: string | null;
  startAt: null;
  endAt: null;
  completed: boolean;
  completedAt: string | null;
  isDuplicateSuspect: false;
}

export async function createTask(title: string, dueAt?: string | null): Promise<NativeTask> {
  const res = await fetch(`${API_URL}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ title, dueAt: dueAt ?? null }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to create task');
  }
  return res.json();
}

export async function updateTask(
  id: string,
  fields: { title?: string; dueAt?: string | null }
): Promise<NativeTask> {
  // Strip the "native:" prefix
  const rawId = id.replace('native:', '');
  const res = await fetch(`${API_URL}/api/tasks/${rawId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to update task');
  }
  return res.json();
}

export async function deleteTask(id: string): Promise<void> {
  const rawId = id.replace('native:', '');
  const res = await fetch(`${API_URL}/api/tasks/${rawId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to delete task');
  }
}

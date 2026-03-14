// T045 — Integrations API service (frontend)

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export type ServiceId = 'gmail' | 'microsoft_tasks' | 'apple_calendar';

export interface SubSource {
  id: string;
  label: string;
  type: 'list' | 'calendar' | 'label' | 'folder';
}

export interface IntegrationStatus {
  id: string;
  serviceId: ServiceId;
  accountIdentifier: string;
  label: string | null;
  paused: boolean;
  status: 'connected' | 'error' | 'disconnected';
  lastSyncAt: string | null;
  lastSyncError: string | null;
  gmailSyncMode: 'all_unread' | 'starred_only' | null;
  gmailCompletionMode: 'inbox_removal' | 'read' | null;
  importEverything: boolean;
  selectedSubSourceIds: string[];
  maskedEmail?: string | null;
  calendarEventWindowDays?: number | null;
}

export async function listIntegrations(): Promise<IntegrationStatus[]> {
  const res = await fetch(`${API_URL}/api/integrations`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to load integrations');
  const data = await res.json();
  return data.integrations;
}

export function getConnectUrl(serviceId: ServiceId, syncMode?: string): string {
  const base = `${API_URL}/api/integrations/${serviceId}/connect`;
  if (serviceId === 'gmail' && syncMode) {
    return `${base}?syncMode=${syncMode}`;
  }
  return base;
}

export async function disconnectIntegration(integrationId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/integrations/${integrationId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to disconnect integration');
  }
}

export async function triggerSync(): Promise<void> {
  await fetch(`${API_URL}/api/integrations/sync`, {
    method: 'POST',
    credentials: 'include',
  });
}

export async function listSubSources(integrationId: string): Promise<SubSource[]> {
  const res = await fetch(`${API_URL}/api/integrations/${integrationId}/sub-sources`, {
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to load sub-sources');
  }
  const data = await res.json();
  return data.subSources;
}

export async function updateImportFilter(
  integrationId: string,
  filter: { importEverything: boolean; selectedSubSourceIds: string[] }
): Promise<IntegrationStatus> {
  const res = await fetch(`${API_URL}/api/integrations/${integrationId}/import-filter`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filter),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to update import filter');
  }
  return res.json();
}

export async function connectWithCredentials(
  serviceId: ServiceId,
  email: string,
  password: string,
  calendarEventWindowDays?: number
): Promise<{ integrationId: string }> {
  const body: Record<string, unknown> = { type: 'credential', email, password };
  if (calendarEventWindowDays) body.calendarEventWindowDays = calendarEventWindowDays;
  const res = await fetch(`${API_URL}/api/integrations/${serviceId}/connect`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err: any = new Error((data as any).message || 'Failed to connect');
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function confirmWithExisting(serviceId: ServiceId): Promise<{ integrationId: string }> {
  const res = await fetch(`${API_URL}/api/integrations/${serviceId}/connect`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'use-existing' }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err: any = new Error((data as any).message || 'Failed to connect');
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function updateCalendarEventWindow(integrationId: string, days: 7 | 14 | 30 | 60): Promise<void> {
  const res = await fetch(`${API_URL}/api/integrations/${integrationId}/event-window`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ days }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as any).message || 'Failed to update calendar window');
  }
}

export async function updateGmailSyncMode(integrationId: string, mode: 'all_unread' | 'starred_only'): Promise<void> {
  const res = await fetch(`${API_URL}/api/integrations/${integrationId}/sync-mode`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as any).message || 'Failed to update Gmail sync mode');
  }
}

export async function updateGmailCompletionMode(integrationId: string, mode: 'inbox_removal' | 'read'): Promise<void> {
  const res = await fetch(`${API_URL}/api/integrations/${integrationId}/completion-mode`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as any).message || 'Failed to update Gmail completion mode');
  }
}

export async function updateLabel(integrationId: string, label: string): Promise<{ id: string; label: string | null; accountIdentifier: string }> {
  const res = await fetch(`${API_URL}/api/integrations/${integrationId}/label`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to update label');
  }
  return res.json();
}

export async function pauseIntegration(integrationId: string, paused: boolean): Promise<{ id: string; paused: boolean; status: string }> {
  const res = await fetch(`${API_URL}/api/integrations/${integrationId}/pause`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paused }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to update pause state');
  }
  return res.json();
}

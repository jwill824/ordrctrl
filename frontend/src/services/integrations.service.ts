// T045 — Integrations API service (frontend)

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export type ServiceId = 'gmail' | 'microsoft_tasks' | 'apple_calendar';

export interface SubSource {
  id: string;
  label: string;
  type: 'list' | 'calendar' | 'label' | 'folder';
}

export interface IntegrationStatus {
  serviceId: ServiceId;
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

export async function disconnectIntegration(serviceId: ServiceId): Promise<void> {
  const res = await fetch(`${API_URL}/api/integrations/${serviceId}`, {
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

export async function listSubSources(serviceId: ServiceId): Promise<SubSource[]> {
  const res = await fetch(`${API_URL}/api/integrations/${serviceId}/sub-sources`, {
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
  serviceId: ServiceId,
  filter: { importEverything: boolean; selectedSubSourceIds: string[] }
): Promise<IntegrationStatus> {
  const res = await fetch(`${API_URL}/api/integrations/${serviceId}/import-filter`, {
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

export async function updateCalendarEventWindow(days: 7 | 14 | 30 | 60): Promise<void> {
  const res = await fetch(`${API_URL}/api/integrations/apple_calendar/event-window`, {
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

export async function updateGmailCompletionMode(mode: 'inbox_removal' | 'read'): Promise<void> {
  const res = await fetch(`${API_URL}/api/integrations/gmail/completion-mode`, {
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

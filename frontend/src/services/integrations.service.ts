// T045 — Integrations API service (frontend)

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export type ServiceId = 'gmail' | 'apple_reminders' | 'microsoft_tasks' | 'apple_calendar';

export interface IntegrationStatus {
  serviceId: ServiceId;
  status: 'connected' | 'error' | 'disconnected';
  lastSyncAt: string | null;
  lastSyncError: string | null;
  gmailSyncMode: 'all_unread' | 'starred_only' | null;
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

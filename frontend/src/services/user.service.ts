// T025 — User settings service (frontend)

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface UserSettings {
  autoClearEnabled: boolean;
  autoClearWindowDays: number;
}

export async function getUserSettings(): Promise<UserSettings> {
  const res = await fetch(`${API_URL}/api/user/settings`, { credentials: 'include' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? 'Failed to load settings');
  }
  return res.json();
}

export async function updateUserSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
  const res = await fetch(`${API_URL}/api/user/settings`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? 'Failed to update settings');
  }
  return res.json();
}

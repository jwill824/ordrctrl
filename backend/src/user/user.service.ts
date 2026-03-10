// T019 — UserService: get/update user settings for auto-clear preferences
import { prisma } from '../lib/db.js';

export interface UserSettings {
  autoClearEnabled: boolean;
  autoClearWindowDays: number;
}

const DEFAULTS: UserSettings = {
  autoClearEnabled: false,
  autoClearWindowDays: 7,
};

export async function getUserSettings(userId: string): Promise<UserSettings> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { settings: true } });
  const raw = user.settings as Partial<UserSettings> | null;
  return { ...DEFAULTS, ...raw };
}

export async function updateUserSettings(
  userId: string,
  patch: Partial<UserSettings>
): Promise<UserSettings> {
  const current = await getUserSettings(userId);
  const merged = { ...current, ...patch };
  await prisma.user.update({ where: { id: userId }, data: { settings: merged } });
  return merged;
}

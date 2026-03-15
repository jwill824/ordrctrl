import { redis } from '../lib/redis.js';

export interface OAuthStateEntry {
  platform: 'web' | 'capacitor' | 'tauri';
}

const KEY_PREFIX = 'oauth:state:';
const TTL_SECONDS = 300;

export async function setOAuthState(state: string, entry: OAuthStateEntry): Promise<void> {
  await redis.setex(`${KEY_PREFIX}${state}`, TTL_SECONDS, JSON.stringify(entry));
}

export async function getAndDeleteOAuthState(state: string): Promise<OAuthStateEntry | null> {
  const key = `${KEY_PREFIX}${state}`;
  const data = await redis.get(key);
  if (!data) return null;
  await redis.del(key);
  try {
    return JSON.parse(data) as OAuthStateEntry;
  } catch {
    return null;
  }
}

import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../../src/lib/redis.js', () => ({
  redis: {
    setex: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
  },
}));

import { redis } from '../../../src/lib/redis.js';
import { setOAuthState, getAndDeleteOAuthState } from '../../../src/auth/oauth-state.js';

const mockRedis = redis as any;

describe('oauth-state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('setOAuthState calls redis.setex with correct key, TTL 300, and JSON-stringified entry', async () => {
    const state = 'abc123';
    const entry = { platform: 'capacitor' as const };
    await setOAuthState(state, entry);
    expect(mockRedis.setex).toHaveBeenCalledWith('oauth:state:abc123', 300, JSON.stringify(entry));
  });

  it('getAndDeleteOAuthState calls redis.get then redis.del and returns parsed entry when key exists', async () => {
    const state = 'abc123';
    const entry = { platform: 'web' as const };
    mockRedis.get.mockResolvedValue(JSON.stringify(entry));
    const result = await getAndDeleteOAuthState(state);
    expect(mockRedis.get).toHaveBeenCalledWith('oauth:state:abc123');
    expect(mockRedis.del).toHaveBeenCalledWith('oauth:state:abc123');
    expect(result).toEqual(entry);
  });

  it('getAndDeleteOAuthState returns null when key is missing', async () => {
    mockRedis.get.mockResolvedValue(null);
    const result = await getAndDeleteOAuthState('nonexistent');
    expect(result).toBeNull();
    expect(mockRedis.del).not.toHaveBeenCalled();
  });

  it('getAndDeleteOAuthState returns null and does not throw when Redis returns malformed JSON', async () => {
    mockRedis.get.mockResolvedValue('not-valid-json{{{');
    await expect(getAndDeleteOAuthState('badstate')).resolves.toBeNull();
  });
});

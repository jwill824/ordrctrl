import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listIntegrations,
  getConnectUrl,
  disconnectIntegration,
} from '@/services/integrations.service';

const BASE = 'http://localhost:4000';

describe('integrations.service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('listIntegrations', () => {
    it('fetches from /api/integrations and returns integrations array', async () => {
      const integrations = [{ serviceId: 'gmail', status: 'connected' }];
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ integrations }),
      });
      const result = await listIntegrations();
      expect(global.fetch).toHaveBeenCalledWith(`${BASE}/api/integrations`, {
        credentials: 'include',
      });
      expect(result).toEqual(integrations);
    });

    it('throws on non-ok response', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
      await expect(listIntegrations()).rejects.toThrow('Failed to load integrations');
    });
  });

  describe('getConnectUrl', () => {
    it('returns base connect URL for non-gmail services', () => {
      expect(getConnectUrl('microsoft_tasks')).toBe(
        `${BASE}/api/integrations/microsoft_tasks/connect`
      );
      expect(getConnectUrl('apple_calendar')).toBe(
        `${BASE}/api/integrations/apple_calendar/connect`
      );
    });

    it('appends syncMode for gmail when provided', () => {
      expect(getConnectUrl('gmail', 'starred_only')).toBe(
        `${BASE}/api/integrations/gmail/connect?syncMode=starred_only`
      );
    });

    it('returns base URL for gmail when syncMode is omitted', () => {
      expect(getConnectUrl('gmail')).toBe(`${BASE}/api/integrations/gmail/connect`);
    });
  });

  describe('disconnectIntegration', () => {
    it('sends DELETE to /api/integrations/:serviceId', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      await disconnectIntegration('gmail');
      expect(global.fetch).toHaveBeenCalledWith(`${BASE}/api/integrations/gmail`, {
        method: 'DELETE',
        credentials: 'include',
      });
    });

    it('does not throw on 204 No Content', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 204 });
      await expect(disconnectIntegration('gmail')).resolves.toBeUndefined();
    });

    it('throws with server message on other errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Server error' }),
      });
      await expect(disconnectIntegration('gmail')).rejects.toThrow('Server error');
    });
  });
});

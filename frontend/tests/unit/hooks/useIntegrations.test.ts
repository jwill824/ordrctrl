import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useIntegrations } from '@/hooks/useIntegrations';
import * as integrationsService from '@/services/integrations.service';

vi.mock('@/services/integrations.service');

const mockAccount = {
  id: 'uuid-1',
  serviceId: 'gmail' as const,
  accountIdentifier: 'test@gmail.com',
  label: null,
  paused: false,
  status: 'connected' as const,
  lastSyncAt: null,
  lastSyncError: null,
  gmailSyncMode: 'starred_only' as const,
  gmailCompletionMode: null,
  importEverything: false,
  selectedSubSourceIds: [],
};

describe('useIntegrations', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('starts with loading=true', () => {
    vi.mocked(integrationsService.listIntegrations).mockResolvedValue([]);
    const { result } = renderHook(() => useIntegrations());
    expect(result.current.loading).toBe(true);
  });

  it('loads accounts on mount and clears loading', async () => {
    vi.mocked(integrationsService.listIntegrations).mockResolvedValue([mockAccount]);
    const { result } = renderHook(() => useIntegrations());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allAccounts).toEqual([mockAccount]);
    expect(result.current.error).toBeNull();
  });

  it('groups accounts by serviceId', async () => {
    vi.mocked(integrationsService.listIntegrations).mockResolvedValue([mockAccount]);
    const { result } = renderHook(() => useIntegrations());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.grouped.gmail).toEqual([mockAccount]);
    expect(result.current.grouped.microsoft_tasks).toEqual([]);
    expect(result.current.grouped.apple_calendar).toEqual([]);
  });

  it('sets error message on fetch failure', async () => {
    vi.mocked(integrationsService.listIntegrations).mockRejectedValue(
      new Error('Network error')
    );
    const { result } = renderHook(() => useIntegrations());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Network error');
    expect(result.current.allAccounts).toEqual([]);
  });
});

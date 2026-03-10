import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useIntegrations } from '@/hooks/useIntegrations';
import * as integrationsService from '@/services/integrations.service';

vi.mock('@/services/integrations.service');

const mockIntegration = {
  serviceId: 'gmail' as const,
  status: 'connected' as const,
  lastSyncAt: null,
  lastSyncError: null,
  gmailSyncMode: 'starred_only' as const,
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

  it('loads integrations on mount and clears loading', async () => {
    vi.mocked(integrationsService.listIntegrations).mockResolvedValue([mockIntegration]);
    const { result } = renderHook(() => useIntegrations());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.integrations).toEqual([mockIntegration]);
    expect(result.current.error).toBeNull();
  });

  it('sets error message on fetch failure', async () => {
    vi.mocked(integrationsService.listIntegrations).mockRejectedValue(
      new Error('Network error')
    );
    const { result } = renderHook(() => useIntegrations());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Network error');
    expect(result.current.integrations).toEqual([]);
  });
});

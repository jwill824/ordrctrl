'use client';

import { useState, useEffect, useCallback } from 'react';
import * as integrationsService from '@/services/integrations.service';
import type { IntegrationStatus } from '@/services/integrations.service';

interface UseIntegrationsReturn {
  integrations: IntegrationStatus[];
  loading: boolean;
  error: string | null;
  disconnect: (serviceId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useIntegrations(): UseIntegrationsReturn {
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await integrationsService.listIntegrations();
      setIntegrations(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const disconnect = useCallback(
    async (serviceId: string) => {
      await integrationsService.disconnectIntegration(serviceId as any);
      await refresh();
    },
    [refresh]
  );

  return { integrations, loading, error, disconnect, refresh };
}

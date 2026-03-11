'use client';

import { useState, useEffect, useCallback } from 'react';
import * as integrationsService from '@/services/integrations.service';
import type { IntegrationStatus, ServiceId } from '@/services/integrations.service';

export type GroupedIntegrations = Record<ServiceId, IntegrationStatus[]>;

interface UseIntegrationsReturn {
  grouped: GroupedIntegrations;
  allAccounts: IntegrationStatus[];
  loading: boolean;
  error: string | null;
  disconnect: (integrationId: string) => Promise<void>;
  updateLabel: (integrationId: string, label: string) => Promise<void>;
  pauseAccount: (integrationId: string, paused: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

function groupByService(accounts: IntegrationStatus[]): GroupedIntegrations {
  const result: GroupedIntegrations = {
    gmail: [],
    microsoft_tasks: [],
    apple_calendar: [],
  };
  for (const account of accounts) {
    if (result[account.serviceId]) {
      result[account.serviceId].push(account);
    }
  }
  return result;
}

export function useIntegrations(): UseIntegrationsReturn {
  const [allAccounts, setAllAccounts] = useState<IntegrationStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await integrationsService.listIntegrations();
      setAllAccounts(data);
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

  const disconnect = useCallback(async (integrationId: string) => {
    await integrationsService.disconnectIntegration(integrationId);
    await refresh();
  }, [refresh]);

  const updateLabel = useCallback(async (integrationId: string, label: string) => {
    await integrationsService.updateLabel(integrationId, label);
    await refresh();
  }, [refresh]);

  const pauseAccount = useCallback(async (integrationId: string, paused: boolean) => {
    await integrationsService.pauseIntegration(integrationId, paused);
    await refresh();
  }, [refresh]);

  return {
    grouped: groupByService(allAccounts),
    allAccounts,
    loading,
    error,
    disconnect,
    updateLabel,
    pauseAccount,
    refresh,
  };
}

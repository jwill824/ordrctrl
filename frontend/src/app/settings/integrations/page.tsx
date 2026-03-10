'use client';

// T044 — Integration settings page
// All 4 cards with live status, disconnect and reconnect actions, Gmail sync mode toggle

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { IntegrationCard } from '@/components/integrations/IntegrationCard';
import { SubSourceSelector } from '@/components/integrations/SubSourceSelector';
import { useIntegrations } from '@/hooks/useIntegrations';
import type { ServiceId } from '@/services/integrations.service';
import { updateImportFilter } from '@/services/integrations.service';

const SERVICE_IDS: ServiceId[] = [
  'gmail',
  'apple_calendar',
  'microsoft_tasks',
];

function IntegrationSettingsContent() {
  const { integrations, loading, error, disconnect, refresh } = useIntegrations();
  const searchParams = useSearchParams();
  const [autoOpenServiceId, setAutoOpenServiceId] = useState<ServiceId | null>(null);

  useEffect(() => {
    const connected = searchParams?.get('connected') as ServiceId | null;
    const step = searchParams?.get('step');
    if (connected && step === 'import-filter' && SERVICE_IDS.includes(connected)) {
      setAutoOpenServiceId(connected);
    }
  }, [searchParams]);

  return (
    <>
      {/* Error state */}
      {error && (
        <div className="border-l-2 border-red-500 py-1 pl-3 text-[0.8rem] text-red-600 mb-6">
          {error}
        </div>
      )}

      {/* Integration cards */}
      {loading ? (
        <div className="text-zinc-400 text-sm">Loading…</div>
      ) : (
        <div className="flex flex-col gap-3">
          {SERVICE_IDS.map((serviceId) => {
            const integration = integrations.find((i) => i.serviceId === serviceId);
            const isAutoOpen = autoOpenServiceId === serviceId;
            return (
              <div key={serviceId}>
                <IntegrationCard
                  serviceId={serviceId}
                  status={integration?.status ?? 'disconnected'}
                  lastSyncAt={integration?.lastSyncAt}
                  lastSyncError={integration?.lastSyncError}
                  gmailSyncMode={integration?.gmailSyncMode}
                  gmailCompletionMode={integration?.gmailCompletionMode}
                  importEverything={integration?.importEverything ?? true}
                  selectedSubSourceIds={integration?.selectedSubSourceIds ?? []}
                  onDisconnect={() => disconnect(serviceId)}
                  onRefresh={refresh}
                />
                {/* Auto-open import filter panel for post-OAuth flow */}
                {isAutoOpen && integration?.status === 'connected' && (
                  <SubSourceSelector
                    serviceId={serviceId}
                    importEverything={true}
                    selectedSubSourceIds={[]}
                    onSave={async (filter) => {
                      await updateImportFilter(serviceId, filter);
                      setAutoOpenServiceId(null);
                      refresh?.();
                    }}
                    onCancel={() => setAutoOpenServiceId(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export default function IntegrationSettingsPage() {
  return (
    <main className="min-h-screen bg-white py-8 px-5 max-w-[36rem] mx-auto">
      {/* Nav */}
      <nav className="flex items-center gap-4 mb-10">
        <Link href="/feed" className="text-[0.7rem] text-zinc-400 no-underline tracking-[0.08em]">
          ← Feed
        </Link>
        <span className="text-[0.7rem] font-bold tracking-[0.28em] uppercase text-black">
          ordrctrl
        </span>
      </nav>

      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-black mb-1.5">
          Integrations
        </h1>
        <p className="text-sm text-zinc-500">
          Manage your connected services. Disconnecting removes all cached data.
        </p>
      </div>

      <Suspense fallback={<div className="text-zinc-400 text-sm">Loading…</div>}>
        <IntegrationSettingsContent />
      </Suspense>
    </main>
  );
}

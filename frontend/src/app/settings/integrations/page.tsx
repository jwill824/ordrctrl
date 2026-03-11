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
  const { grouped, loading, error, disconnect, updateLabel, pauseAccount, refresh } = useIntegrations();
  const searchParams = useSearchParams();
  const [autoOpenServiceId, setAutoOpenServiceId] = useState<ServiceId | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);

  useEffect(() => {
    const connected = searchParams?.get('connected') as ServiceId | null;
    const step = searchParams?.get('step');
    const errParam = searchParams?.get('error');
    const serviceId = searchParams?.get('serviceId') as ServiceId | null;

    if (connected && step === 'import-filter' && SERVICE_IDS.includes(connected)) {
      setAutoOpenServiceId(connected);
    }

    if (errParam === 'duplicate_account') {
      const svc = serviceId ? serviceId.replace(/_/g, ' ') : 'service';
      setOauthError(`This account is already connected for ${svc}.`);
    } else if (errParam === 'account_limit_reached') {
      const svc = serviceId ? serviceId.replace(/_/g, ' ') : 'service';
      setOauthError(`Maximum number of accounts reached for ${svc}.`);
    }
  }, [searchParams]);

  return (
    <>
      {/* OAuth error banner */}
      {oauthError && (
        <div className="border-l-2 border-amber-500 py-1 pl-3 text-[0.8rem] text-amber-700 mb-6 flex items-start justify-between">
          <span>{oauthError}</span>
          <button
            type="button"
            onClick={() => setOauthError(null)}
            className="ml-4 text-zinc-400 hover:text-zinc-600 bg-transparent border-0 p-0 cursor-pointer leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Fetch error state */}
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
            const accounts = grouped[serviceId] ?? [];
            const isAutoOpen = autoOpenServiceId === serviceId;
            const primaryAccount = accounts[0];
            return (
              <div key={serviceId}>
                <IntegrationCard
                  serviceId={serviceId}
                  accounts={accounts}
                  onDisconnect={disconnect}
                  onUpdateLabel={updateLabel}
                  onPauseAccount={pauseAccount}
                  onRefresh={refresh}
                />
                {/* Auto-open import filter panel for post-OAuth flow */}
                {isAutoOpen && primaryAccount?.status === 'connected' && primaryAccount?.id && (
                  <SubSourceSelector
                    integrationId={primaryAccount.id}
                    importEverything={true}
                    selectedSubSourceIds={[]}
                    onSave={async (filter) => {
                      await updateImportFilter(primaryAccount.id, filter);
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

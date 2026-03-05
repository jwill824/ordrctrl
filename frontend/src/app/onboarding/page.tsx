'use client';

// T043 — Onboarding page
// Shown when user has no integrations. Tutorial copy + 4 integration cards.

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { IntegrationCard } from '@/components/integrations/IntegrationCard';
import { useIntegrations } from '@/hooks/useIntegrations';
import type { ServiceId } from '@/services/integrations.service';

const SERVICE_IDS: ServiceId[] = [
  'gmail',
  'apple_reminders',
  'microsoft_tasks',
  'apple_calendar',
];

export default function OnboardingPage() {
  const { integrations, loading, refresh } = useIntegrations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [notification, setNotification] = useState<string | null>(null);

  // Handle OAuth callback notifications
  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    const reason = searchParams.get('reason');

    if (connected) {
      setNotification(`✓ ${connected.replace(/_/g, ' ')} connected successfully.`);
      refresh();
    } else if (error) {
      const message =
        reason === 'denied'
          ? 'Authorization was denied. You can try again or choose a different integration.'
          : reason === 'state_mismatch'
          ? 'Security check failed. Please try again.'
          : 'Connection failed. Please try again.';
      setNotification(`Error: ${message}`);
    }
  }, [searchParams, refresh]);

  // Check if any integrations are connected → redirect to feed
  const hasConnected = integrations.some((i) => i.status === 'connected');

  const connectedCount = integrations.filter((i) => i.status === 'connected').length;

  if (!loading && hasConnected && !searchParams.get('error')) {
    // Allow user to proceed even with partial connections
  }

  const isError = notification?.startsWith('Error');

  return (
    <main className="min-h-screen bg-white py-12 px-5 max-w-[36rem] mx-auto">
      {/* Wordmark */}
      <Link href="/" className="text-[0.7rem] font-bold tracking-[0.28em] uppercase text-black mb-12 block no-underline">
        ordrctrl
      </Link>

      {/* Notification banner */}
      {notification && (
        <div className={`border px-4 py-3 mb-6 text-[0.8rem] rounded-none ${isError ? 'bg-red-50 border-red-300 text-red-700' : 'bg-green-50 border-green-300 text-green-700'}`}>
          {notification}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[1.75rem] font-extrabold tracking-[-0.03em] text-black mb-2">
          Connect your services
        </h1>
        <p className="text-sm text-zinc-500">
          ordrctrl pulls tasks, reminders, and events from your existing apps into one
          unified feed — no duplication, no switching tabs. Connect at least one service
          to get started.
        </p>
      </div>

      {/* Integration cards */}
      {loading ? (
        <div className="text-zinc-400 text-sm">Loading…</div>
      ) : (
        <div className="flex flex-col gap-3">
          {SERVICE_IDS.map((serviceId) => {
            const integration = integrations.find((i) => i.serviceId === serviceId);
            return (
              <IntegrationCard
                key={serviceId}
                serviceId={serviceId}
                status={integration?.status ?? 'disconnected'}
                lastSyncAt={integration?.lastSyncAt}
                lastSyncError={integration?.lastSyncError}
                gmailSyncMode={integration?.gmailSyncMode}
                onboardingMode
              />
            );
          })}
        </div>
      )}

      {/* CTA: proceed to feed */}
      {connectedCount > 0 && (
        <div className="mt-8">
          <Link
            href="/feed"
            className="w-full bg-black text-white py-3 px-4 text-[0.7rem] font-bold uppercase tracking-[0.12em] cursor-pointer transition-colors hover:bg-zinc-900 block text-center no-underline"
          >
            Go to my feed →
          </Link>
          <p className="text-center text-xs text-zinc-400 mt-3">
            {connectedCount} of 4 services connected. You can add more in Settings.
          </p>
        </div>
      )}

      {connectedCount === 0 && (
        <p className="mt-6 text-xs text-zinc-400 text-center">
          You can also{' '}
          <Link href="/feed" className="text-black font-semibold no-underline">
            skip for now
          </Link>{' '}
          and create tasks manually.
        </p>
      )}
    </main>
  );
}

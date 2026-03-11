'use client';

// T053 — IntegrationErrorBanner component
// Non-blocking per-integration inline error with re-auth CTA when token refresh failed

import type { SyncStatusEntry } from '@/services/feed.service';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const SERVICE_DISPLAY: Record<string, string> = {
  gmail: 'Gmail',
  apple_calendar: 'Apple Calendar',
  microsoft_tasks: 'Microsoft To Do',
};

interface IntegrationErrorBannerProps {
  syncStatus: Record<string, SyncStatusEntry>;
}

export function IntegrationErrorBanner({ syncStatus }: IntegrationErrorBannerProps) {
  const errorEntries = Object.entries(syncStatus).filter(
    ([, entry]) => entry.status === 'error'
  );

  if (errorEntries.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 mb-4">
      {errorEntries.map(([serviceId, entry]) => (
        <div
          key={serviceId}
          className="flex items-center justify-between gap-3 px-[0.875rem] py-[0.625rem] bg-red-50 border border-red-300 flex-wrap"
        >
          <div className="flex-1 min-w-0">
            <span className="block text-[0.7rem] font-bold uppercase tracking-[0.06em] text-red-600 mb-0.5">
              {SERVICE_DISPLAY[serviceId] ?? serviceId} sync error
            </span>
            <span className="text-[0.8rem] text-red-700">
              {entry.error ?? 'Sync failed. Please reconnect to restore access.'}
            </span>
          </div>
          <a
            href={`${API_URL}/api/integrations/${serviceId}/connect`}
            className="text-[0.7rem] font-bold uppercase tracking-[0.06em] text-red-600 no-underline border border-red-300 px-[0.625rem] py-[0.375rem] flex-shrink-0 whitespace-nowrap"
          >
            Reconnect →
          </a>
        </div>
      ))}
    </div>
  );
}

'use client';

// T041 — IntegrationCard component
import { useState } from 'react';
import { GmailSyncModeSelector } from './GmailSyncModeSelector';
import { GmailCompletionModeSelector } from './GmailCompletionModeSelector';
import { SubSourceSelector } from './SubSourceSelector';
import { AppleCredentialForm } from './AppleCredentialForm';
import { AppleConfirmationScreen } from './AppleConfirmationScreen';
import { getConnectUrl, updateImportFilter, updateCalendarEventWindow, updateGmailCompletionMode, updateGmailSyncMode } from '@/services/integrations.service';
import type { ServiceId, IntegrationStatus } from '@/services/integrations.service';

const SERVICE_META: Record<
  ServiceId,
  { label: string; description: string; icon: React.ReactNode }
> = {
  gmail: {
    label: 'Gmail',
    description: 'Surface starred emails and action items from your inbox.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#EA4335" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.908 1.528-1.147C21.69 2.28 24 3.434 24 5.457z"/>
      </svg>
    ),
  },
  microsoft_tasks: {
    label: 'Microsoft To Do',
    description: 'Pull in tasks from Microsoft To Do and Planner.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#0078d4" aria-hidden="true">
        <path d="M12.75 3a.75.75 0 0 0-1.5 0v.75H3.75A.75.75 0 0 0 3 4.5v15c0 .414.336.75.75.75h16.5a.75.75 0 0 0 .75-.75v-15a.75.75 0 0 0-.75-.75h-7.5V3zm-9 3h16.5v12H3.75V6zM9.53 10.47a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l4.5-4.5a.75.75 0 1 0-1.06-1.06l-3.97 3.97-1.72-1.72z"/>
      </svg>
    ),
  },
  apple_calendar: {
    label: 'Apple Calendar',
    description: 'Show upcoming events from your iCloud calendars.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
      </svg>
    ),
  },
};

interface AccountRowProps {
  account: IntegrationStatus;
  serviceId: ServiceId;
  onDisconnect?: (integrationId: string) => Promise<void>;
  onUpdateLabel?: (integrationId: string, label: string) => Promise<void>;
  onPauseAccount?: (integrationId: string, paused: boolean) => Promise<void>;
  onRefresh?: () => void;
}

function AccountRow({ account, serviceId, onDisconnect, onUpdateLabel, onPauseAccount, onRefresh }: AccountRowProps) {
  const [disconnecting, setDisconnecting] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(account.label ?? '');
  const [savingLabel, setSavingLabel] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [showSyncMode, setShowSyncMode] = useState(false);
  const [syncMode, setSyncMode] = useState<'all_unread' | 'starred_only'>(account.gmailSyncMode ?? 'starred_only');
  const [completionMode, setCompletionMode] = useState<'inbox_removal' | 'read'>(account.gmailCompletionMode ?? 'inbox_removal');

  const displayName = account.label || account.accountIdentifier;

  const statusDot =
    account.status === 'connected'
      ? 'bg-green-500'
      : account.status === 'error'
      ? 'bg-red-500'
      : 'bg-zinc-300';

  const handleDisconnect = async () => {
    if (!onDisconnect) return;
    setDisconnecting(true);
    try {
      await onDisconnect(account.id);
    } finally {
      setDisconnecting(false);
    }
  };

  const handleLabelSave = async () => {
    if (!onUpdateLabel) return;
    setSavingLabel(true);
    try {
      await onUpdateLabel(account.id, labelDraft.trim());
      setEditingLabel(false);
    } finally {
      setSavingLabel(false);
    }
  };

  return (
  <>
    <div className="flex items-center gap-2 py-1.5 border-t border-zinc-100 first:border-t-0">
      <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot}`} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        {editingLabel ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              type="text"
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleLabelSave();
                if (e.key === 'Escape') setEditingLabel(false);
              }}
              placeholder={account.accountIdentifier}
              className="border border-zinc-300 px-1.5 py-0.5 text-xs w-36"
            />
            <button
              type="button"
              onClick={handleLabelSave}
              disabled={savingLabel}
              className="text-[0.65rem] text-blue-600 hover:underline disabled:opacity-50"
            >
              {savingLabel ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setEditingLabel(false)}
              className="text-[0.65rem] text-zinc-400 hover:underline"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { setLabelDraft(account.label ?? ''); setEditingLabel(true); }}
            title="Click to edit label"
            className="text-xs text-zinc-700 truncate max-w-full text-left bg-transparent border-0 p-0 cursor-pointer hover:underline"
          >
            {displayName}
          </button>
        )}
      </div>
      {account.paused && (
        <span className="text-[0.6rem] font-bold uppercase tracking-wide text-amber-600 border border-amber-400 px-1 py-0.5 shrink-0">
          Paused
        </span>
      )}
      {onPauseAccount && (
        <button
          type="button"
          onClick={() => onPauseAccount(account.id, !account.paused)}
          className="text-[0.65rem] text-zinc-400 hover:text-zinc-700 shrink-0"
        >
          {account.paused ? 'Resume' : 'Pause'}
        </button>
      )}
      {onDisconnect && account.status !== 'disconnected' && (
        <button
          type="button"
          disabled={disconnecting}
          onClick={handleDisconnect}
          className="text-[0.65rem] text-red-500 hover:text-red-700 disabled:opacity-40 shrink-0"
        >
          {disconnecting ? '…' : 'Disconnect'}
        </button>
      )}
      {/* Per-account import filter — only for services that support sub-sources */}
      {account.status === 'connected' && serviceId === 'gmail' && (
        <>
          <button
            type="button"
            onClick={() => { setShowSyncMode((v) => !v); setShowFilter(false); }}
            className="text-[0.65rem] text-zinc-400 hover:text-zinc-700 shrink-0"
          >
            Mode
          </button>
          <button
            type="button"
            onClick={() => { setShowFilter((v) => !v); setShowSyncMode(false); }}
            className="text-[0.65rem] text-zinc-400 hover:text-zinc-700 shrink-0"
          >
            Filter
          </button>
        </>
      )}
    </div>
    {showSyncMode && account.status === 'connected' && serviceId === 'gmail' && (
      <div className="mt-1 pl-4 space-y-2">
        <GmailSyncModeSelector
          value={syncMode}
          onChange={async (mode) => {
            setSyncMode(mode);
            await updateGmailSyncMode(account.id, mode).catch(() => {});
            onRefresh?.();
          }}
        />
        <GmailCompletionModeSelector
          value={completionMode}
          onChange={async (mode) => {
            setCompletionMode(mode);
            await updateGmailCompletionMode(account.id, mode).catch(() => {});
            onRefresh?.();
          }}
        />
      </div>
    )}
    {showFilter && account.status === 'connected' && (
      <div className="mt-1 pl-4">
        <SubSourceSelector
          integrationId={account.id}
          importEverything={account.importEverything ?? true}
          selectedSubSourceIds={account.selectedSubSourceIds ?? []}
          onSave={async (filter) => {
            await updateImportFilter(account.id, filter);
            setShowFilter(false);
            onRefresh?.();
          }}
          onCancel={() => setShowFilter(false)}
        />
      </div>
    )}
  </>
  );
}

interface IntegrationCardProps {
  serviceId: ServiceId;
  /** Multi-account array — when provided, drives the account list display */
  accounts?: IntegrationStatus[];
  /** Fallback single-account props (used by onboarding) */
  status?: 'connected' | 'error' | 'disconnected';
  lastSyncAt?: string | null;
  lastSyncError?: string | null;
  gmailSyncMode?: 'all_unread' | 'starred_only' | null;
  gmailCompletionMode?: 'inbox_removal' | 'read' | null;
  importEverything?: boolean;
  selectedSubSourceIds?: string[];
  maskedEmail?: string | null;
  calendarEventWindowDays?: number | null;
  siblingMaskedEmail?: string | null;
  onDisconnect?: (integrationId: string) => Promise<void>;
  onUpdateLabel?: (integrationId: string, label: string) => Promise<void>;
  onPauseAccount?: (integrationId: string, paused: boolean) => Promise<void>;
  onRefresh?: () => void;
  /** If true, shows a simplified "Connect" CTA without disconnect action (onboarding view) */
  onboardingMode?: boolean;
}

export function IntegrationCard({
  serviceId,
  accounts = [],
  status: statusProp,
  lastSyncAt: lastSyncAtProp,
  lastSyncError: lastSyncErrorProp,
  gmailSyncMode: gmailSyncModeProp,
  gmailCompletionMode: gmailCompletionModeProp,
  importEverything: importEverythingProp = true,
  selectedSubSourceIds: selectedSubSourceIdsProp = [],
  maskedEmail: maskedEmailProp,
  calendarEventWindowDays: calendarEventWindowDaysProp,
  siblingMaskedEmail,
  onDisconnect,
  onUpdateLabel,
  onPauseAccount,
  onRefresh,
  onboardingMode = false,
}: IntegrationCardProps) {
  // Derive effective values from accounts[0] when present, otherwise fall back to individual props
  const primaryAccount = accounts[0];
  const status = primaryAccount?.status ?? statusProp ?? 'disconnected';
  const lastSyncAt = primaryAccount?.lastSyncAt ?? lastSyncAtProp ?? null;
  const lastSyncError = primaryAccount?.lastSyncError ?? lastSyncErrorProp ?? null;
  const gmailSyncModeFallback = primaryAccount?.gmailSyncMode ?? gmailSyncModeProp ?? null;
  const gmailCompletionModeFallback = primaryAccount?.gmailCompletionMode ?? gmailCompletionModeProp ?? null;
  const importEverything = primaryAccount?.importEverything ?? importEverythingProp;
  const selectedSubSourceIds = primaryAccount?.selectedSubSourceIds ?? selectedSubSourceIdsProp;
  const maskedEmail = primaryAccount?.maskedEmail ?? maskedEmailProp;
  const calendarEventWindowDays = primaryAccount?.calendarEventWindowDays ?? calendarEventWindowDaysProp;

  const [disconnecting, setDisconnecting] = useState(false);
  const [gmailMode, setGmailMode] = useState<'all_unread' | 'starred_only'>(
    gmailSyncModeFallback ?? 'starred_only'
  );
  const [completionMode, setCompletionMode] = useState<'inbox_removal' | 'read'>(
    gmailCompletionModeFallback ?? 'inbox_removal'
  );
  const [showGmailSelector, setShowGmailSelector] = useState(false);
  const [eventWindow, setEventWindow] = useState<number>(calendarEventWindowDays ?? 30);
  const meta = SERVICE_META[serviceId];
  const isApple = serviceId === 'apple_calendar';

  const hasAccounts = accounts.length > 0 && !onboardingMode;

  // For single-account legacy disconnect (onboarding doesn't need it, settings passes per-row)
  const handleLegacyDisconnect = async () => {
    if (!onDisconnect || !primaryAccount) return;
    setDisconnecting(true);
    try {
      await onDisconnect(primaryAccount.id);
    } finally {
      setDisconnecting(false);
    }
  };

  const statusBadgeClass =
    status === 'connected'
      ? 'text-[0.65rem] font-bold uppercase tracking-[0.08em] text-green-600 px-1.5 py-0.5 border border-green-600'
      : status === 'error'
      ? 'text-[0.65rem] font-bold uppercase tracking-[0.08em] text-red-600 px-1.5 py-0.5 border border-red-600'
      : 'text-[0.65rem] font-bold uppercase tracking-[0.08em] text-zinc-400 px-1.5 py-0.5 border border-zinc-400';
  const statusLabel = status === 'connected' ? 'Connected' : status === 'error' ? 'Error' : 'Not connected';

  const connectHref =
    serviceId === 'gmail'
      ? getConnectUrl(serviceId, gmailMode)
      : getConnectUrl(serviceId);

  const reconnectHref = connectHref.replace('/connect', '/reconnect');

  const btnSmall = 'w-auto border border-zinc-300 bg-white py-2 px-3.5 text-xs font-medium text-black cursor-pointer transition-colors hover:border-black hover:bg-zinc-50 flex items-center justify-center gap-2.5 no-underline';
  const btnPrimarySmall = 'w-auto bg-black text-white py-2 px-3.5 text-[0.7rem] font-bold uppercase tracking-[0.12em] cursor-pointer transition-colors hover:bg-zinc-900 no-underline';

  return (
    <div className="border border-zinc-200 p-5 bg-white">
      {/* Header row */}
      <div className="flex items-center gap-3 mb-3">
        <div className="text-zinc-900 shrink-0">{meta.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[0.9rem] font-bold text-black">
              {meta.label}
            </span>
            {!hasAccounts && (
              <span className={statusBadgeClass}>
                {statusLabel}
              </span>
            )}
          </div>
          <p className="text-[0.8rem] text-zinc-500 mt-1">
            {meta.description}
          </p>
        </div>
      </div>

      {/* Multi-account list */}
      {hasAccounts && (
        <div className="mb-3 border border-zinc-100 px-3 py-2">
          {accounts.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              serviceId={serviceId}
              onDisconnect={onDisconnect}
              onUpdateLabel={onUpdateLabel}
              onPauseAccount={onPauseAccount}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}

      {/* Last sync info (single-account mode) */}
      {!hasAccounts && status === 'connected' && lastSyncAt && (
        <p className="text-[0.7rem] text-zinc-400 mb-3">
          Last synced {new Date(lastSyncAt).toLocaleString()}
        </p>
      )}

      {/* Error message (single-account mode) */}
      {!hasAccounts && status === 'error' && lastSyncError && (
        <div className="border-l-2 border-red-500 py-1 pl-3 text-[0.8rem] text-red-600 mb-3">
          {lastSyncError}
        </div>
      )}

      {/* Gmail sync mode selector — only in onboarding (disconnected) pre-connect */}
      {serviceId === 'gmail' && !hasAccounts && status === 'disconnected' && (
        <GmailSyncModeSelector value={gmailMode} onChange={setGmailMode} />
      )}

      {/* Gmail completion mode selector — only in legacy single-account connected mode */}
      {serviceId === 'gmail' && !hasAccounts && status === 'connected' && showGmailSelector && (
        <GmailCompletionModeSelector
          value={completionMode}
          onChange={async (mode) => {
            setCompletionMode(mode);
            await updateGmailCompletionMode(primaryAccount?.id ?? '', mode).catch(() => {});
            onRefresh?.();
          }}
        />
      )}

      {/* Import filter panel — rendered per-account via AccountRow */}

      {/* Calendar event window selector for Apple Calendar */}
      {serviceId === 'apple_calendar' && status === 'connected' && (
        <div className="mt-3">
          <label className="block text-xs font-medium mb-1">Event window</label>
          <select
            title="Event window"
            value={eventWindow}
            onChange={async (e) => {
              const days = Number(e.target.value) as 7 | 14 | 30 | 60;
              setEventWindow(days);
              await updateCalendarEventWindow(primaryAccount?.id ?? '', days).catch(() => {});
              onRefresh?.();
            }}
            className="border border-zinc-300 px-2 py-1 text-xs"
          >
            {[7, 14, 30, 60].map((d) => (
              <option key={d} value={d}>{d} days</option>
            ))}
          </select>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 flex-wrap mt-3.5">
        {/* Multi-account mode: Add account button */}
        {hasAccounts && (
          <>
            <a
              href={connectHref}
              title={accounts.length >= 5 ? 'Maximum of 5 accounts reached' : undefined}
              aria-disabled={accounts.length >= 5}
              onClick={accounts.length >= 5 ? (e) => e.preventDefault() : undefined}
              className={`${btnSmall} ${accounts.length >= 5 ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              + Add account
            </a>
          </>
        )}

        {/* Single-account / onboarding mode actions */}
        {!hasAccounts && status === 'disconnected' && (
          <>
            {isApple ? (
              siblingMaskedEmail ? (
                <AppleConfirmationScreen
                  serviceId="apple_calendar"
                  maskedEmail={siblingMaskedEmail}
                  onSuccess={() => onRefresh?.()}
                  onError={() => {}}
                />
              ) : (
                <AppleCredentialForm
                  serviceId="apple_calendar"
                  onSuccess={() => onRefresh?.()}
                  onError={() => {}}
                />
              )
            ) : (
              <>
                {serviceId === 'gmail' && (
                  <button
                    type="button"
                    className={btnSmall}
                    onClick={() => setShowGmailSelector((v) => !v)}
                  >
                    {showGmailSelector ? 'Hide options' : 'Sync options'}
                  </button>
                )}
                <a href={connectHref} className={btnPrimarySmall}>
                  Connect
                </a>
              </>
            )}
          </>
        )}

        {!hasAccounts && status === 'error' && !onboardingMode && (
          <>
            {isApple ? (
              <div className="w-full">
                <p className="text-xs font-medium text-red-600 mb-2">Update your iCloud credentials</p>
                <AppleCredentialForm
                  serviceId="apple_calendar"
                  onSuccess={() => onRefresh?.()}
                  onError={() => {}}
                />
              </div>
            ) : (
              <a href={reconnectHref} className={btnPrimarySmall}>
                Reconnect
              </a>
            )}
          </>
        )}

        {!hasAccounts && status === 'connected' && !onboardingMode && (
          <>
            {!isApple && (
              <a href={reconnectHref} className={btnSmall}>
                Reconnect
              </a>
            )}
            <button
              type="button"
              disabled={disconnecting}
              onClick={handleLegacyDisconnect}
              className="w-auto border border-red-200 bg-white py-2 px-3.5 text-xs font-medium text-red-600 cursor-pointer transition-colors hover:border-red-500 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

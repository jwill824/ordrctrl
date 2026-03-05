'use client';

// T042 — GmailSyncModeSelector component

interface GmailSyncModeSelectorProps {
  value: 'all_unread' | 'starred_only';
  onChange: (mode: 'all_unread' | 'starred_only') => void;
}

export function GmailSyncModeSelector({ value, onChange }: GmailSyncModeSelectorProps) {
  return (
    <div className="mt-4">
      <p className="block text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-zinc-400 mb-3">
        Gmail Sync Mode
      </p>
      <div className="flex flex-col gap-2.5">
        <label
          className={`flex items-start gap-3 cursor-pointer p-3 border ${value === 'starred_only' ? 'border-black bg-zinc-50' : 'border-zinc-200 bg-white'}`}
        >
          <input
            type="radio"
            name="gmailSyncMode"
            value="starred_only"
            checked={value === 'starred_only'}
            onChange={() => onChange('starred_only')}
            className="mt-0.5 accent-black shrink-0"
          />
          <div>
            <div className="text-sm font-semibold text-black">
              Starred only
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">
              Sync only emails you've starred or flagged. Best for high-volume inboxes.
            </div>
          </div>
        </label>

        <label
          className={`flex items-start gap-3 cursor-pointer p-3 border ${value === 'all_unread' ? 'border-black bg-zinc-50' : 'border-zinc-200 bg-white'}`}
        >
          <input
            type="radio"
            name="gmailSyncMode"
            value="all_unread"
            checked={value === 'all_unread'}
            onChange={() => onChange('all_unread')}
            className="mt-0.5 accent-black shrink-0"
          />
          <div>
            <div className="text-sm font-semibold text-black">
              All unread
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">
              Sync all unread emails as action items. Best for inbox-zero workflows.
            </div>
          </div>
        </label>
      </div>
    </div>
  );
}

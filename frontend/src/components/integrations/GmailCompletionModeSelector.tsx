'use client';

interface GmailCompletionModeSelectorProps {
  value: 'inbox_removal' | 'read';
  onChange: (mode: 'inbox_removal' | 'read') => void;
}

export function GmailCompletionModeSelector({ value, onChange }: GmailCompletionModeSelectorProps) {
  return (
    <div className="mt-4">
      <p className="block text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-zinc-400 mb-3">
        Gmail Completion Mode
      </p>
      <div className="flex flex-col gap-2.5">
        <label
          className={`flex items-start gap-3 cursor-pointer p-3 border ${value === 'inbox_removal' ? 'border-black bg-zinc-50' : 'border-zinc-200 bg-white'}`}
        >
          <input
            type="radio"
            name="gmailCompletionMode"
            value="inbox_removal"
            checked={value === 'inbox_removal'}
            onChange={() => onChange('inbox_removal')}
            className="mt-0.5 accent-black shrink-0"
          />
          <div>
            <div className="text-sm font-semibold text-black">
              Inbox removal <span className="text-xs font-normal text-zinc-400">(default)</span>
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">
              Mark as done when the email leaves your inbox (archived, deleted, or moved). Aligns with inbox-zero workflows.
            </div>
          </div>
        </label>

        <label
          className={`flex items-start gap-3 cursor-pointer p-3 border ${value === 'read' ? 'border-black bg-zinc-50' : 'border-zinc-200 bg-white'}`}
        >
          <input
            type="radio"
            name="gmailCompletionMode"
            value="read"
            checked={value === 'read'}
            onChange={() => onChange('read')}
            className="mt-0.5 accent-black shrink-0"
          />
          <div>
            <div className="text-sm font-semibold text-black">
              Read
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">
              Mark as done when you&apos;ve read the email. Useful when reading is your primary action.
            </div>
          </div>
        </label>
      </div>
    </div>
  );
}

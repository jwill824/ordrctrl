'use client';

// T025 — AutoClearSettings component
// Manages auto-clear enabled toggle and window days selector

import { useState, useEffect } from 'react';
import { getUserSettings, updateUserSettings } from '@/services/user.service';

export function AutoClearSettings() {
  const [autoClearEnabled, setAutoClearEnabled] = useState(false);
  const [autoClearWindowDays, setAutoClearWindowDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getUserSettings()
      .then((s) => {
        setAutoClearEnabled(s.autoClearEnabled);
        setAutoClearWindowDays(s.autoClearWindowDays);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle(enabled: boolean) {
    setAutoClearEnabled(enabled);
    await save({ autoClearEnabled: enabled, autoClearWindowDays });
  }

  async function handleWindowChange(days: number) {
    setAutoClearWindowDays(days);
    await save({ autoClearEnabled, autoClearWindowDays: days });
  }

  async function save(patch: { autoClearEnabled: boolean; autoClearWindowDays: number }) {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await updateUserSettings(patch);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-zinc-400 text-sm">Loading…</div>;

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <div className="border-l-2 border-red-500 py-1 pl-3 text-[0.8rem] text-red-600">
          {error}
        </div>
      )}

      {/* Auto-clear toggle */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-black">Auto-clear completed</p>
          <p className="text-[0.75rem] text-zinc-500 mt-0.5">
            Automatically dismiss completed tasks after the window below.
          </p>
        </div>
        <button
          role="switch"
          aria-checked={autoClearEnabled}
          aria-label="Toggle auto-clear completed tasks"
          onClick={() => handleToggle(!autoClearEnabled)}
          disabled={saving}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors focus:outline-none ${
            autoClearEnabled ? 'bg-black' : 'bg-zinc-300'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              autoClearEnabled ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Window days selector — only shown when auto-clear is enabled */}
      {autoClearEnabled && (
        <div className="flex items-center gap-3">
          <label htmlFor="auto-clear-days" className="text-sm text-zinc-700">
            Clear after
          </label>
          <select
            id="auto-clear-days"
            value={autoClearWindowDays}
            onChange={(e) => handleWindowChange(Number(e.target.value))}
            disabled={saving}
            className="text-sm border border-zinc-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-black"
          >
            {[1, 3, 7, 14, 30].map((d) => (
              <option key={d} value={d}>
                {d} {d === 1 ? 'day' : 'days'}
              </option>
            ))}
          </select>
          {saved && <span className="text-[0.75rem] text-zinc-400">Saved</span>}
        </div>
      )}
    </div>
  );
}

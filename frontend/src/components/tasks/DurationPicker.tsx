'use client';

import { useState, useEffect } from 'react';
import Picker from 'react-mobile-picker';

export interface DurationSlot {
  value: number; // minutes
  label: string;
}

export const DURATION_SLOTS: DurationSlot[] = [
  { value: 1, label: '1 min' },
  { value: 5, label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hr' },
  { value: 90, label: '1.5 hr' },
  { value: 120, label: '2 hr' },
];

const MIN_DURATION = 1;
const MAX_DURATION = 719; // anything >= 720 min should use all-day

function formatDurationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return h === 1 ? '1 hr' : `${h} hr`;
  return `${h}h ${m}m`;
}

function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    setIsTouch(window.matchMedia('(pointer: coarse)').matches);
  }, []);
  return isTouch;
}

interface DurationPickerProps {
  value: number; // minutes
  onChange: (minutes: number) => void;
}

export function DurationPicker({ value, onChange }: DurationPickerProps) {
  const isTouch = useIsTouchDevice();
  const isPreset = DURATION_SLOTS.some((s) => s.value === value);

  const [customMode, setCustomMode] = useState(!isPreset);
  const [customInput, setCustomInput] = useState(isPreset ? '' : String(value));

  // Snap to nearest preset for scroll wheel display
  const slotValue = String(
    DURATION_SLOTS.reduce((closest, slot) =>
      Math.abs(slot.value - value) < Math.abs(closest.value - value) ? slot : closest,
    ).value,
  );

  const handlePickerChange = (pickerValue: { duration: string }) => {
    const v = Number(pickerValue.duration);
    onChange(v);
    setCustomMode(false);
    setCustomInput('');
  };

  const handlePresetClick = (presetValue: number) => {
    onChange(presetValue);
    setCustomMode(false);
    setCustomInput('');
  };

  const handleCustomInput = (raw: string) => {
    setCustomInput(raw);
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.max(MIN_DURATION, Math.min(MAX_DURATION, parsed));
      onChange(clamped);
    }
  };

  return (
    <div data-testid="duration-picker" className="flex flex-col gap-2">
      {/* Preset chips */}
      <div className="flex flex-wrap gap-1.5">
        {DURATION_SLOTS.map((slot) => (
          <button
            key={slot.value}
            type="button"
            onClick={() => handlePresetClick(slot.value)}
            className={`px-2.5 py-1 text-[0.65rem] font-semibold border transition-colors ${
              !customMode && value === slot.value
                ? 'bg-black text-white border-black'
                : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
            }`}
          >
            {slot.label}
          </button>
        ))}

        {/* Custom chip */}
        <button
          type="button"
          onClick={() => {
            setCustomMode(true);
            setCustomInput(isPreset ? '' : String(value));
          }}
          className={`px-2.5 py-1 text-[0.65rem] font-semibold border transition-colors ${
            customMode || !isPreset
              ? 'bg-black text-white border-black'
              : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
          }`}
        >
          {!customMode && !isPreset ? formatDurationLabel(value) : 'Custom'}
        </button>
      </div>

      {/* Custom duration input — always on desktop, toggle on mobile */}
      {(customMode || !isTouch) && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={MIN_DURATION}
            max={MAX_DURATION}
            value={customInput !== '' ? customInput : (customMode ? '' : String(value))}
            onChange={(e) => handleCustomInput(e.target.value)}
            placeholder="e.g. 25"
            aria-label="Custom duration in minutes"
            className="w-24 border border-zinc-300 bg-white py-1.5 px-2 text-[0.8rem] text-black outline-none focus:border-black transition-colors"
          />
          <span className="text-[0.75rem] text-zinc-400">min</span>
          {customMode && !isTouch && isPreset && (
            <span className="text-[0.7rem] text-zinc-400 tabular-nums">{formatDurationLabel(value)}</span>
          )}
        </div>
      )}

      {/* Scroll wheel — mobile only */}
      {isTouch && (
        <Picker
          value={{ duration: slotValue }}
          onChange={handlePickerChange}
          height={160}
          itemHeight={40}
          wheelMode="natural"
        >
          <Picker.Column name="duration">
            {DURATION_SLOTS.map((slot) => (
              <Picker.Item key={slot.value} value={String(slot.value)}>
                {slot.label}
              </Picker.Item>
            ))}
          </Picker.Column>
        </Picker>
      )}
    </div>
  );
}

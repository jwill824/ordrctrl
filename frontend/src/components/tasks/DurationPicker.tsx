'use client';

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

const PRESET_SLOTS = DURATION_SLOTS;

interface DurationPickerProps {
  value: number; // minutes
  onChange: (minutes: number) => void;
}

export function DurationPicker({ value, onChange }: DurationPickerProps) {
  // Snap value to nearest slot (for scroll wheel display)
  const slotValue = String(
    DURATION_SLOTS.reduce((closest, slot) =>
      Math.abs(slot.value - value) < Math.abs(closest.value - value) ? slot : closest,
    ).value,
  );

  const handlePickerChange = (pickerValue: { duration: string }) => {
    onChange(Number(pickerValue.duration));
  };

  return (
    <div data-testid="duration-picker" className="flex flex-col gap-2">
      {/* Preset chips */}
      <div className="flex flex-wrap gap-1.5">
        {PRESET_SLOTS.map((slot) => (
          <button
            key={slot.value}
            type="button"
            onClick={() => onChange(slot.value)}
            className={`px-2.5 py-1 text-[0.65rem] font-semibold border transition-colors ${
              value === slot.value
                ? 'bg-black text-white border-black'
                : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
            }`}
          >
            {slot.label}
          </button>
        ))}
      </div>

      {/* Scroll wheel */}
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
    </div>
  );
}

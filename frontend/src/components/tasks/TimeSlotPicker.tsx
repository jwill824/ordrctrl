'use client';

import Picker from 'react-mobile-picker';
import { generateTimeSlots, slotValueToMinutes } from '@/utils/timeSlots';

const SLOTS = generateTimeSlots();

interface TimeSlotPickerProps {
  value: string;
  onChange: (value: string) => void;
  durationMinutes?: number;
}

function formatMins(totalMins: number): string {
  const h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

export function TimeSlotPicker({ value, onChange, durationMinutes }: TimeSlotPickerProps) {
  return (
    <div data-testid="time-slot-picker">
      <Picker
        value={{ time: value }}
        onChange={(pickerValue) => onChange(pickerValue.time as string)}
        height={200}
        itemHeight={40}
        wheelMode="natural"
      >
        <Picker.Column name="time">
          {SLOTS.map((slot) => {
            const startMins = slotValueToMinutes(slot.value);
            const label =
              durationMinutes != null
                ? `${formatMins(startMins)} – ${formatMins(startMins + durationMinutes)}`
                : slot.label;
            return (
              <Picker.Item key={slot.value} value={slot.value}>
                {label}
              </Picker.Item>
            );
          })}
        </Picker.Column>
      </Picker>
    </div>
  );
}

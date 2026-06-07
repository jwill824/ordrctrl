'use client';

import Picker from 'react-mobile-picker';
import { generateTimeSlots, slotValueToMinutes, formatMins } from '@/utils/timeSlots';

const SLOTS = generateTimeSlots();

interface TimeSlotPickerProps {
  value: string;
  onChange: (value: string) => void;
  durationMinutes?: number;
  use12h?: boolean;
}

export function TimeSlotPicker({ value, onChange, durationMinutes, use12h = false }: TimeSlotPickerProps) {
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
                ? `${formatMins(startMins, use12h)} – ${formatMins(startMins + durationMinutes, use12h)}`
                : formatMins(startMins, use12h);
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

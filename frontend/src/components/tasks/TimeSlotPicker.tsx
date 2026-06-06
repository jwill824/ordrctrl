'use client';

import Picker from 'react-mobile-picker';
import { generateTimeSlots } from '@/utils/timeSlots';

const SLOTS = generateTimeSlots();

interface TimeSlotPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function TimeSlotPicker({ value, onChange }: TimeSlotPickerProps) {
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
          {SLOTS.map((slot) => (
            <Picker.Item key={slot.value} value={slot.value}>
              {slot.label}
            </Picker.Item>
          ))}
        </Picker.Column>
      </Picker>
    </div>
  );
}

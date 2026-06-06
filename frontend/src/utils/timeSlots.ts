export interface TimeSlot {
  value: string;
  label: string;
}

export function generateTimeSlots(): TimeSlot[] {
  const slots: TimeSlot[] = [];
  for (let totalMinutes = 0; totalMinutes < 24 * 60; totalMinutes += 15) {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const value = `${h}:${String(m).padStart(2, '0')}`;
    slots.push({ value, label: value });
  }
  return slots;
}

export function slotValueToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

export function timeToSlotValue(isoString: string): string {
  const d = new Date(isoString);
  const totalMinutes = d.getHours() * 60 + d.getMinutes();
  // Snap down to nearest 15-min boundary
  const snapped = Math.floor(totalMinutes / 15) * 15;
  const h = Math.floor(snapped / 60);
  const m = snapped % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

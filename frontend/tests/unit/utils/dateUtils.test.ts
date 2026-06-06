import { describe, it, expect } from 'vitest';
import { formatWeekRange } from '@/utils/dateUtils';

describe('formatWeekRange', () => {
  it('same month — Jun 1–7 (D-05 first example)', () => {
    expect(formatWeekRange(new Date(2026, 5, 1))).toBe('Jun 1–7');
  });

  it('cross-month — Jun 30 – Jul 6 (D-05 second example)', () => {
    expect(formatWeekRange(new Date(2026, 5, 30))).toBe('Jun 30 – Jul 6');
  });

  it('cross-year — Dec 29 – Jan 4', () => {
    expect(formatWeekRange(new Date(2025, 11, 29))).toBe('Dec 29 – Jan 4');
  });

  it('same month, mid-month — Jun 8–14', () => {
    expect(formatWeekRange(new Date(2026, 5, 8))).toBe('Jun 8–14');
  });

  it('cross-month, July into August — Jul 27 – Aug 2', () => {
    expect(formatWeekRange(new Date(2026, 6, 27))).toBe('Jul 27 – Aug 2');
  });
});

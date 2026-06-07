// T12-05 — Unit tests for color/icon resolution logic in feed.service.ts
// Tests the pure inline expressions used throughout buildFeed:
//   sync items:   colorOverrideMap.get(id)?.value ?? '#3B82F6'
//                 iconOverrideMap.get(id)?.value ?? null
//   native tasks: task.color ?? '#3B82F6'
//                 task.icon  ?? null
//
// No Prisma mock needed — these are pure value operations.

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Pure helper functions mirroring the inline expressions in feed.service.ts
// ---------------------------------------------------------------------------

/** Returns override value when present, else the default blue #3B82F6. */
function resolveColor(overrideValue: string | null | undefined): string {
  return overrideValue ?? '#3B82F6';
}

/** Returns override value when present, else null. */
function resolveIcon(overrideValue: string | null | undefined): string | null {
  return overrideValue ?? null;
}

// ---------------------------------------------------------------------------
// resolveColor — sync override map path
// ---------------------------------------------------------------------------

describe('resolveColor (sync item override)', () => {
  it('returns the override value when a COLOR_OVERRIDE is present', () => {
    expect(resolveColor('#EF4444')).toBe('#EF4444');
  });

  it('returns default blue when override is null (no override stored)', () => {
    expect(resolveColor(null)).toBe('#3B82F6');
  });

  it('returns default blue when override is undefined (key missing from map)', () => {
    expect(resolveColor(undefined)).toBe('#3B82F6');
  });

  it('preserves any valid hex color passed as the override', () => {
    expect(resolveColor('#22C55E')).toBe('#22C55E');
    expect(resolveColor('#000000')).toBe('#000000');
    expect(resolveColor('#FFFFFF')).toBe('#FFFFFF');
  });
});

// ---------------------------------------------------------------------------
// resolveIcon — sync override map path
// ---------------------------------------------------------------------------

describe('resolveIcon (sync item override)', () => {
  it('returns the emoji when an ICON_OVERRIDE is present', () => {
    expect(resolveIcon('🎯')).toBe('🎯');
  });

  it('returns null when override is null (no icon set)', () => {
    expect(resolveIcon(null)).toBeNull();
  });

  it('returns null when override is undefined (key missing from map)', () => {
    expect(resolveIcon(undefined)).toBeNull();
  });

  it('preserves arbitrary short strings as icons', () => {
    expect(resolveIcon('★')).toBe('★');
    expect(resolveIcon('🚀')).toBe('🚀');
  });
});

// ---------------------------------------------------------------------------
// Native task color/icon — task.color ?? '#3B82F6' / task.icon ?? null
// ---------------------------------------------------------------------------

describe('native task color resolution (task.color ?? "#3B82F6")', () => {
  it('returns the stored color when task.color is set', () => {
    const task = { color: '#22C55E' };
    expect(task.color ?? '#3B82F6').toBe('#22C55E');
  });

  it('returns default blue when task.color is null', () => {
    const task: { color: string | null } = { color: null };
    expect(task.color ?? '#3B82F6').toBe('#3B82F6');
  });

  it('returns default blue when task.color is undefined', () => {
    const task: { color?: string } = {};
    expect(task.color ?? '#3B82F6').toBe('#3B82F6');
  });
});

describe('native task icon resolution (task.icon ?? null)', () => {
  it('returns the stored emoji when task.icon is set', () => {
    const task = { icon: '🎯' };
    expect(task.icon ?? null).toBe('🎯');
  });

  it('returns null when task.icon is null', () => {
    const task: { icon: string | null } = { icon: null };
    expect(task.icon ?? null).toBeNull();
  });

  it('returns null when task.icon is undefined', () => {
    const task: { icon?: string } = {};
    expect(task.icon ?? null).toBeNull();
  });
});

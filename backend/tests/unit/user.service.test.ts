// T023 — Unit tests for user.service
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUserSettings, updateUserSettings } from '../../src/user/user.service.js';

vi.mock('../../src/lib/db.js', () => {
  const prisma = {
    user: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
  };
  return { prisma };
});

import { prisma } from '../../src/lib/db.js';
const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;

describe('getUserSettings', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns defaults when settings is null', async () => {
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({ settings: null });
    const settings = await getUserSettings('user-1');
    expect(settings).toEqual({ autoClearEnabled: false, autoClearWindowDays: 7 });
  });

  it('merges stored settings over defaults', async () => {
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
      settings: { autoClearEnabled: true, autoClearWindowDays: 14 },
    });
    const settings = await getUserSettings('user-1');
    expect(settings.autoClearEnabled).toBe(true);
    expect(settings.autoClearWindowDays).toBe(14);
  });

  it('partial stored settings use defaults for missing fields', async () => {
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
      settings: { autoClearEnabled: true },
    });
    const settings = await getUserSettings('user-1');
    expect(settings.autoClearEnabled).toBe(true);
    expect(settings.autoClearWindowDays).toBe(7); // default
  });
});

describe('updateUserSettings', () => {
  beforeEach(() => vi.resetAllMocks());

  it('merges patch into existing settings and persists', async () => {
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({ settings: null });
    mockPrisma.user.update.mockResolvedValue({});

    const result = await updateUserSettings('user-1', { autoClearEnabled: true });
    expect(result.autoClearEnabled).toBe(true);
    expect(result.autoClearWindowDays).toBe(7);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { settings: { autoClearEnabled: true, autoClearWindowDays: 7 } },
    });
  });

  it('partial update preserves other fields', async () => {
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
      settings: { autoClearEnabled: true, autoClearWindowDays: 14 },
    });
    mockPrisma.user.update.mockResolvedValue({});

    const result = await updateUserSettings('user-1', { autoClearWindowDays: 30 });
    expect(result.autoClearEnabled).toBe(true);
    expect(result.autoClearWindowDays).toBe(30);
  });
});

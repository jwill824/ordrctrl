import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../src/lib/db.js', () => ({
  prisma: {
    integration: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('../../src/lib/encryption.js', () => ({
  decrypt: vi.fn((v: string) => v),
  encrypt: vi.fn((v: string) => v),
}));

vi.mock('../../src/lib/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('../../src/lib/queue.js', () => ({
  syncQueue: { add: vi.fn() },
}));

vi.mock('../../src/integrations/index.js', () => ({
  getAdapter: vi.fn(),
}));

import { prisma } from '../../src/lib/db.js';
import { getAdapter } from '../../src/integrations/index.js';
import {
  connectIntegration,
  listIntegrations,
  disconnectIntegration,
  updateCalendarEventWindow,
  AppError,
} from '../../src/integrations/integration.service.js';
import { InvalidCredentialsError } from '../../src/integrations/_adapter/types.js';

const mockPrisma = prisma as any;
const mockGetAdapter = getAdapter as ReturnType<typeof vi.fn>;

describe('integration.service - connectIntegration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('strips hyphens from ASP before calling adapter', async () => {
    const mockConnect = vi.fn().mockResolvedValue({ integrationId: 'int-1' });
    mockGetAdapter.mockReturnValue({ connect: mockConnect });

    await connectIntegration('user-1', 'apple_reminders', {
      type: 'credential',
      email: 'user@icloud.com',
      password: 'abcd-efgh-ijkl-mnop',
    });

    expect(mockConnect).toHaveBeenCalledWith(
      'user-1',
      { type: 'credential', email: 'user@icloud.com', password: 'abcdefghijklmnop' },
      undefined
    );
  });

  it('use-existing: copies credentials from connected sibling', async () => {
    mockPrisma.integration.findFirst.mockResolvedValue({
      id: 'sibling-int',
      status: 'connected',
      encryptedAccessToken: 'user@icloud.com',
      encryptedRefreshToken: 'sibling-asp',
    });

    const mockConnect = vi.fn().mockResolvedValue({ integrationId: 'int-2' });
    mockGetAdapter.mockReturnValue({ connect: mockConnect });

    await connectIntegration('user-1', 'apple_calendar', { type: 'use-existing' });

    expect(mockConnect).toHaveBeenCalledWith(
      'user-1',
      { type: 'credential', email: 'user@icloud.com', password: 'sibling-asp' },
      undefined
    );
  });

  it('use-existing: throws NO_EXISTING_CREDENTIALS when no connected sibling', async () => {
    mockPrisma.integration.findFirst.mockResolvedValue(null);
    mockGetAdapter.mockReturnValue({ connect: vi.fn() });

    await expect(
      connectIntegration('user-1', 'apple_calendar', { type: 'use-existing' })
    ).rejects.toThrow(AppError);

    try {
      await connectIntegration('user-1', 'apple_calendar', { type: 'use-existing' });
    } catch (e: any) {
      expect(e.code).toBe('NO_EXISTING_CREDENTIALS');
    }
  });
});

describe('integration.service - listIntegrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns maskedEmail for Apple service with credentials', async () => {
    mockPrisma.integration.findMany.mockResolvedValue([
      {
        serviceId: 'apple_calendar',
        status: 'connected',
        lastSyncAt: null,
        lastSyncError: null,
        gmailSyncMode: null,
        importEverything: true,
        selectedSubSourceIds: [],
        encryptedAccessToken: 'jeff@icloud.com',
        calendarEventWindowDays: 30,
      },
    ]);

    const items = await listIntegrations('user-1');
    const appleItem = items.find((i) => i.serviceId === 'apple_calendar');
    expect(appleItem?.maskedEmail).toBe('j***@icloud.com');
  });

  it('returns maskedEmail: null for disconnected Apple service', async () => {
    mockPrisma.integration.findMany.mockResolvedValue([
      {
        serviceId: 'apple_calendar',
        status: 'disconnected',
        lastSyncAt: null,
        lastSyncError: null,
        gmailSyncMode: null,
        importEverything: true,
        selectedSubSourceIds: [],
        encryptedAccessToken: '',
        calendarEventWindowDays: 30,
      },
    ]);

    const items = await listIntegrations('user-1');
    const appleItem = items.find((i) => i.serviceId === 'apple_calendar');
    expect(appleItem?.maskedEmail).toBeNull();
  });

  it('returns calendarEventWindowDays: 30 for connected apple_calendar', async () => {
    mockPrisma.integration.findMany.mockResolvedValue([
      {
        serviceId: 'apple_calendar',
        status: 'connected',
        lastSyncAt: null,
        lastSyncError: null,
        gmailSyncMode: null,
        importEverything: true,
        selectedSubSourceIds: [],
        encryptedAccessToken: 'user@icloud.com',
        calendarEventWindowDays: 30,
      },
    ]);

    const items = await listIntegrations('user-1');
    const calItem = items.find((i) => i.serviceId === 'apple_calendar');
    expect(calItem?.calendarEventWindowDays).toBe(30);
  });
});

describe('integration.service - disconnectIntegration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls adapter disconnect for the integration', async () => {
    mockPrisma.integration.findFirst.mockResolvedValue({ id: 'int-calendar', serviceId: 'apple_calendar', status: 'connected' });

    const mockDisconnect = vi.fn().mockResolvedValue(undefined);
    mockGetAdapter.mockReturnValue({ disconnect: mockDisconnect });

    await disconnectIntegration('user-1', 'int-calendar');

    expect(mockDisconnect).toHaveBeenCalledWith('int-calendar');
  });
});

describe('integration.service - updateCalendarEventWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates calendarEventWindowDays with valid days', async () => {
    mockPrisma.integration.findFirst.mockResolvedValue({ id: 'int-1', status: 'connected' });
    mockPrisma.integration.update = vi.fn().mockResolvedValue({});

    await updateCalendarEventWindow('user-1', 'int-1', 14);

    expect(mockPrisma.integration.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { calendarEventWindowDays: 14 } })
    );
  });

  it('throws INTEGRATION_NOT_FOUND for non-existent integration', async () => {
    mockPrisma.integration.findFirst.mockResolvedValue(null);

    await expect(updateCalendarEventWindow('user-1', 'int-1', 14)).rejects.toThrow(AppError);
    try {
      await updateCalendarEventWindow('user-1', 'int-1', 14);
    } catch (e: any) {
      expect(e.code).toBe('INTEGRATION_NOT_FOUND');
    }
  });
});

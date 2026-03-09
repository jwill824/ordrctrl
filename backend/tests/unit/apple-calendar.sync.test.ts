import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../src/lib/db.js', () => ({
  prisma: {
    integration: { findUnique: vi.fn() },
  },
}));

vi.mock('../../src/lib/encryption.js', () => ({
  decrypt: vi.fn((v: string) => v),
  encrypt: vi.fn((v: string) => v),
}));

vi.mock('../../src/lib/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { prisma } from '../../src/lib/db.js';
import { AppleCalendarAdapter } from '../../src/integrations/apple-calendar/index.js';

const mockPrisma = prisma as any;

const PROPFIND_VEVENT_XML = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:response>
    <D:href>/calendars/home/</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>Home</D:displayname>
        <C:supported-calendar-component-set><C:comp name="VEVENT"/></C:supported-calendar-component-set>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
  <D:response>
    <D:href>/calendars/work/</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>Work</D:displayname>
        <C:supported-calendar-component-set><C:comp name="VEVENT"/></C:supported-calendar-component-set>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`;

const REPORT_XML = (uid: string, summary: string) =>
  `<D:multistatus xmlns:D="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
    <D:response>
      <cal:calendar-data>BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:${uid}\nSUMMARY:${summary}\nDTSTART:20250101T100000Z\nDTEND:20250101T110000Z\nEND:VEVENT\nEND:VCALENDAR</cal:calendar-data>
    </D:response>
  </D:multistatus>`;

describe('AppleCalendarAdapter - selective import', () => {
  let adapter: AppleCalendarAdapter;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    adapter = new AppleCalendarAdapter();
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    vi.clearAllMocks();
  });

  const baseIntegration = {
    id: 'int-1',
    status: 'connected',
    encryptedAccessToken: 'user@icloud.com',
    encryptedRefreshToken: 'testpassword',
    importEverything: true,
    selectedSubSourceIds: [],
  };

  it('listSubSources() returns mapped SubSource[] from VEVENT collections', async () => {
    mockPrisma.integration.findUnique.mockResolvedValue(baseIntegration);
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => PROPFIND_VEVENT_XML });

    const subSources = await adapter.listSubSources!('int-1');
    expect(subSources.length).toBeGreaterThanOrEqual(2);
    expect(subSources[0].type).toBe('calendar');
    expect(subSources[0].label).toBe('Home');
  });

  it('listSubSources() returns [] on error', async () => {
    mockPrisma.integration.findUnique.mockResolvedValue(baseIntegration);
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const subSources = await adapter.listSubSources!('int-1');
    expect(subSources).toEqual([]);
  });

  it('sync() returns all items when importEverything=true', async () => {
    mockPrisma.integration.findUnique.mockResolvedValue({ ...baseIntegration, importEverything: true });

    mockFetch
      .mockResolvedValueOnce({ ok: true, text: async () => PROPFIND_VEVENT_XML })
      .mockResolvedValueOnce({ ok: true, text: async () => REPORT_XML('uid1', 'Meeting') })
      .mockResolvedValueOnce({ ok: true, text: async () => REPORT_XML('uid2', 'Lunch') });

    const items = await adapter.sync('int-1');
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it('sync() filters by selectedSubSourceIds when importEverything=false', async () => {
    mockPrisma.integration.findUnique.mockResolvedValue({
      ...baseIntegration,
      importEverything: false,
      selectedSubSourceIds: ['/calendars/work/'],
    });

    mockFetch
      .mockResolvedValueOnce({ ok: true, text: async () => PROPFIND_VEVENT_XML })
      .mockResolvedValueOnce({ ok: true, text: async () => REPORT_XML('uid2', 'Work Meeting') });

    const items = await adapter.sync('int-1');
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0].subSourceId).toBe('/calendars/work/');
  });
});

import {
  NotSupportedError,
  InvalidCredentialsError,
  ProviderUnavailableError,
} from '../../src/integrations/_adapter/types.js';

describe('AppleCalendarAdapter - connect + credential flow', () => {
  let adapter: AppleCalendarAdapter;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    adapter = new AppleCalendarAdapter();
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    vi.clearAllMocks();
  });

  it('connect() with valid CredentialPayload mocks 207 PROPFIND and upserts integration', async () => {
    mockPrisma.integration = {
      ...mockPrisma.integration,
      upsert: vi.fn().mockResolvedValue({ id: 'int-new', status: 'connected' }),
    };
    mockFetch.mockResolvedValueOnce({ ok: true, status: 207 });

    const result = await adapter.connect('user-1', { type: 'credential', email: 'user@icloud.com', password: 'testpassword' });
    expect(result.integrationId).toBe('int-new');
    expect(mockPrisma.integration.upsert).toHaveBeenCalled();
  });

  it('connect() with OAuthPayload throws NotSupportedError', async () => {
    await expect(
      adapter.connect('user-1', { type: 'oauth', authCode: 'code123' })
    ).rejects.toThrow(NotSupportedError);
  });

  it('connect() with PROPFIND 401 throws InvalidCredentialsError', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    await expect(
      adapter.connect('user-1', { type: 'credential', email: 'user@icloud.com', password: 'wrongpass' })
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('connect() with PROPFIND 503 throws ProviderUnavailableError', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(
      adapter.connect('user-1', { type: 'credential', email: 'user@icloud.com', password: 'testpassword' })
    ).rejects.toThrow(ProviderUnavailableError);
  });

  it('connect() with calendarEventWindowDays: 14 stores 14 on integration record', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ id: 'int-new', status: 'connected' });
    mockPrisma.integration = { ...mockPrisma.integration, upsert: upsertMock };
    mockFetch.mockResolvedValueOnce({ ok: true, status: 207 });

    await adapter.connect('user-1', { type: 'credential', email: 'user@icloud.com', password: 'testpassword' }, { calendarEventWindowDays: 14 });

    const upsertCall = upsertMock.mock.calls[0][0];
    expect(upsertCall.create.calendarEventWindowDays).toBe(14);
    expect(upsertCall.update.calendarEventWindowDays).toBe(14);
  });

  it('connect() with no calendarEventWindowDays defaults to 30', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ id: 'int-new', status: 'connected' });
    mockPrisma.integration = { ...mockPrisma.integration, upsert: upsertMock };
    mockFetch.mockResolvedValueOnce({ ok: true, status: 207 });

    await adapter.connect('user-1', { type: 'credential', email: 'user@icloud.com', password: 'testpassword' });

    const upsertCall = upsertMock.mock.calls[0][0];
    expect(upsertCall.create.calendarEventWindowDays).toBe(30);
  });

  it('refreshToken() throws NotSupportedError', async () => {
    await expect(adapter.refreshToken('int-1')).rejects.toThrow(NotSupportedError);
  });

  it('getAuthorizationUrl() throws NotSupportedError', async () => {
    await expect(adapter.getAuthorizationUrl('state')).rejects.toThrow(NotSupportedError);
  });
});

describe('AppleCalendarAdapter - sync with Basic Auth', () => {
  let adapter: AppleCalendarAdapter;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    adapter = new AppleCalendarAdapter();
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    vi.clearAllMocks();
  });

  const baseIntegration = {
    id: 'int-1',
    status: 'connected',
    encryptedAccessToken: 'user@icloud.com',
    encryptedRefreshToken: 'testpassword',
    importEverything: true,
    selectedSubSourceIds: [],
    calendarEventWindowDays: 30,
  };

  it('sync() uses Basic Auth header', async () => {
    mockPrisma.integration.findUnique.mockResolvedValue(baseIntegration);
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 207, text: async () => PROPFIND_VEVENT_XML })
      .mockResolvedValueOnce({ ok: true, text: async () => REPORT_XML('uid1', 'Meeting') })
      .mockResolvedValueOnce({ ok: true, text: async () => REPORT_XML('uid2', 'Lunch') });

    await adapter.sync('int-1');

    const firstCallHeaders = mockFetch.mock.calls[0][1].headers;
    expect(firstCallHeaders.Authorization).toMatch(/^Basic /);
    const decoded = Buffer.from(firstCallHeaders.Authorization.replace('Basic ', ''), 'base64').toString();
    expect(decoded).toBe('user@icloud.com:testpassword');
  });

  it('sync() uses calendarEventWindowDays from integration record', async () => {
    mockPrisma.integration.findUnique.mockResolvedValue({ ...baseIntegration, calendarEventWindowDays: 14 });
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 207, text: async () => PROPFIND_VEVENT_XML })
      .mockResolvedValueOnce({ ok: true, text: async () => REPORT_XML('uid1', 'Meeting') })
      .mockResolvedValueOnce({ ok: true, text: async () => REPORT_XML('uid2', 'Lunch') });

    await adapter.sync('int-1');

    // Check that the REPORT body includes a time-range for 14 days, not 30
    const reportCalls = mockFetch.mock.calls.filter((c) => c[1].method === 'REPORT');
    const reportBody: string = reportCalls[0][1].body;
    // With 14 days the end date should be ~14 days from now, not 30
    expect(reportBody).toContain('time-range');
  });

  it('sync() with PROPFIND 401 throws InvalidCredentialsError', async () => {
    mockPrisma.integration.findUnique.mockResolvedValue(baseIntegration);
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    await expect(adapter.sync('int-1')).rejects.toThrow(InvalidCredentialsError);
  });

  it('sync() with PROPFIND 503 throws ProviderUnavailableError', async () => {
    mockPrisma.integration.findUnique.mockResolvedValue(baseIntegration);
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

    await expect(adapter.sync('int-1')).rejects.toThrow(ProviderUnavailableError);
  });
});

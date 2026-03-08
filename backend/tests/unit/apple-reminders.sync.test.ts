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
import { AppleRemindersAdapter } from '../../src/integrations/apple-reminders/index.js';

const mockPrisma = prisma as any;

const PROPFIND_VTODO_XML = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:response>
    <D:href>/reminders/work/</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>Work</D:displayname>
        <C:supported-calendar-component-set><C:comp name="VTODO"/></C:supported-calendar-component-set>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
  <D:response>
    <D:href>/reminders/personal/</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>Personal</D:displayname>
        <C:supported-calendar-component-set><C:comp name="VTODO"/></C:supported-calendar-component-set>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`;

const REPORT_XML = (collectionHref: string, uid: string, summary: string) =>
  `<D:multistatus xmlns:D="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
    <D:response>
      <cal:calendar-data>BEGIN:VCALENDAR\nBEGIN:VTODO\nUID:${uid}\nSUMMARY:${summary}\nEND:VTODO\nEND:VCALENDAR</cal:calendar-data>
    </D:response>
  </D:multistatus>`;

describe('AppleRemindersAdapter - selective import', () => {
  let adapter: AppleRemindersAdapter;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    adapter = new AppleRemindersAdapter();
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    vi.clearAllMocks();
  });

  const baseIntegration = {
    id: 'int-1',
    status: 'connected',
    encryptedAccessToken: 'token',
    importEverything: true,
    selectedSubSourceIds: [],
  };

  it('listSubSources() returns mapped SubSource[] from VTODO collections', async () => {
    mockPrisma.integration.findUnique.mockResolvedValue(baseIntegration);
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => PROPFIND_VTODO_XML });

    const subSources = await adapter.listSubSources!('int-1');
    expect(subSources.length).toBeGreaterThanOrEqual(2);
    expect(subSources[0].type).toBe('list');
    expect(subSources[0].label).toBe('Work');
  });

  it('listSubSources() returns [] on error', async () => {
    mockPrisma.integration.findUnique.mockResolvedValue(baseIntegration);
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const subSources = await adapter.listSubSources!('int-1');
    expect(subSources).toEqual([]);
  });

  it('sync() returns all items when importEverything=true', async () => {
    mockPrisma.integration.findUnique.mockResolvedValue({ ...baseIntegration, importEverything: true });

    // PROPFIND to discover collections
    mockFetch
      .mockResolvedValueOnce({ ok: true, text: async () => PROPFIND_VTODO_XML })
      // REPORT for /reminders/work/
      .mockResolvedValueOnce({ ok: true, text: async () => REPORT_XML('/reminders/work/', 'uid1', 'Work Task') })
      // REPORT for /reminders/personal/
      .mockResolvedValueOnce({ ok: true, text: async () => REPORT_XML('/reminders/personal/', 'uid2', 'Personal Task') });

    const items = await adapter.sync('int-1');
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it('sync() filters by selectedSubSourceIds when importEverything=false', async () => {
    mockPrisma.integration.findUnique.mockResolvedValue({
      ...baseIntegration,
      importEverything: false,
      selectedSubSourceIds: ['/reminders/work/'],
    });

    mockFetch
      .mockResolvedValueOnce({ ok: true, text: async () => PROPFIND_VTODO_XML })
      .mockResolvedValueOnce({ ok: true, text: async () => REPORT_XML('/reminders/work/', 'uid1', 'Work Task') });

    const items = await adapter.sync('int-1');
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0].subSourceId).toBe('/reminders/work/');
  });
});

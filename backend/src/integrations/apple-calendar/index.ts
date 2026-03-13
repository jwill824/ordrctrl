// Apple Calendar Integration Adapter — Basic Auth (iCloud email + App-Specific Password)

import { prisma } from '../../lib/db.js';
import { encrypt, decrypt } from '../../lib/encryption.js';
import { logger } from '../../lib/logger.js';
import {
  type IntegrationAdapter,
  type NormalizedItem,
  type ConnectOptions,
  type ConnectPayload,
  type SubSource,
  NotSupportedError,
  InvalidCredentialsError,
  ProviderUnavailableError,
  AccountLimitError,
} from '../_adapter/types.js';

const CALDAV_BASE = 'https://caldav.icloud.com';

const PROPFIND_XML = `<?xml version="1.0" encoding="UTF-8"?>
<A:propfind xmlns:A="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <A:prop>
    <A:resourcetype/>
    <A:displayname/>
    <C:supported-calendar-component-set/>
  </A:prop>
</A:propfind>`;

const PROPFIND_PRINCIPAL_XML = `<?xml version="1.0" encoding="UTF-8"?>
<A:propfind xmlns:A="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <A:prop>
    <A:current-user-principal/>
    <C:calendar-home-set/>
  </A:prop>
</A:propfind>`;

async function discoverCalendarHome(authHeader: string, serviceId: 'apple_reminders' | 'apple_calendar'): Promise<string> {
  const discoverRes = await fetch(`${CALDAV_BASE}/.well-known/caldav`, {
    method: 'PROPFIND',
    redirect: 'manual',
    headers: { Authorization: authHeader, 'Content-Type': 'application/xml; charset=utf-8', Depth: '0' },
    body: PROPFIND_PRINCIPAL_XML,
  });

  if (discoverRes.status === 401) throw new InvalidCredentialsError(serviceId);
  if (discoverRes.status >= 500) throw new ProviderUnavailableError(serviceId, discoverRes.status);

  // Case 1: Apple returns 207 Multi-Status directly (calendar-home-set in body)
  if (discoverRes.status === 207) {
    const text = await discoverRes.text();
    const home = extractCalendarHome(text);
    if (home) return home.startsWith('http') ? home : `${CALDAV_BASE}${home}`;
  }

  // Case 2: 3xx redirect to user-specific principal URL
  const location = discoverRes.headers.get('Location');
  if (!location) throw new ProviderUnavailableError(serviceId, discoverRes.status);
  const principalUrl = location.startsWith('http') ? location : `${CALDAV_BASE}${location}`;

  const principalRes = await fetch(principalUrl, {
    method: 'PROPFIND',
    headers: { Authorization: authHeader, 'Content-Type': 'application/xml; charset=utf-8', Depth: '0' },
    body: PROPFIND_PRINCIPAL_XML,
  });
  if (principalRes.status === 401) throw new InvalidCredentialsError(serviceId);
  if (!principalRes.ok) throw new ProviderUnavailableError(serviceId, principalRes.status);

  const text = await principalRes.text();
  const home = extractCalendarHome(text);
  if (!home) throw new ProviderUnavailableError(serviceId, principalRes.status);
  return home.startsWith('http') ? home : `${CALDAV_BASE}${home}`;
}

function extractCalendarHome(xmlText: string): string | null {
  const homeMatch = xmlText.match(/<[^>\s/]*:?calendar-home-set[^>]*>\s*<[^>\s/]*:?href[^>]*>\s*([^<]+)\s*<\/[^>]*:?href>/i);
  return homeMatch ? homeMatch[1].trim() : null;
}

function toAbsoluteUrl(href: string): string {
  return href.startsWith('http') ? href : `${CALDAV_BASE}${href}`;
}

export class AppleCalendarAdapter implements IntegrationAdapter {
  readonly serviceId = 'apple_calendar' as const;

  async getAuthorizationUrl(_state: string, _options?: ConnectOptions): Promise<string> {
    throw new NotSupportedError('apple_calendar', 'getAuthorizationUrl');
  }

  async connect(
    userId: string,
    payload: ConnectPayload,
    options?: ConnectOptions
  ): Promise<{ integrationId: string; accountIdentifier: string }> {
    if (payload.type !== 'credential') {
      throw new NotSupportedError('apple_calendar', 'connect with OAuth');
    }
    const { email, password } = payload;
    await this.validateCredentials(email, password);

    const windowDays = options?.calendarEventWindowDays ?? 30;
    const accountIdentifier = email;

    const existing = await prisma.integration.findFirst({
      where: { userId, serviceId: 'apple_calendar', accountIdentifier },
    });

    let integration;
    if (existing) {
      integration = await prisma.integration.update({
        where: { id: existing.id },
        data: {
          status: 'connected',
          encryptedAccessToken: encrypt(email),
          encryptedRefreshToken: encrypt(password),
          tokenExpiresAt: null,
          calendarEventWindowDays: windowDays,
          lastSyncError: null,
        },
      });
    } else {
      const count = await prisma.integration.count({ where: { userId, serviceId: 'apple_calendar' } });
      if (count >= 5) throw new AccountLimitError('apple_calendar', 5);

      integration = await prisma.integration.create({
        data: {
          userId,
          serviceId: 'apple_calendar',
          accountIdentifier,
          status: 'connected',
          encryptedAccessToken: encrypt(email),
          encryptedRefreshToken: encrypt(password),
          tokenExpiresAt: null,
          calendarEventWindowDays: windowDays,
          lastSyncError: null,
        },
      });
    }

    return { integrationId: integration.id, accountIdentifier };
  }

  private async validateCredentials(email: string, asp: string): Promise<void> {
    const basic = Buffer.from(`${email}:${asp}`).toString('base64');
    // Use .well-known/caldav with redirect:manual — Apple redirects the root to the
    // user-specific principal URL. A redirect (3xx) means the server accepted the
    // credentials and is sending us to the right place. Only 401 = bad creds.
    const res = await fetch(`${CALDAV_BASE}/.well-known/caldav`, {
      method: 'PROPFIND',
      redirect: 'manual',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/xml; charset=utf-8',
        Depth: '0',
      },
      body: PROPFIND_XML,
    });
    if (res.status === 401) throw new InvalidCredentialsError('apple_calendar');
    if (res.status >= 500) throw new ProviderUnavailableError('apple_calendar', res.status);
    // 2xx (207 Multi-Status) or 3xx (redirect to user principal) both indicate valid credentials
  }

  async disconnect(integrationId: string): Promise<void> {
    await prisma.$transaction([
      prisma.syncCacheItem.deleteMany({ where: { integrationId } }),
      prisma.integration.update({
        where: { id: integrationId },
        data: {
          status: 'disconnected',
          encryptedAccessToken: '',
          encryptedRefreshToken: null,
          tokenExpiresAt: null,
        },
      }),
    ]);
  }

  async refreshToken(integrationId: string): Promise<void> {
    throw new NotSupportedError('apple_calendar', 'refreshToken');
  }

  async sync(integrationId: string): Promise<NormalizedItem[]> {
    const integration = await prisma.integration.findUnique({ where: { id: integrationId } });
    if (!integration || integration.status === 'disconnected') return [];

    const email = decrypt(integration.encryptedAccessToken);
    const asp = decrypt(integration.encryptedRefreshToken!);
    const basic = Buffer.from(`${email}:${asp}`).toString('base64');
    const authHeader = `Basic ${basic}`;

    const importEverything = integration.importEverything ?? true;
    const selectedSubSourceIds = integration.selectedSubSourceIds ?? [];
    const windowDays = integration.calendarEventWindowDays ?? 30;

    const calHome = await discoverCalendarHome(authHeader, 'apple_calendar');
    const propfindRes = await fetch(calHome, {
      method: 'PROPFIND',
      headers: { Authorization: authHeader, 'Content-Type': 'application/xml; charset=utf-8', Depth: '1' },
      body: PROPFIND_XML,
    });

    if (propfindRes.status === 401) throw new InvalidCredentialsError('apple_calendar');
    if (!propfindRes.ok) throw new ProviderUnavailableError('apple_calendar', propfindRes.status);

    const propfindText = await propfindRes.text();
    const collections = parseCalDAVCollections(propfindText, 'VEVENT');

    if (!importEverything && selectedSubSourceIds.length === 0) return [];
    const filteredCollections = importEverything
      ? collections
      : collections.filter((c) => selectedSubSourceIds.includes(c.href));

    const now = new Date();
    const future = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);
    const toCalDAVDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const reportBody = `<?xml version="1.0" encoding="UTF-8"?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop><D:getetag/><C:calendar-data/></D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="${toCalDAVDate(now)}" end="${toCalDAVDate(future)}"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`;

    const items: NormalizedItem[] = [];
    for (const collection of filteredCollections) {
      try {
        const calRes = await fetch(toAbsoluteUrl(collection.href), {
          method: 'REPORT',
          headers: { Authorization: authHeader, 'Content-Type': 'application/xml; charset=utf-8', Depth: '1' },
          body: reportBody,
        });
        if (!calRes.ok) continue;
        items.push(...parseVEventItems(await calRes.text(), collection.href));
      } catch (err) {
        logger.warn('Apple Calendar collection fetch failed', { href: collection.href, error: (err as Error).message });
      }
    }
    return items;
  }

  async listSubSources(integrationId: string): Promise<SubSource[]> {
    try {
      const integration = await prisma.integration.findUnique({ where: { id: integrationId } });
      if (!integration) return [];
      const email = decrypt(integration.encryptedAccessToken);
      if (!integration.encryptedRefreshToken) return [];
      const asp = decrypt(integration.encryptedRefreshToken);
      const basic = Buffer.from(`${email}:${asp}`).toString('base64');
      const authHeader = `Basic ${basic}`;
      const calHome = await discoverCalendarHome(authHeader, 'apple_calendar');
      const res = await fetch(calHome, {
        method: 'PROPFIND',
        headers: { Authorization: authHeader, 'Content-Type': 'application/xml; charset=utf-8', Depth: '1' },
        body: PROPFIND_XML,
      });
      if (!res.ok) return [];
      return parseCalDAVCollections(await res.text(), 'VEVENT').map((c) => ({
        id: c.href,
        label: c.displayName,
        type: 'calendar' as const,
      }));
    } catch {
      return [];
    }
  }
}

function parseCalDAVCollections(xmlText: string, componentType: 'VTODO' | 'VEVENT'): Array<{ href: string; displayName: string }> {
  const collections: Array<{ href: string; displayName: string }> = [];
  const responseBlocks = xmlText.split(/<[^>\s/]*:?response[^>]*>/i);
  for (const block of responseBlocks.slice(1)) {
    const hrefMatch = block.match(/<[^>\s/]*:?href[^>]*>\s*([^<]+)\s*<\/[^>]*:?href>/i);
    const nameMatch = block.match(/<[^>\s/]*:?displayname[^>]*>\s*([^<]*)\s*<\/[^>]*:?displayname>/i);
    const compMatch = block.match(new RegExp(`name=["']${componentType}["']`, 'i'));
    const isRoot = hrefMatch && /^\/[^/]+\/calendars\/?$/.test(hrefMatch[1].trim());
    if (hrefMatch && nameMatch && compMatch && !isRoot) {
      collections.push({ href: hrefMatch[1].trim(), displayName: nameMatch[1].trim() });
    }
  }
  return collections;
}

function parseICalDate(s: string): Date | null {
  let iso: string;
  if (s.length === 8) {
    // YYYYMMDD → YYYY-MM-DD
    iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  } else if (s.length >= 15) {
    // YYYYMMDDTHHmmss[Z] → YYYY-MM-DDTHH:mm:ss[Z]
    iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}${s.endsWith('Z') ? 'Z' : ''}`;
  } else {
    return null;
  }
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function parseVEventItems(xmlText: string, subSourceId?: string): NormalizedItem[] {
  const items: NormalizedItem[] = [];
  const calDataMatches = xmlText.matchAll(/<[^>\s/]*:?calendar-data[^>]*>([\s\S]*?)<\/[^>]*:?calendar-data>/gi);
  for (const match of calDataMatches) {
    const calData = match[1].replace(/&#13;/g, '').replace(/\r/g, '');
    const uidMatch = calData.match(/^UID:(.+)$/m);
    const summaryMatch = calData.match(/^SUMMARY:(.+)$/m);
    const dtStartMatch = calData.match(/^DTSTART(?:;[^:]*)?:(\d{8}(?:T\d{6}Z?)?)/m);
    const dtEndMatch = calData.match(/^DTEND(?:;[^:]*)?:(\d{8}(?:T\d{6}Z?)?)/m);
    const descMatch = calData.match(/^DESCRIPTION:(.+)$/m);
    const urlMatch = calData.match(/^URL:(.+)$/m);
    if (!uidMatch || !summaryMatch) continue;
    const body = descMatch ? descMatch[1].trim() : null;
    const url = urlMatch ? urlMatch[1].trim() : null;
    items.push({
      externalId: uidMatch[1].trim(),
      itemType: 'event',
      title: summaryMatch[1].trim(),
      dueAt: null,
      startAt: dtStartMatch ? parseICalDate(dtStartMatch[1]) : null,
      endAt: dtEndMatch ? parseICalDate(dtEndMatch[1]) : null,
      subSourceId,
      body,
      url,
      rawPayload: { calData: '[redacted]' },
    });
  }
  return items;
}

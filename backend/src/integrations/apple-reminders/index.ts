// Apple Reminders Integration Adapter — Basic Auth (iCloud email + App-Specific Password)

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
} from '../_adapter/types.js';

const CALDAV_BASE = 'https://caldav.icloud.com';

const PROPFIND_COLLECTIONS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<A:propfind xmlns:A="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <A:prop>
    <A:resourcetype/>
    <A:displayname/>
    <C:supported-calendar-component-set/>
  </A:prop>
</A:propfind>`;

// Used for .well-known discovery — ask for current-user-principal and calendar-home-set
const PROPFIND_PRINCIPAL_XML = `<?xml version="1.0" encoding="UTF-8"?>
<A:propfind xmlns:A="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <A:prop>
    <A:current-user-principal/>
    <C:calendar-home-set/>
  </A:prop>
</A:propfind>`;

/**
 * Apple's CalDAV server rejects PROPFIND on the root ('/') with HTTP 400.
 * The correct flow is:
 *  1. PROPFIND /.well-known/caldav with redirect:manual → get Location (user principal URL)
 *  2. PROPFIND the principal URL → extract calendar-home-set href
 *  3. PROPFIND the calendar-home-set with Depth:1 → list collections
 */
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
  // Match any namespace prefix: C:, cal:, CAL:, D:, etc.
  const homeMatch = xmlText.match(/<[^>\s/]*calendar-home-set[^>]*>\s*<[^>\s/]*href[^>]*>\s*([^<]+)\s*<\/[^>]*href>/i);
  return homeMatch ? homeMatch[1].trim() : null;
}

function toAbsoluteUrl(href: string): string {
  return href.startsWith('http') ? href : `${CALDAV_BASE}${href}`;
}

// Keep old name as alias for compatibility within this file
const PROPFIND_XML = PROPFIND_COLLECTIONS_XML;

export class AppleRemindersAdapter implements IntegrationAdapter {
  readonly serviceId = 'apple_reminders' as const;

  async getAuthorizationUrl(_state: string, _options?: ConnectOptions): Promise<string> {
    throw new NotSupportedError('apple_reminders', 'getAuthorizationUrl');
  }

  async connect(
    userId: string,
    payload: ConnectPayload,
    _options?: ConnectOptions
  ): Promise<{ integrationId: string }> {
    if (payload.type !== 'credential') {
      throw new NotSupportedError('apple_reminders', 'connect with OAuth');
    }
    const { email, password } = payload;
    await this.validateCredentials(email, password);

    const integration = await prisma.integration.upsert({
      where: { userId_serviceId: { userId, serviceId: 'apple_reminders' } },
      create: {
        userId,
        serviceId: 'apple_reminders',
        status: 'connected',
        encryptedAccessToken: encrypt(email),
        encryptedRefreshToken: encrypt(password),
        tokenExpiresAt: null,
        lastSyncError: null,
      },
      update: {
        status: 'connected',
        encryptedAccessToken: encrypt(email),
        encryptedRefreshToken: encrypt(password),
        tokenExpiresAt: null,
        lastSyncError: null,
      },
    });
    return { integrationId: integration.id };
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
    if (res.status === 401) throw new InvalidCredentialsError('apple_reminders');
    if (res.status >= 500) throw new ProviderUnavailableError('apple_reminders', res.status);
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
    throw new NotSupportedError('apple_reminders', 'refreshToken');
  }

  async sync(integrationId: string): Promise<NormalizedItem[]> {
    const integration = await prisma.integration.findUnique({ where: { id: integrationId } });
    if (!integration || integration.status !== 'connected') return [];

    const email = decrypt(integration.encryptedAccessToken);
    const asp = decrypt(integration.encryptedRefreshToken!);
    const basic = Buffer.from(`${email}:${asp}`).toString('base64');
    const authHeader = `Basic ${basic}`;

    const importEverything = integration.importEverything ?? true;
    const selectedSubSourceIds = integration.selectedSubSourceIds ?? [];

    const calHome = await discoverCalendarHome(authHeader, 'apple_reminders');

    const propfindRes = await fetch(calHome, {
      method: 'PROPFIND',
      headers: { Authorization: authHeader, 'Content-Type': 'application/xml; charset=utf-8', Depth: '1' },
      body: PROPFIND_XML,
    });

    if (propfindRes.status === 401) throw new InvalidCredentialsError('apple_reminders');
    if (!propfindRes.ok) throw new ProviderUnavailableError('apple_reminders', propfindRes.status);

    const propfindText = await propfindRes.text();
    const collections = parseCalDAVCollections(propfindText, 'VTODO');

    if (!importEverything && selectedSubSourceIds.length === 0) return [];
    const filteredCollections = importEverything
      ? collections
      : collections.filter((c) => selectedSubSourceIds.includes(c.href));

    // Simple query — fetch all VTODOs, filter completed in-process.
    // Apple's CalDAV doesn't reliably support prop-filter/text-match negate.
    const reportBody = `<?xml version="1.0" encoding="UTF-8"?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop><D:getetag/><C:calendar-data/></D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VTODO"/>
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
        items.push(...parseVTodoItems(await calRes.text(), collection.href));
      } catch (err) {
        logger.warn('Apple Reminders collection fetch failed', { href: collection.href, error: (err as Error).message });
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
      const calHome = await discoverCalendarHome(authHeader, 'apple_reminders');
      const res = await fetch(calHome, {
        method: 'PROPFIND',
        headers: { Authorization: authHeader, 'Content-Type': 'application/xml; charset=utf-8', Depth: '1' },
        body: PROPFIND_XML,
      });
      if (!res.ok) return [];
      return parseCalDAVCollections(await res.text(), 'VTODO').map((c) => ({
        id: c.href,
        label: c.displayName,
        type: 'list' as const,
      }));
    } catch {
      return [];
    }
  }
}

function parseCalDAVCollections(xmlText: string, componentType: 'VTODO' | 'VEVENT'): Array<{ href: string; displayName: string }> {
  const collections: Array<{ href: string; displayName: string }> = [];
  // Split on any namespace-prefixed <response> tag
  const responseBlocks = xmlText.split(/<[^>\s/]*:?response[^>]*>/i);
  for (const block of responseBlocks.slice(1)) {
    const hrefMatch = block.match(/<[^>\s/]*:?href[^>]*>\s*([^<]+)\s*<\/[^>]*:?href>/i);
    const nameMatch = block.match(/<[^>\s/]*:?displayname[^>]*>\s*([^<]*)\s*<\/[^>]*:?displayname>/i);
    const compMatch = block.match(new RegExp(`name=["']${componentType}["']`, 'i'));
    // Only include actual calendar collections (href ends with a UUID-like path segment, not the root)
    const isRoot = hrefMatch && /^\/[^/]+\/calendars\/?$/.test(hrefMatch[1].trim());
    if (hrefMatch && nameMatch && compMatch && !isRoot) {
      collections.push({ href: hrefMatch[1].trim(), displayName: nameMatch[1].trim() });
    }
  }
  return collections;
}

function parseVTodoItems(xmlText: string, subSourceId?: string): NormalizedItem[] {
  const items: NormalizedItem[] = [];
  // Match calendar-data with any namespace prefix (C:, cal:, CAL:, etc.)
  const calDataMatches = xmlText.matchAll(/<[^>\s/]*:?calendar-data[^>]*>([\s\S]*?)<\/[^>]*:?calendar-data>/gi);
  for (const match of calDataMatches) {
    const calData = match[1].replace(/&#13;/g, '').replace(/\r/g, '');
    const uidMatch = calData.match(/^UID:(.+)$/m);
    const summaryMatch = calData.match(/^SUMMARY:(.+)$/m);
    const statusMatch = calData.match(/^STATUS:(.+)$/m);
    if (!uidMatch || !summaryMatch) continue;
    if (statusMatch && statusMatch[1].trim().toUpperCase() === 'COMPLETED') continue;
    const dueMatch = calData.match(/^DUE(?:;[^:]*)?:(\d{8}(?:T\d{6}Z?)?)/m);
    const externalId = uidMatch[1].trim();
    const title = summaryMatch[1].trim();
    let dueAt: Date | null = null;
    if (dueMatch) {
      const dStr = dueMatch[1];
      if (dStr.length === 8) {
        const d = new Date(`${dStr.slice(0, 4)}-${dStr.slice(4, 6)}-${dStr.slice(6, 8)}`);
        if (!isNaN(d.getTime())) dueAt = d;
      } else if (dStr.length >= 15) {
        const iso = `${dStr.slice(0, 4)}-${dStr.slice(4, 6)}-${dStr.slice(6, 8)}T${dStr.slice(9, 11)}:${dStr.slice(11, 13)}:${dStr.slice(13, 15)}${dStr.endsWith('Z') ? 'Z' : ''}`;
        const d = new Date(iso);
        if (!isNaN(d.getTime())) dueAt = d;
      }
    }
    items.push({ externalId, itemType: 'task', title, dueAt, startAt: null, endAt: null, subSourceId, rawPayload: { calData: '[redacted]' } });
  }
  return items;
}

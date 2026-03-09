# Quickstart: Implementing Apple iCloud Integration via App-Specific Password

**Feature**: 004-apple-basic-auth  
**Phase**: 1 — Design & Contracts  
**Audience**: Developer picking up tasks from `tasks.md`

This guide explains the architecture decisions, file-by-file change map, and local dev/test workflow for this feature. Read this before starting implementation.

---

## Context in 60 Seconds

The Apple Reminders and Apple Calendar adapters are currently broken because **Sign-in-with-Apple OAuth tokens are identity-only** — they do not grant access to iCloud CalDAV data. This feature replaces the OAuth flow with **iCloud Basic Auth** (email + App-Specific Password).

The changes touch four layers in a specific dependency order:
1. **`types.ts`** — add the discriminated union payload type, error classes (no deps)
2. **Prisma schema** — add `calendarEventWindowDays` field, run migration
3. **Apple adapters** — rewrite auth using Basic Auth (depends on 1)
4. **OAuth adapters** — thin wrapper migration (depends on 1)
5. **Service layer** — credential propagation, disconnect cleanup, new API functions (depends on 1–2)
6. **Routes** — new POST `/connect` and PUT `/event-window` endpoints (depends on 5)
7. **Frontend** — `AppleCredentialForm`, `AppleConfirmationScreen`, `IntegrationCard` branch (depends on 6)

Implement in this order to avoid circular compile errors.

---

## Step 1: Update `_adapter/types.ts`

**File**: `backend/src/integrations/_adapter/types.ts`

### Add these exports (all new)

```typescript
// Payload union
export type OAuthPayload = { type: 'oauth'; authCode: string };
export type CredentialPayload = { type: 'credential'; email: string; password: string };
export type ConnectPayload = OAuthPayload | CredentialPayload;

// Error classes
export class NotSupportedError extends Error { ... }
export class InvalidCredentialsError extends Error { ... }
export class ProviderUnavailableError extends Error { ... }
```

### Update `IntegrationAdapter` interface

Change `connect(userId, authCode, options?)` to `connect(userId, payload: ConnectPayload, options?)`.  
Add `calendarEventWindowDays?: 7 | 14 | 30 | 60` to `ConnectOptions`.

> See `data-model.md` for the exact TypeScript definitions.

### Why first?
Everything else imports from `types.ts`. Updating this file first lets TypeScript immediately surface all call sites that need updating.

---

## Step 2: Prisma Schema + Migration

**File**: `backend/prisma/schema.prisma`

Add to `Integration` model:
```prisma
calendarEventWindowDays Int @default(30)
```

Then run:
```bash
cd backend
npx prisma migrate dev --name add-calendar-event-window
npx prisma generate
```

The migration adds a non-nullable integer column with `DEFAULT 30` — safe for existing rows.

---

## Step 3: Rewrite Apple Adapters

**Files**:
- `backend/src/integrations/apple-reminders/index.ts`
- `backend/src/integrations/apple-calendar/index.ts`

### `connect()` rewrite

Replace the entire OAuth JWT + token exchange flow with:

```typescript
async connect(userId: string, payload: ConnectPayload, options?: ConnectOptions): Promise<{ integrationId: string }> {
  if (payload.type !== 'credential') {
    throw new NotSupportedError('Apple adapters require credential payload');
  }
  const { email, password } = payload; // password is already normalized (dashes stripped)

  // 1. Validate credentials against iCloud
  await this.validateCredentials(email, password);

  // 2. Upsert Integration record
  const integration = await prisma.integration.upsert({
    where: { userId_serviceId: { userId, serviceId: this.serviceId } },
    update: {
      encryptedAccessToken: encrypt(email),
      encryptedRefreshToken: encrypt(password),
      tokenExpiresAt: null,
      status: 'connected',
      lastSyncError: null,
      ...(this.serviceId === 'apple_calendar' && options?.calendarEventWindowDays
        ? { calendarEventWindowDays: options.calendarEventWindowDays }
        : {}),
    },
    create: {
      userId,
      serviceId: this.serviceId,
      encryptedAccessToken: encrypt(email),
      encryptedRefreshToken: encrypt(password),
      tokenExpiresAt: null,
      status: 'connected',
      calendarEventWindowDays: options?.calendarEventWindowDays ?? 30,
    },
  });
  return { integrationId: integration.id };
}
```

### `validateCredentials()` helper (private)

```typescript
private async validateCredentials(email: string, asp: string): Promise<void> {
  const auth = Buffer.from(`${email}:${asp}`).toString('base64');
  const res = await fetch('https://caldav.icloud.com/', {
    method: 'PROPFIND',
    headers: {
      Authorization: `Basic ${auth}`,
      Depth: '1',
      'Content-Type': 'application/xml; charset=utf-8',
    },
    body: PROPFIND_PRINCIPAL_XML,
  });

  if (res.status === 401) throw new InvalidCredentialsError('');
  if (!res.ok) throw new ProviderUnavailableError('', res.status);
  // 207 Multi-Status = valid credentials
}
```

### `refreshToken()` and `getAuthorizationUrl()` — throw

```typescript
async refreshToken(_integrationId: string): Promise<void> {
  throw new NotSupportedError();
}

async getAuthorizationUrl(_state: string): Promise<string> {
  throw new NotSupportedError();
}
```

### `sync()` — credential extraction

Replace JWT-based header construction with Basic Auth:
```typescript
const email = decrypt(integration.encryptedAccessToken);
const asp = decrypt(integration.encryptedRefreshToken!);
const authHeader = `Basic ${Buffer.from(`${email}:${asp}`).toString('base64')}`;
```

Wrap fetch calls to handle 401:
```typescript
if (res.status === 401) {
  throw new InvalidCredentialsError(integrationId);
}
if (!res.ok) {
  throw new ProviderUnavailableError(integrationId, res.status);
}
```

### Apple Calendar `sync()` — event window

Read `calendarEventWindowDays` from the integration record and build the time-range filter:
```typescript
const windowDays = integration.calendarEventWindowDays ?? 30;
const now = new Date();
const end = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);
// Use in CalDAV REPORT time-range: start=now, end=end
```

Remove the hardcoded `30` days.

---

## Step 4: Migrate OAuth Adapters

**Files**:
- `backend/src/integrations/gmail/index.ts`
- `backend/src/integrations/microsoft-tasks/index.ts`

Change `connect(userId: string, authCode: string, ...)` to `connect(userId: string, payload: ConnectPayload, ...)` and unwrap:

```typescript
async connect(userId: string, payload: ConnectPayload, options?: ConnectOptions) {
  if (payload.type !== 'oauth') {
    throw new Error('Gmail adapter requires OAuth payload');
  }
  const { authCode } = payload;
  // ... rest of existing logic unchanged
}
```

This is a mechanical change — **no logic changes** inside the methods.

---

## Step 5: Update Service Layer

**File**: `backend/src/integrations/integration.service.ts`

### `connectIntegration()` — add routing logic

```typescript
export async function connectIntegration(
  userId: string,
  serviceId: ServiceId,
  // Frontend sends raw body; service layer constructs the typed payload
  rawPayload: { type: 'credential'; email: string; password: string }
           | { type: 'use-existing' }
           | { type: 'oauth'; authCode: string },
  options?: ConnectOptions,
): Promise<{ integrationId: string }> {

  let adapterPayload: ConnectPayload;

  if (rawPayload.type === 'use-existing') {
    // Look up existing Apple credentials for this user
    const siblingServiceId = serviceId === 'apple_calendar' ? 'apple_reminders' : 'apple_calendar';
    const sibling = await prisma.integration.findFirst({
      where: { userId, serviceId: siblingServiceId, status: 'connected' },
    });
    if (!sibling || !sibling.encryptedRefreshToken) {
      throw new AppError('NO_EXISTING_CREDENTIALS', 'No iCloud credentials found');
    }
    adapterPayload = {
      type: 'credential',
      email: decrypt(sibling.encryptedAccessToken),
      password: decrypt(sibling.encryptedRefreshToken),
    };
  } else if (rawPayload.type === 'credential') {
    const normalizedAsp = rawPayload.password.replace(/-/g, '');
    adapterPayload = { type: 'credential', email: rawPayload.email, password: normalizedAsp };
  } else {
    adapterPayload = rawPayload; // { type: 'oauth', authCode }
  }

  const adapter = getAdapter(serviceId);
  const result = await adapter.connect(userId, adapterPayload, options);

  // Queue immediate sync (existing behavior)
  await syncQueue.add('sync', { integrationId: result.integrationId, userId });

  return result;
}
```

### `disconnectIntegration()` — add Apple cleanup

After the adapter's `disconnect()` call and before returning:
```typescript
if (serviceId === 'apple_reminders' || serviceId === 'apple_calendar') {
  const appleServiceIds: ServiceId[] = ['apple_reminders', 'apple_calendar'];
  const remaining = await prisma.integration.findMany({
    where: { userId, serviceId: { in: appleServiceIds }, status: 'connected' },
  });
  if (remaining.length === 0) {
    // No Apple integrations left connected → purge credentials from all Apple records
    await prisma.integration.updateMany({
      where: { userId, serviceId: { in: appleServiceIds } },
      data: { encryptedAccessToken: '', encryptedRefreshToken: null },
    });
  }
}
```

### `listIntegrations()` — add maskedEmail + calendarEventWindowDays

Compute `maskedEmail` for Apple services with credentials:
```typescript
const maskedEmail = (APPLE_SERVICE_IDS.includes(row.serviceId) && row.encryptedAccessToken)
  ? maskEmail(decrypt(row.encryptedAccessToken))
  : null;
```

Map `calendarEventWindowDays` — return `null` for disconnected:
```typescript
const calendarEventWindowDays = (row.serviceId === 'apple_calendar' && row.status !== 'disconnected')
  ? (row.calendarEventWindowDays as 7 | 14 | 30 | 60)
  : null;
```

### New function: `updateCalendarEventWindow()`

```typescript
export async function updateCalendarEventWindow(
  userId: string,
  days: 7 | 14 | 30 | 60,
): Promise<{ calendarEventWindowDays: number }> {
  const integration = await prisma.integration.findFirst({
    where: { userId, serviceId: 'apple_calendar', status: { not: 'disconnected' } },
  });
  if (!integration) throw new AppError('INTEGRATION_NOT_FOUND', 'No connected Apple Calendar integration');

  const updated = await prisma.integration.update({
    where: { id: integration.id },
    data: { calendarEventWindowDays: days },
  });
  return { calendarEventWindowDays: updated.calendarEventWindowDays };
}
```

### Sync error handling — catch `InvalidCredentialsError`

In the sync job handler (wherever `TokenRefreshError` is currently caught), add:
```typescript
} catch (err) {
  if (err instanceof InvalidCredentialsError) {
    await prisma.integration.update({
      where: { id: integrationId },
      data: { status: 'error', lastSyncError: 'iCloud credentials are no longer valid. Please reconnect.' },
    });
  } else if (err instanceof ProviderUnavailableError) {
    await prisma.integration.update({
      where: { id: integrationId },
      data: { status: 'error', lastSyncError: 'iCloud is temporarily unavailable. Will retry on next sync.' },
    });
    // Credentials are NOT cleared
  }
  // ... existing TokenRefreshError handling
}
```

---

## Step 6: Update Routes

**File**: `backend/src/api/integrations.routes.ts`

### Add `POST /api/integrations/:serviceId/connect`

```typescript
fastify.post('/integrations/:serviceId/connect', {
  preHandler: [requireAuth],
  schema: {
    params: z.object({ serviceId: z.enum(SERVICE_IDS) }),
    body: z.discriminatedUnion('type', [
      z.object({
        type: z.literal('credential'),
        email: z.string().email(),
        password: z.string().min(1),
        calendarEventWindowDays: z.union([z.literal(7), z.literal(14), z.literal(30), z.literal(60)]).optional(),
      }),
      z.object({ type: z.literal('use-existing') }),
    ]),
  },
}, async (request, reply) => {
  const { serviceId } = request.params;
  const { userId } = request.session;

  if (!APPLE_SERVICE_IDS.includes(serviceId)) {
    return reply.code(400).send({ code: 'UNSUPPORTED_SERVICE', message: 'Use OAuth flow for this service' });
  }

  try {
    const result = await connectIntegration(userId, serviceId, request.body, {
      calendarEventWindowDays: request.body.type === 'credential'
        ? request.body.calendarEventWindowDays
        : undefined,
    });
    return reply.send(result);
  } catch (err) {
    if (err instanceof InvalidCredentialsError) return reply.code(401).send({ code: 'INVALID_CREDENTIALS', message: '...' });
    if (err instanceof ProviderUnavailableError) return reply.code(503).send({ code: 'PROVIDER_UNAVAILABLE', message: '...' });
    if (err instanceof AppError && err.code === 'NO_EXISTING_CREDENTIALS') return reply.code(409).send(err);
    throw err;
  }
});
```

### Add `PUT /api/integrations/:serviceId/event-window`

```typescript
fastify.put('/integrations/:serviceId/event-window', {
  preHandler: [requireAuth],
  schema: {
    params: z.object({ serviceId: z.enum(SERVICE_IDS) }),
    body: z.object({
      days: z.union([z.literal(7), z.literal(14), z.literal(30), z.literal(60)]),
    }),
  },
}, async (request, reply) => {
  if (request.params.serviceId !== 'apple_calendar') {
    return reply.code(400).send({ code: 'UNSUPPORTED_SERVICE' });
  }
  const result = await updateCalendarEventWindow(request.session.userId, request.body.days);
  return reply.send(result);
});
```

---

## Step 7: Frontend Changes

### `frontend/src/components/AppleCredentialForm.tsx` (new)

```tsx
interface AppleCredentialFormProps {
  serviceId: 'apple_reminders' | 'apple_calendar';
  onSuccess: () => void;
  onError: (message: string) => void;
}
```

- `<input type="email">` for iCloud email
- `<input type="password">` for ASP
- Callout: "An App-Specific Password lets ordrctrl access your iCloud data without sharing your Apple ID password." + link to `https://appleid.apple.com` with text "Generate one at appleid.apple.com ↗"
- Submit → `connectWithCredentials(serviceId, email, password)`
- Display inline error on 401 response (do not reload)

### `frontend/src/components/AppleConfirmationScreen.tsx` (new)

```tsx
interface AppleConfirmationScreenProps {
  serviceId: 'apple_reminders' | 'apple_calendar';
  maskedEmail: string;           // e.g. "j***@icloud.com"
  onSuccess: () => void;
  onError: (message: string) => void;
}
```

- Display: "Connect {Apple Calendar} using your iCloud account **{maskedEmail}**?"
- Single button: "Connect with this account"
- Submit → `confirmWithExisting(serviceId)`

### `frontend/src/components/IntegrationCard.tsx` (modified)

In the "Connect" action section, branch on `serviceId`:

```tsx
// Pseudocode
if (serviceId === 'apple_reminders' || serviceId === 'apple_calendar') {
  const siblingStatus = integrations.find(i =>
    i.serviceId === (serviceId === 'apple_reminders' ? 'apple_calendar' : 'apple_reminders')
  );
  const hasExistingCredentials = siblingStatus?.maskedEmail != null;

  if (hasExistingCredentials) {
    return <AppleConfirmationScreen maskedEmail={siblingStatus.maskedEmail} ... />;
  } else {
    return <AppleCredentialForm serviceId={serviceId} ... />;
  }
} else {
  // Existing OAuth connect link
  return <a href={getConnectUrl(serviceId)}>Connect</a>;
}
```

---

## Local Development Workflow

### Running the backend

```bash
cd backend
cp .env.example .env           # ensure TOKEN_ENCRYPTION_KEY is set (64-char hex)
npx prisma migrate dev         # run pending migrations
pnpm dev                       # start Fastify dev server
```

### Running tests

```bash
cd backend
pnpm test                      # Vitest: runs all unit + integration tests
pnpm test:contract             # contract tests only
```

### Testing Apple auth locally (without real iCloud)

Use a mock CalDAV server or intercept HTTP calls in tests. The adapter's `validateCredentials()` should be mockable via dependency injection or `vi.mock('node-fetch')`.

Example Vitest mock:
```typescript
import { vi } from 'vitest';
import * as nodeFetch from 'node-fetch';

vi.spyOn(nodeFetch, 'default').mockResolvedValueOnce({
  status: 207,
  ok: true,
  text: async () => MOCK_PROPFIND_RESPONSE,
} as any);
```

### Environment variables for Apple features

No new environment variables are needed. The following Apple-specific env vars from the current OAuth implementation can be **removed** once the adapters are rewritten:
- `APPLE_REMINDERS_CLIENT_ID`
- `APPLE_REMINDERS_TEAM_ID`
- `APPLE_REMINDERS_KEY_ID`
- `APPLE_REMINDERS_PRIVATE_KEY`
- `APPLE_CALENDAR_CLIENT_ID`
- `APPLE_CALENDAR_TEAM_ID`
- `APPLE_CALENDAR_KEY_ID`
- `APPLE_CALENDAR_PRIVATE_KEY`

> **Remove these from `.env.example` and any CI secret configuration as part of this feature.**

---

## Testing Checklist

Before marking a task done, verify:

**Adapter unit tests** (`backend/tests/unit/integrations/`):
- [ ] `connect()` with valid `CredentialPayload` → calls PROPFIND → returns integrationId
- [ ] `connect()` with `OAuthPayload` → throws `NotSupportedError`
- [ ] `connect()` with PROPFIND returning 401 → throws `InvalidCredentialsError`
- [ ] `connect()` with PROPFIND returning 503 → throws `ProviderUnavailableError`
- [ ] `refreshToken()` → throws `NotSupportedError`
- [ ] `getAuthorizationUrl()` → throws `NotSupportedError`
- [ ] `sync()` with 401 → throws `InvalidCredentialsError`
- [ ] `sync()` with 5xx → throws `ProviderUnavailableError`
- [ ] ASP with dashes accepted at service layer; adapter receives stripped form
- [ ] Apple Calendar sync reads `calendarEventWindowDays` from integration record

**Service layer tests** (`backend/tests/unit/services/`):
- [ ] `connectIntegration()` with `use-existing` → copies credentials from sibling integration
- [ ] `connectIntegration()` with `use-existing` and no sibling → throws `NO_EXISTING_CREDENTIALS`
- [ ] `disconnectIntegration()` when only Apple service → clears both records' credentials
- [ ] `disconnectIntegration()` when sibling is still connected → retains sibling credentials
- [ ] `listIntegrations()` returns `maskedEmail` for Apple service with credentials
- [ ] `listIntegrations()` returns `maskedEmail: null` for disconnected Apple service with no credentials
- [ ] `updateCalendarEventWindow()` with valid days → updates record
- [ ] `updateCalendarEventWindow()` for non-existent integration → throws `INTEGRATION_NOT_FOUND`

**OAuth adapter regression tests**:
- [ ] Gmail `connect()` with `{ type: 'oauth', authCode }` → works unchanged
- [ ] Microsoft `connect()` with `{ type: 'oauth', authCode }` → works unchanged

**Route tests** (`backend/tests/contract/`):
- [ ] `POST /connect` with valid credentials → 200
- [ ] `POST /connect` with invalid credentials → 401 with `INVALID_CREDENTIALS`
- [ ] `POST /connect` with `use-existing` and no credentials → 409
- [ ] `POST /connect` for Gmail → 400 with `UNSUPPORTED_SERVICE`
- [ ] `PUT /event-window` with valid days → 200
- [ ] `PUT /event-window` with invalid days → 400

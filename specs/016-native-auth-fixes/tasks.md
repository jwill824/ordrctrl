# Tasks: Native App Auth Fixes

**Input**: Design documents from `/specs/016-native-auth-fixes/`
**Branch**: `016-native-auth-fixes`
**Closes**: #53, #54, #55

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Create the `oauth-state.ts` module that all auth route changes in Phase 2 depend on. Must be complete before US1 route changes begin.

**⚠️ CRITICAL**: US1 implementation cannot start until T001 is complete.

- [X] T001 Create `backend/src/auth/oauth-state.ts` — export two functions using the existing `redis` client from `backend/src/lib/redis.ts`: (1) `setOAuthState(state: string, entry: OAuthStateEntry): Promise<void>` — writes `oauth:state:{state}` with JSON value and 300s TTL; (2) `getAndDeleteOAuthState(state: string): Promise<OAuthStateEntry | null>` — reads then immediately deletes the key, returns parsed entry or null if missing/invalid. Export the `OAuthStateEntry` interface `{ platform: 'web' | 'capacitor' | 'tauri' }`.
- [X] T002 [P] Create `backend/tests/unit/auth/oauth-state.test.ts` — four Vitest unit tests with mocked `ioredis` (use `vi.mock`): (1) `setOAuthState` calls `redis.setex` with correct key `oauth:state:{state}`, TTL 300, and JSON-stringified entry; (2) `getAndDeleteOAuthState` calls `redis.get` then `redis.del` and returns parsed entry when key exists; (3) `getAndDeleteOAuthState` returns `null` when key is missing; (4) `getAndDeleteOAuthState` returns `null` and does not throw when Redis returns malformed JSON.

**Checkpoint**: `oauth-state.ts` module exists and tests are written → Phase 2 can begin.

---

## Phase 2: User Story 1 — Apple Sign In Works on iOS Simulator (Priority: P1) 🎯 MVP

**Goal**: Fix both root causes of Apple Sign In failure on the iOS simulator (#53, #54): remove `response_mode: 'form_post'` (Bug 2) and replace session-based state storage with Redis (Bug 1).

**Independent Test**: Launch the native app on the iOS simulator, tap "Sign in with Apple," complete the Apple ID prompt, and confirm the app navigates to the authenticated feed view with no error. See `quickstart.md` Steps 1–7.

- [X] T003 [P] [US1] Remove `response_mode: 'form_post'` from `getAppleAuthorizationUrl` in `backend/src/auth/providers/apple.ts` (line ~31) — delete the `response_mode: 'form_post'` property from the `authorizationUrl` options object so Apple defaults to `response_mode: 'query'` (standard OAuth 2.0 GET redirect). No other changes to this file.
- [X] T004 [US1] Update both OAuth initiation handlers in `backend/src/api/auth.routes.ts` — in `GET /api/auth/google` (line ~174) and `GET /api/auth/apple` (line ~234): import `setOAuthState` from `../auth/oauth-state.js`; replace the two `(request.session as any).oauthState = state` and `(request.session as any).oauthPlatform = platform ?? 'web'` assignments with a single `await setOAuthState(state, { platform: (platform ?? 'web') as OAuthStateEntry['platform'] })` call. Remove all `(request.session as any).oauthState` and `(request.session as any).oauthPlatform` writes from both handlers.
- [X] T005 [US1] Update both OAuth callback handlers in `backend/src/api/auth.routes.ts` — in `GET /api/auth/google/callback` (line ~183) and `POST /api/auth/apple/callback` (line ~242): import `getAndDeleteOAuthState` from `../auth/oauth-state.js`; replace `const expectedState = (request.session as any).oauthState` and `const isNative = ['tauri', 'capacitor'].includes((request.session as any).oauthPlatform)` with `const entry = await getAndDeleteOAuthState(state ?? '')` and `const isNative = entry ? ['tauri', 'capacitor'].includes(entry.platform) : false`; treat `entry === null` as an invalid state condition (redirect to error URL). Remove all remaining `(request.session as any).oauthState` and `(request.session as any).oauthPlatform` reads and clears from both handlers.
- [X] T006 [P] [US1] Remove `oauthState` and `oauthPlatform` from the `FastifySessionObject` type augmentation in `backend/src/auth/session.plugin.ts` — delete the two property declarations (`oauthState?: string` and `oauthPlatform?: string`) from the `declare module '@fastify/session'` block. No other changes to this file.

**Checkpoint**: All four files updated. Run `pnpm test` in `backend/`. Confirm unit tests pass. Then follow `quickstart.md` Steps 3–7 to verify Apple Sign In completes end-to-end on iOS simulator.

---

## Phase 3: User Story 2 — Authentication on Physical Devices via ngrok (Priority: P2)

**Goal**: Enable physical iOS/Android device testing by providing a public HTTPS tunnel to the local backend (#55). Apple's OAuth requires HTTPS redirect URIs, so ngrok also unblocks Apple Sign In on any real device.

**Independent Test**: Connect a physical iPhone, run `pnpm dev:ngrok` in backend/, run `pnpm dev:device` in both backend/ and frontend/, and complete a full Apple Sign In flow on the device. See `quickstart.md` daily device workflow.

- [X] T007 [US2] Add `@ngrok/ngrok` to `devDependencies` in `backend/package.json`; add script `"dev:ngrok": "ngrok http --domain=$NGROK_DOMAIN 4000"`; add `"dev:device": "DOTENV_OVERLAY=.env.device.local tsx watch src/server.ts"` to backend scripts; add `"dev:device": "vite --mode device"` to frontend scripts; run `pnpm install` from `backend/` to install the new package.
- [X] T008 [P] [US2] Create `backend/.env.device.example` and `frontend/.env.device.example` as committed templates showing the ngrok override vars (`API_URL`, `NGROK_AUTHTOKEN`, `NGROK_DOMAIN` in backend; `VITE_API_URL` in frontend). Add `DOTENV_OVERLAY` support in `backend/src/server.ts`. Ensure `.env.device.local` files are gitignored by the existing `.env.*.local` pattern. Developers copy the example files to `.env.device.local` and fill in their static ngrok domain.

**Checkpoint**: `pnpm dev:ngrok` starts in `backend/`; `pnpm dev:device` starts both backend and frontend using ngrok URL. Follow `quickstart.md` device workflow to verify physical device auth.

---

## Phase 4: Polish & Verification

**Purpose**: Confirm no regressions in the existing test suite and that both user stories pass their independent tests end-to-end.

- [X] T009 Run `pnpm test` from the repo root and confirm all backend unit tests pass, including the new `oauth-state.test.ts` — zero failures expected
- [X] T010 [P] Verify `GET /api/auth/google` and `GET /api/auth/google/callback` still work in the browser (web platform) by completing a Google Sign In flow in the local dev environment — confirms the Redis state store works for the existing GET-based callback flow in addition to Apple's fixed flow

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Foundational)**: No dependencies — start immediately
- **Phase 2 (US1)**: T003 and T004 depend on T001 being complete (imports `oauth-state.ts`)
- **Phase 3 (US2)**: No dependency on Phase 2 — can start immediately after Phase 1, or in parallel with Phase 2
- **Phase 4 (Polish)**: Depends on all prior phases complete

### Task Dependencies

- **T001** → T004, T005 (both import from `oauth-state.ts`)
- **T002** → no downstream dependencies (test file only)
- **T003** → independent of T001 (different file)
- **T004** → T005 (T005 updates the same file as T004 — do sequentially to avoid conflicts)
- **T006** → independent of T003–T005 (different file)
- **T007** → T008 (same file — do sequentially)

### Parallel Opportunities

```
Phase 1:
  T001 (create oauth-state.ts)
  T002 [P] (write tests)         ← parallel with T001
  T003 [P] (fix apple.ts)        ← parallel with T001, T002 (different file)

Phase 2 (after T001 complete):
  T004 → T005 (same file, sequential)
  T006 [P] (session.plugin.ts)   ← parallel with T004/T005 (different file)

Phase 3 (any time after Phase 1):
  T007 → T008 (same file, sequential)
```

---

## Implementation Strategy

### MVP (User Story 1 only)

1. Complete Phase 1: T001 + T002 + T003 (T002/T003 in parallel with T001)
2. Complete Phase 2: T004 → T005, T006 in parallel
3. **STOP and VALIDATE**: Apple Sign In works on iOS simulator (quickstart.md Steps 3–7)
4. Delivers: issues #53 and #54 closed ✅

### Full Delivery (Both User Stories)

5. Complete Phase 3: T007 → T008
6. **VALIDATE**: Physical device auth works via ngrok (quickstart.md Steps 1–8)
7. Complete Phase 4: T009, T010
8. Delivers: all three issues #53, #54, #55 closed ✅

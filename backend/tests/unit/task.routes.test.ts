// T03 — Route-level tests for POST/PATCH /api/tasks with startAt, duration, endAt

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/tasks/task.service.js', () => ({
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  uncompleteTask: vi.fn(),
}));

import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import { registerTaskRoutes } from '../../src/api/tasks.routes.js';
import { createTask, updateTask } from '../../src/tasks/task.service.js';

const mockCreateTask = createTask as ReturnType<typeof vi.fn>;
const mockUpdateTask = updateTask as ReturnType<typeof vi.fn>;

const SCHEDULED_RESULT = {
  id: 'native:task-1',
  source: 'ordrctrl',
  itemType: 'task',
  title: 'Stand-up',
  dueAt: null,
  startAt: '2026-06-05T09:00:00.000Z',
  duration: 30,
  endAt: '2026-06-05T09:30:00.000Z',
  completed: false,
  completedAt: null,
  isDuplicateSuspect: false,
};

const UNSCHEDULED_RESULT = {
  id: 'native:task-2',
  source: 'ordrctrl',
  itemType: 'task',
  title: 'Plain task',
  dueAt: null,
  startAt: null,
  duration: null,
  endAt: null,
  completed: false,
  completedAt: null,
  isDuplicateSuspect: false,
};

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(fastifyCookie);
  await app.register(fastifySession, {
    secret: 'test-session-secret-for-tests-12345678901234567890',
    cookie: { secure: false },
  });
  app.addHook('preHandler', async (request) => {
    (request.session as { userId?: string }).userId = 'user-1';
  });
  await registerTaskRoutes(app);
  await app.ready();
  return app;
}

async function buildUnauthApp() {
  const app = Fastify({ logger: false });
  await app.register(fastifyCookie);
  await app.register(fastifySession, {
    secret: 'test-session-secret-for-tests-12345678901234567890',
    cookie: { secure: false },
  });
  await registerTaskRoutes(app);
  await app.ready();
  return app;
}

describe('POST /api/tasks — scheduling fields', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    app = await buildApp();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('201 — with startAt + duration returns computed endAt', async () => {
    mockCreateTask.mockResolvedValue(SCHEDULED_RESULT);

    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: {
        title: 'Stand-up',
        startAt: '2026-06-05T09:00:00.000Z',
        duration: 30,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.startAt).toBe('2026-06-05T09:00:00.000Z');
    expect(body.duration).toBe(30);
    expect(body.endAt).toBe('2026-06-05T09:30:00.000Z');
  });

  it('201 — without startAt/duration returns null for all three fields', async () => {
    mockCreateTask.mockResolvedValue(UNSCHEDULED_RESULT);

    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: 'Plain task' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.startAt).toBeNull();
    expect(body.duration).toBeNull();
    expect(body.endAt).toBeNull();
  });

  it('201 — calls createTask with parsed Date for startAt', async () => {
    mockCreateTask.mockResolvedValue(SCHEDULED_RESULT);

    await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: {
        title: 'Stand-up',
        startAt: '2026-06-05T09:00:00.000Z',
        duration: 30,
      },
    });

    expect(mockCreateTask).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        startAt: new Date('2026-06-05T09:00:00.000Z'),
        duration: 30,
      })
    );
  });

  it('422 — non-ISO startAt string is rejected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: 'Bad date', startAt: 'not-a-date' },
    });

    expect(res.statusCode).toBe(422);
    expect(mockCreateTask).not.toHaveBeenCalled();
  });

  it('422 — negative duration is rejected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: 'Neg dur', duration: -10 },
    });

    expect(res.statusCode).toBe(422);
    expect(mockCreateTask).not.toHaveBeenCalled();
  });

  it('422 — zero duration is rejected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: 'Zero dur', duration: 0 },
    });

    expect(res.statusCode).toBe(422);
    expect(mockCreateTask).not.toHaveBeenCalled();
  });

  it('422 — non-integer duration is rejected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: 'Float dur', duration: 30.5 },
    });

    expect(res.statusCode).toBe(422);
    expect(mockCreateTask).not.toHaveBeenCalled();
  });

  it('401 — unauthenticated request is rejected', async () => {
    const unauthApp = await buildUnauthApp();
    try {
      const res = await unauthApp.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: { title: 'Stand-up', startAt: '2026-06-05T09:00:00.000Z', duration: 30 },
      });
      expect(res.statusCode).toBe(401);
    } finally {
      await unauthApp.close();
    }
  });
});

describe('PATCH /api/tasks/:id — scheduling fields', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    app = await buildApp();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('200 — updates startAt + duration; returns updated endAt', async () => {
    mockUpdateTask.mockResolvedValue(SCHEDULED_RESULT);

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/tasks/task-1',
      payload: {
        startAt: '2026-06-05T09:00:00.000Z',
        duration: 30,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.startAt).toBe('2026-06-05T09:00:00.000Z');
    expect(body.duration).toBe(30);
    expect(body.endAt).toBe('2026-06-05T09:30:00.000Z');
  });

  it('200 — setting startAt to null clears scheduling', async () => {
    mockUpdateTask.mockResolvedValue(UNSCHEDULED_RESULT);

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/tasks/task-2',
      payload: { startAt: null, duration: null },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.startAt).toBeNull();
    expect(body.endAt).toBeNull();
    expect(body.duration).toBeNull();
  });

  it('404 — task not found returns 404', async () => {
    mockUpdateTask.mockRejectedValue(new Error('Task not found'));

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/tasks/missing-id',
      payload: { title: 'Oops' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('422 — invalid startAt on PATCH is rejected', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/tasks/task-1',
      payload: { startAt: 'bad-date' },
    });

    expect(res.statusCode).toBe(422);
    expect(mockUpdateTask).not.toHaveBeenCalled();
  });
});

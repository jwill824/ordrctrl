// T03 — Unit tests for TaskService: startAt, duration, computed endAt

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/db.js', () => ({
  prisma: {
    nativeTask: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from '../../src/lib/db.js';
import { createTask, updateTask } from '../../src/tasks/task.service.js';

const mockPrisma = prisma as unknown as {
  nativeTask: {
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

const BASE_TASK = {
  id: 'task-1',
  title: 'Stand-up',
  dueAt: null,
  startAt: null,
  duration: null,
  completed: false,
  completedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// toFeedItem() — endAt computation via createTask (which calls toFeedItem)
// ---------------------------------------------------------------------------

describe('toFeedItem() — endAt computation', () => {
  it('computes endAt when startAt and duration are both present', async () => {
    const startAt = new Date('2026-06-05T09:00:00Z');
    mockPrisma.nativeTask.create.mockResolvedValue({
      ...BASE_TASK,
      startAt,
      duration: 60, // 60 minutes
    });

    const result = await createTask('user-1', { title: 'Stand-up', startAt, duration: 60 });

    expect(result.endAt).toBe('2026-06-05T10:00:00.000Z');
  });

  it('returns null endAt when startAt is null', async () => {
    mockPrisma.nativeTask.create.mockResolvedValue({
      ...BASE_TASK,
      startAt: null,
      duration: 30,
    });

    const result = await createTask('user-1', { title: 'Unscheduled', duration: 30 });

    expect(result.endAt).toBeNull();
  });

  it('returns null endAt when duration is null', async () => {
    const startAt = new Date('2026-06-05T09:00:00Z');
    mockPrisma.nativeTask.create.mockResolvedValue({
      ...BASE_TASK,
      startAt,
      duration: null,
    });

    const result = await createTask('user-1', { title: 'Open-ended', startAt });

    expect(result.endAt).toBeNull();
  });

  it('returns null endAt when both startAt and duration are null', async () => {
    mockPrisma.nativeTask.create.mockResolvedValue({ ...BASE_TASK });

    const result = await createTask('user-1', { title: 'No time' });

    expect(result.endAt).toBeNull();
  });

  it('duration in response matches stored value', async () => {
    mockPrisma.nativeTask.create.mockResolvedValue({ ...BASE_TASK, duration: 90 });

    const result = await createTask('user-1', { title: 'Long meeting', duration: 90 });

    expect(result.duration).toBe(90);
  });

  it('startAt is serialized as ISO string', async () => {
    const startAt = new Date('2026-06-05T14:30:00Z');
    mockPrisma.nativeTask.create.mockResolvedValue({ ...BASE_TASK, startAt });

    const result = await createTask('user-1', { title: 'Afternoon task', startAt });

    expect(result.startAt).toBe('2026-06-05T14:30:00.000Z');
  });

  it('endAt is computed as startAt + duration minutes (not seconds)', async () => {
    const startAt = new Date('2026-06-05T10:00:00Z');
    mockPrisma.nativeTask.create.mockResolvedValue({
      ...BASE_TASK,
      startAt,
      duration: 90, // 90 minutes = 1h 30m
    });

    const result = await createTask('user-1', { title: 'Deep work', startAt, duration: 90 });

    expect(result.endAt).toBe('2026-06-05T11:30:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// createTask() — field pass-through
// ---------------------------------------------------------------------------

describe('createTask() — scheduling fields', () => {
  it('persists startAt and duration via prisma.create', async () => {
    const startAt = new Date('2026-06-05T09:00:00Z');
    mockPrisma.nativeTask.create.mockResolvedValue({ ...BASE_TASK, startAt, duration: 45 });

    await createTask('user-1', { title: 'Sprint review', startAt, duration: 45 });

    expect(mockPrisma.nativeTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ startAt, duration: 45 }),
      })
    );
  });

  it('passes null for startAt and duration when omitted', async () => {
    mockPrisma.nativeTask.create.mockResolvedValue({ ...BASE_TASK });

    await createTask('user-1', { title: 'Unscheduled task' });

    expect(mockPrisma.nativeTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ startAt: null, duration: null }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// updateTask() — scheduling fields
// ---------------------------------------------------------------------------

describe('updateTask() — scheduling fields', () => {
  it('updates startAt and duration; recomputes endAt', async () => {
    const startAt = new Date('2026-06-06T08:00:00Z');
    mockPrisma.nativeTask.findFirst.mockResolvedValue({ id: 'task-1', userId: 'user-1' });
    mockPrisma.nativeTask.update.mockResolvedValue({
      ...BASE_TASK,
      startAt,
      duration: 30,
    });

    const result = await updateTask('user-1', 'task-1', { startAt, duration: 30 });

    expect(result.startAt).toBe('2026-06-06T08:00:00.000Z');
    expect(result.duration).toBe(30);
    expect(result.endAt).toBe('2026-06-06T08:30:00.000Z');
  });

  it('clears scheduling by setting startAt to null', async () => {
    mockPrisma.nativeTask.findFirst.mockResolvedValue({ id: 'task-1', userId: 'user-1' });
    mockPrisma.nativeTask.update.mockResolvedValue({
      ...BASE_TASK,
      startAt: null,
      duration: null,
    });

    const result = await updateTask('user-1', 'task-1', { startAt: null, duration: null });

    expect(result.startAt).toBeNull();
    expect(result.endAt).toBeNull();
  });
});

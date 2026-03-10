import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTask, updateTask, deleteTask } from '@/services/tasks.service';

const BASE = 'http://localhost:4000';

const mockTask = {
  id: 'native:1',
  source: 'ordrctrl' as const,
  itemType: 'task' as const,
  title: 'Task',
  dueAt: null,
  startAt: null,
  endAt: null,
  completed: false,
  completedAt: null,
  isDuplicateSuspect: false as const,
};

describe('tasks.service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('createTask', () => {
    it('POSTs to /api/tasks with title and dueAt', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => mockTask });
      await createTask('My task', '2025-06-01');
      expect(global.fetch).toHaveBeenCalledWith(
        `${BASE}/api/tasks`,
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({ title: 'My task', dueAt: '2025-06-01' }),
        })
      );
    });

    it('sends null for dueAt when not provided', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => mockTask });
      await createTask('No due date');
      const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(body.dueAt).toBeNull();
    });

    it('returns the created task', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => mockTask });
      const result = await createTask('Task');
      expect(result).toEqual(mockTask);
    });

    it('throws with server message on error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Title required' }),
      });
      await expect(createTask('')).rejects.toThrow('Title required');
    });
  });

  describe('updateTask', () => {
    it('strips "native:" prefix from id', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => mockTask });
      await updateTask('native:42', { title: 'Updated' });
      const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toBe(`${BASE}/api/tasks/42`);
    });

    it('sends PATCH with provided fields', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => mockTask });
      await updateTask('native:42', { title: 'New title', dueAt: '2025-07-01' });
      expect(global.fetch).toHaveBeenCalledWith(
        `${BASE}/api/tasks/42`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ title: 'New title', dueAt: '2025-07-01' }),
        })
      );
    });

    it('throws with server message on error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ message: 'Task not found' }),
      });
      await expect(updateTask('native:99', { title: 'x' })).rejects.toThrow('Task not found');
    });
  });

  describe('deleteTask', () => {
    it('strips "native:" prefix and sends DELETE', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      await deleteTask('native:99');
      expect(global.fetch).toHaveBeenCalledWith(
        `${BASE}/api/tasks/99`,
        { method: 'DELETE', credentials: 'include' }
      );
    });

    it('does not throw on 204 No Content', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 204 });
      await expect(deleteTask('native:1')).resolves.toBeUndefined();
    });

    it('throws on other error status', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Server error' }),
      });
      await expect(deleteTask('native:1')).rejects.toThrow('Server error');
    });
  });
});

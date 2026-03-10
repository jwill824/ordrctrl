import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNativeTasks } from '@/hooks/useNativeTasks';
import * as tasksService from '@/services/tasks.service';

vi.mock('@/services/tasks.service');

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

describe('useNativeTasks', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('create calls createTask with title and dueAt, then refreshes', async () => {
    vi.mocked(tasksService.createTask).mockResolvedValue(mockTask);
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useNativeTasks(onRefresh));

    await act(async () => {
      await result.current.create('New task', '2025-08-01');
    });

    expect(tasksService.createTask).toHaveBeenCalledWith('New task', '2025-08-01');
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('create works without dueAt', async () => {
    vi.mocked(tasksService.createTask).mockResolvedValue(mockTask);
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useNativeTasks(onRefresh));

    await act(async () => {
      await result.current.create('No due date');
    });

    expect(tasksService.createTask).toHaveBeenCalledWith('No due date', undefined);
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('update calls updateTask with id and fields, then refreshes', async () => {
    vi.mocked(tasksService.updateTask).mockResolvedValue(mockTask);
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useNativeTasks(onRefresh));

    await act(async () => {
      await result.current.update('native:1', { title: 'Updated title' });
    });

    expect(tasksService.updateTask).toHaveBeenCalledWith('native:1', { title: 'Updated title' });
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('remove calls deleteTask with id, then refreshes', async () => {
    vi.mocked(tasksService.deleteTask).mockResolvedValue(undefined);
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useNativeTasks(onRefresh));

    await act(async () => {
      await result.current.remove('native:1');
    });

    expect(tasksService.deleteTask).toHaveBeenCalledWith('native:1');
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});

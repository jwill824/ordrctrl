'use client';

import { useCallback } from 'react';
import * as tasksService from '@/services/tasks.service';

export function useNativeTasks(onRefresh: () => Promise<void>) {
  const create = useCallback(
    async (title: string, dueAt?: string | null) => {
      await tasksService.createTask(title, dueAt);
      await onRefresh();
    },
    [onRefresh]
  );

  const update = useCallback(
    async (id: string, fields: { title?: string; dueAt?: string | null }) => {
      await tasksService.updateTask(id, fields);
      await onRefresh();
    },
    [onRefresh]
  );

  const remove = useCallback(
    async (id: string) => {
      await tasksService.deleteTask(id);
      await onRefresh();
    },
    [onRefresh]
  );

  return { create, update, remove };
}

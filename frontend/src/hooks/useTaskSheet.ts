'use client';

import { useState, useCallback } from 'react';
import type { PlannerItem } from '@/hooks/usePlannerTimeline';

export type TaskSheetMode = 'create' | 'edit';

export interface UseTaskSheetReturn {
  isOpen: boolean;
  task: PlannerItem | null;
  mode: TaskSheetMode;
  openCreate: () => void;
  openEdit: (task: PlannerItem) => void;
  close: () => void;
}

export function useTaskSheet(): UseTaskSheetReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [task, setTask] = useState<PlannerItem | null>(null);
  const [mode, setMode] = useState<TaskSheetMode>('create');

  const openCreate = useCallback(() => {
    setTask(null);
    setMode('create');
    setIsOpen(true);
  }, []);

  const openEdit = useCallback((item: PlannerItem) => {
    setTask(item);
    setMode('edit');
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setTask(null);
  }, []);

  return { isOpen, task, mode, openCreate, openEdit, close };
}

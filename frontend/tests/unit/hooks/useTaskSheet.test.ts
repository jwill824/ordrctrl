import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTaskSheet } from '@/hooks/useTaskSheet';
import type { PlannerItem } from '@/hooks/usePlannerTimeline';

const item: PlannerItem = {
  id: 'native:abc123',
  source: 'ordrctrl',
  serviceId: 'ordrctrl',
  itemType: 'task',
  title: 'Edit Me',
  originalTitle: null,
  hasTitleOverride: false,
  dueAt: null,
  startAt: new Date(2026, 5, 5, 9, 0, 0).toISOString(),
  endAt: new Date(2026, 5, 5, 9, 30, 0).toISOString(),
  completed: false,
  completedAt: null,
  isDuplicateSuspect: false,
  dismissed: false,
  hasUserDueAt: false,
  originalBody: null,
  description: null,
  hasDescriptionOverride: false,
  descriptionOverride: null,
  descriptionUpdatedAt: null,
  sourceUrl: null,
  durationMinutes: 30,
};

describe('useTaskSheet', () => {
  // W0-A: openCreate sets isOpen=true, task=null, mode='create'
  it('W0-A: openCreate() opens sheet in create mode with no task', () => {
    const { result } = renderHook(() => useTaskSheet());
    expect(result.current.isOpen).toBe(false);
    act(() => { result.current.openCreate(); });
    expect(result.current.isOpen).toBe(true);
    expect(result.current.task).toBeNull();
    expect(result.current.mode).toBe('create');
  });

  // W0-B: openEdit sets isOpen=true, task=item, mode='edit'
  it('W0-B: openEdit(item) opens sheet in edit mode with the task', () => {
    const { result } = renderHook(() => useTaskSheet());
    act(() => { result.current.openEdit(item); });
    expect(result.current.isOpen).toBe(true);
    expect(result.current.task).toBe(item);
    expect(result.current.mode).toBe('edit');
  });

  // W0-C: close() after openEdit sets isOpen=false and clears task
  it('W0-C: close() after edit sets isOpen=false and clears task', () => {
    const { result } = renderHook(() => useTaskSheet());
    act(() => { result.current.openEdit(item); });
    act(() => { result.current.close(); });
    expect(result.current.isOpen).toBe(false);
    expect(result.current.task).toBeNull();
  });

  // W0-D: openEdit then close then openCreate — task is null (no stale task in create mode)
  it('W0-D: openCreate after prior edit has no stale task', () => {
    const { result } = renderHook(() => useTaskSheet());
    act(() => { result.current.openEdit(item); });
    act(() => { result.current.close(); });
    act(() => { result.current.openCreate(); });
    expect(result.current.task).toBeNull();
    expect(result.current.mode).toBe('create');
  });
});

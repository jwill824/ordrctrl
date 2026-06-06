// T057 — TaskService
// create, update, delete, complete NativeTask

import { prisma } from '../lib/db.js';

export interface CreateTaskInput {
  title: string;
  dueAt?: Date | null;
  startAt?: Date | null;
  duration?: number | null;
  isAllDay?: boolean;
  color?: string | null;
  icon?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  dueAt?: Date | null;
  startAt?: Date | null;
  duration?: number | null;
  isAllDay?: boolean;
  color?: string | null;
  icon?: string | null;
}

export interface NativeTaskResult {
  id: string;
  source: 'ordrctrl';
  itemType: 'task';
  title: string;
  dueAt: string | null;
  startAt: string | null;
  duration: number | null;
  endAt: string | null;
  completed: boolean;
  completedAt: string | null;
  isDuplicateSuspect: false;
  isAllDay: boolean;
  color: string;
  icon: string | null;
}

function toFeedItem(task: {
  id: string;
  title: string;
  dueAt: Date | null;
  startAt: Date | null;
  duration: number | null;
  completed: boolean;
  completedAt: Date | null;
  isAllDay: boolean;
  color: string | null;
  icon: string | null;
}): NativeTaskResult {
  return {
    id: `native:${task.id}`,
    source: 'ordrctrl',
    itemType: 'task',
    title: task.title,
    dueAt: task.dueAt?.toISOString() ?? null,
    startAt: task.startAt?.toISOString() ?? null,
    duration: task.duration ?? null,
    endAt: task.startAt && task.duration
      ? new Date(task.startAt.getTime() + task.duration * 60000).toISOString()
      : null,
    completed: task.completed,
    completedAt: task.completedAt?.toISOString() ?? null,
    isDuplicateSuspect: false,
    isAllDay: task.isAllDay,
    color: task.color ?? '#3B82F6',
    icon: task.icon ?? null,
  };
}

export async function createTask(
  userId: string,
  input: CreateTaskInput
): Promise<NativeTaskResult> {
  const task = await prisma.nativeTask.create({
    data: {
      userId,
      title: input.title,
      dueAt: input.dueAt ?? null,
      startAt: input.startAt ?? null,
      duration: input.duration ?? null,
      isAllDay: input.isAllDay ?? false,
      color: input.color ?? '#3B82F6',
      icon: input.icon ?? null,
    },
  });
  return toFeedItem(task);
}

export async function updateTask(
  userId: string,
  taskId: string,
  input: UpdateTaskInput
): Promise<NativeTaskResult> {
  const existing = await prisma.nativeTask.findFirst({
    where: { id: taskId, userId },
  });
  if (!existing) {
    throw new Error('Task not found');
  }

  const task = await prisma.nativeTask.update({
    where: { id: taskId },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.dueAt !== undefined && { dueAt: input.dueAt }),
      ...(input.startAt !== undefined && { startAt: input.startAt }),
      ...(input.duration !== undefined && { duration: input.duration }),
      ...(input.isAllDay !== undefined && { isAllDay: input.isAllDay }),
      ...(input.color !== undefined && { color: input.color }),
      ...(input.icon !== undefined && { icon: input.icon }),
    },
  });
  return toFeedItem(task);
}

export async function deleteTask(userId: string, taskId: string): Promise<void> {
  const deleted = await prisma.nativeTask.deleteMany({
    where: { id: taskId, userId },
  });
  if (deleted.count === 0) {
    throw new Error('Task not found');
  }
}

export async function completeTask(
  userId: string,
  taskId: string
): Promise<NativeTaskResult> {
  const existing = await prisma.nativeTask.findFirst({
    where: { id: taskId, userId },
  });
  if (!existing) {
    throw new Error('Task not found');
  }

  const task = await prisma.nativeTask.update({
    where: { id: taskId },
    data: { completed: true, completedAt: new Date() },
  });
  return toFeedItem(task);
}

export async function uncompleteTask(
  userId: string,
  taskId: string
): Promise<NativeTaskResult> {
  const existing = await prisma.nativeTask.findFirst({
    where: { id: taskId, userId },
  });
  if (!existing) {
    throw new Error('Task not found');
  }
  if (!existing.completed) {
    throw new Error('Task is not completed');
  }

  const task = await prisma.nativeTask.update({
    where: { id: taskId },
    data: { completed: false, completedAt: null },
  });
  return toFeedItem(task);
}

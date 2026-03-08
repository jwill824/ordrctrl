// T057 — TaskService
// create, update, delete, complete NativeTask

import { prisma } from '../lib/db.js';

export interface CreateTaskInput {
  title: string;
  dueAt?: Date | null;
}

export interface UpdateTaskInput {
  title?: string;
  dueAt?: Date | null;
}

export interface NativeTaskResult {
  id: string;
  source: 'ordrctrl';
  itemType: 'task';
  title: string;
  dueAt: string | null;
  startAt: null;
  endAt: null;
  completed: boolean;
  completedAt: string | null;
  isDuplicateSuspect: false;
}

function toFeedItem(task: {
  id: string;
  title: string;
  dueAt: Date | null;
  completed: boolean;
  completedAt: Date | null;
}): NativeTaskResult {
  return {
    id: `native:${task.id}`,
    source: 'ordrctrl',
    itemType: 'task',
    title: task.title,
    dueAt: task.dueAt?.toISOString() ?? null,
    startAt: null,
    endAt: null,
    completed: task.completed,
    completedAt: task.completedAt?.toISOString() ?? null,
    isDuplicateSuspect: false,
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

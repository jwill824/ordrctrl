import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskSheet } from '@/components/tasks/TaskSheet';
import type { PlannerItem } from '@/hooks/usePlannerTimeline';

// Mock TimeSlotPicker to prevent react-mobile-picker from breaking jsdom
vi.mock('@/components/tasks/TimeSlotPicker', () => ({
  TimeSlotPicker: (props: Record<string, unknown>) => (
    <div data-testid="time-slot-picker" data-value={props.value as string} />
  ),
}));

// Mock DurationPicker to prevent react-mobile-picker from breaking jsdom
vi.mock('@/components/tasks/DurationPicker', () => ({
  DurationPicker: (props: Record<string, unknown>) => (
    <div data-testid="duration-picker" data-value={props.value as number}>
      <button type="button" aria-label="Decrease duration" onClick={() => (props.onChange as (v: number) => void)(Math.max(1, (props.value as number) - 5))}>−</button>
      <button type="button" aria-label="Increase duration" onClick={() => (props.onChange as (v: number) => void)((props.value as number) + 5)}>+</button>
    </div>
  ),
}));

const task: PlannerItem = {
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

const defaultStartAt = new Date(2026, 5, 5, 10, 0, 0).toISOString();
const onSave = vi.fn().mockResolvedValue(undefined);
const onDelete = vi.fn().mockResolvedValue(undefined);
const onCancel = vi.fn();

describe('TaskSheet — create mode', () => {
  // W0-E: renders title input with placeholder
  it('W0-E: renders title input with placeholder in create mode', () => {
    render(
      <TaskSheet
        onSave={onSave}
        onCancel={onCancel}
        defaultStartAt={defaultStartAt}
        defaultDuration={30}
      />
    );
    const input = screen.getByPlaceholderText('What needs to be done?');
    expect(input).toBeDefined();
  });

  // W0-F: renders time-slot-picker element
  it('W0-F: renders time slot picker in create mode', () => {
    render(
      <TaskSheet
        onSave={onSave}
        onCancel={onCancel}
        defaultStartAt={defaultStartAt}
        defaultDuration={30}
      />
    );
    const picker = screen.getByTestId('time-slot-picker');
    expect(picker).toBeDefined();
  });

  // W0-G: renders duration picker and shows time range label
  it('W0-G: renders duration picker and time range label in create mode', () => {
    render(
      <TaskSheet
        onSave={onSave}
        onCancel={onCancel}
        defaultStartAt={defaultStartAt}
        defaultDuration={30}
      />
    );
    const picker = screen.getByTestId('duration-picker');
    expect(picker).toBeDefined();
    const rangeLabel = screen.getByTestId('time-range-label');
    // defaultStartAt = '2025-01-01T09:30:00.000Z' → local slot 9:30, +30 min → 10:00
    expect(rangeLabel.textContent).toMatch(/\d+:\d{2}\s*–\s*\d+:\d{2}/);
  });

  // W0-H: no delete button in create mode
  it('W0-H: does not render delete button in create mode', () => {
    render(
      <TaskSheet
        onSave={onSave}
        onCancel={onCancel}
        defaultStartAt={defaultStartAt}
        defaultDuration={30}
      />
    );
    const deleteBtn = screen.queryByLabelText('Delete task');
    expect(deleteBtn).toBeNull();
  });
});

describe('TaskSheet — edit mode', () => {
  // W0-I: delete button visible in edit mode
  it('W0-I: renders delete button in edit mode', () => {
    render(
      <TaskSheet
        task={task}
        onSave={onSave}
        onDelete={onDelete}
        onCancel={onCancel}
      />
    );
    const deleteBtn = screen.getByLabelText('Delete task');
    expect(deleteBtn).toBeDefined();
  });

  // W0-J: title input pre-filled from task.title
  it('W0-J: title input is pre-filled with task title in edit mode', () => {
    render(
      <TaskSheet
        task={task}
        onSave={onSave}
        onDelete={onDelete}
        onCancel={onCancel}
      />
    );
    const input = screen.getByDisplayValue('Edit Me');
    expect(input).toBeDefined();
  });
});

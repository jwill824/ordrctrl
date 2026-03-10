import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CompletedSection } from '@/components/feed/CompletedSection';
import type { FeedItem } from '@/services/feed.service';

const makeItem = (id: string, title: string): FeedItem => ({
  id,
  source: 'ordrctrl',
  itemType: 'task',
  title,
  dueAt: null,
  startAt: null,
  endAt: null,
  completed: true,
  completedAt: '2026-03-10T10:00:00Z',
  isDuplicateSuspect: false,
});

describe('CompletedSection', () => {
  it('returns null when items array is empty', () => {
    const { container } = render(
      <CompletedSection items={[]} onUncomplete={vi.fn()} onClear={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders "Completed (N)" header when items exist', () => {
    render(
      <CompletedSection
        items={[makeItem('i1', 'Task A'), makeItem('i2', 'Task B')]}
        onUncomplete={vi.fn()}
        onClear={vi.fn()}
      />
    );
    expect(screen.getByText('Completed (2)')).toBeInTheDocument();
  });

  it('renders "Clear" button when items exist', () => {
    render(
      <CompletedSection
        items={[makeItem('i1', 'Task A')]}
        onUncomplete={vi.fn()}
        onClear={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /clear all completed tasks/i })).toBeInTheDocument();
  });

  it('does not render "Clear" button when items is empty', () => {
    const { container } = render(
      <CompletedSection items={[]} onUncomplete={vi.fn()} onClear={vi.fn()} />
    );
    // Component returns null entirely
    expect(container.firstChild).toBeNull();
  });

  it('calls onClear when the Clear button is clicked', async () => {
    const onClear = vi.fn();
    render(
      <CompletedSection
        items={[makeItem('i1', 'Task A')]}
        onUncomplete={vi.fn()}
        onClear={onClear}
      />
    );
    const clearBtn = screen.getByRole('button', { name: /clear all completed tasks/i });
    await userEvent.click(clearBtn);
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('items are hidden by default (collapsed)', () => {
    render(
      <CompletedSection
        items={[makeItem('i1', 'Task A')]}
        onUncomplete={vi.fn()}
        onClear={vi.fn()}
      />
    );
    expect(screen.queryByText('Task A')).not.toBeInTheDocument();
  });

  it('shows items when the section header is expanded', async () => {
    render(
      <CompletedSection
        items={[makeItem('i1', 'Task A')]}
        onUncomplete={vi.fn()}
        onClear={vi.fn()}
      />
    );
    // Click the expand button (the "Completed (1)" button)
    const expandBtn = screen.getByText('Completed (1)').closest('button')!;
    await userEvent.click(expandBtn);
    expect(screen.getByText('Task A')).toBeInTheDocument();
  });
});

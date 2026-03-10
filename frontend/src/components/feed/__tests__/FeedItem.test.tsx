import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FeedItemRow } from '@/components/feed/FeedItem';
import type { FeedItem } from '@/services/feed.service';

const baseItem: FeedItem = {
  id: 'item-1',
  source: 'ordrctrl',
  itemType: 'task',
  title: 'Write unit tests',
  dueAt: null,
  startAt: null,
  endAt: null,
  completed: false,
  completedAt: null,
  isDuplicateSuspect: false,
};

describe('FeedItemRow', () => {
  it('renders the item title', () => {
    render(<FeedItemRow item={baseItem} onComplete={vi.fn()} />);
    expect(screen.getByText('Write unit tests')).toBeInTheDocument();
  });

  it('renders source badge', () => {
    render(<FeedItemRow item={baseItem} onComplete={vi.fn()} />);
    expect(screen.getByText('ordrctrl')).toBeInTheDocument();
  });

  it('shows "Mark complete" aria-label for incomplete item', () => {
    render(<FeedItemRow item={baseItem} onComplete={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Mark complete' })).toBeInTheDocument();
  });

  it('calls onComplete with item id when checkbox clicked', async () => {
    const onComplete = vi.fn();
    render(<FeedItemRow item={baseItem} onComplete={onComplete} />);
    await userEvent.click(screen.getByRole('button', { name: 'Mark complete' }));
    expect(onComplete).toHaveBeenCalledWith('item-1');
  });

  it('calls onUncomplete when checkbox clicked for completed item', async () => {
    const onUncomplete = vi.fn();
    const completedItem = { ...baseItem, completed: true };
    render(<FeedItemRow item={completedItem} onComplete={vi.fn()} onUncomplete={onUncomplete} />);
    await userEvent.click(screen.getByRole('button', { name: 'Reopen task' }));
    expect(onUncomplete).toHaveBeenCalledWith('item-1');
  });

  it('applies line-through to title for completed items', () => {
    const completedItem = { ...baseItem, completed: true };
    render(<FeedItemRow item={completedItem} onComplete={vi.fn()} />);
    expect(screen.getByText('Write unit tests')).toHaveClass('line-through');
  });

  it('renders dismiss button when onDismiss provided', () => {
    render(<FeedItemRow item={baseItem} onComplete={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Dismiss item' })).toBeInTheDocument();
  });

  it('calls onDismiss with item id when dismiss button clicked', async () => {
    const onDismiss = vi.fn();
    render(<FeedItemRow item={baseItem} onComplete={vi.fn()} onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss item' }));
    expect(onDismiss).toHaveBeenCalledWith('item-1');
  });

  it('does not render dismiss button for completed items', () => {
    const completedItem = { ...baseItem, completed: true };
    render(<FeedItemRow item={completedItem} onComplete={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Dismiss item' })).toBeNull();
  });

  it('shows ⚠ Duplicate? badge when isDuplicateSuspect is true', () => {
    const dupItem = { ...baseItem, isDuplicateSuspect: true };
    render(<FeedItemRow item={dupItem} onComplete={vi.fn()} />);
    expect(screen.getByText(/Duplicate\?/)).toBeInTheDocument();
  });

  it('does not show duplicate badge for normal items', () => {
    render(<FeedItemRow item={baseItem} onComplete={vi.fn()} />);
    expect(screen.queryByText(/Duplicate\?/)).toBeNull();
  });

  it('shows overdue text for past due dates', () => {
    const overdueItem = { ...baseItem, dueAt: '2020-01-01T00:00:00Z' };
    render(<FeedItemRow item={overdueItem} onComplete={vi.fn()} />);
    expect(screen.getByText(/overdue/i)).toBeInTheDocument();
  });

  it('shows isJustReopened notice for external source items', () => {
    const reopenedItem = { ...baseItem, source: 'Gmail', isJustReopened: true };
    render(<FeedItemRow item={reopenedItem} onComplete={vi.fn()} />);
    expect(screen.getByText(/local to ordrctrl/)).toBeInTheDocument();
  });

  it('does not show isJustReopened notice for ordrctrl source', () => {
    const reopenedItem = { ...baseItem, source: 'ordrctrl', isJustReopened: true };
    render(<FeedItemRow item={reopenedItem} onComplete={vi.fn()} />);
    expect(screen.queryByText(/local to ordrctrl/)).toBeNull();
  });
});

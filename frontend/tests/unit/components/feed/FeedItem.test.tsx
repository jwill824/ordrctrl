import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FeedItemRow } from '@/components/feed/FeedItem';
import type { FeedItem } from '@/services/feed.service';

const baseItem: FeedItem = {
  id: 'item-1',
  source: 'ordrctrl',
  serviceId: 'ordrctrl',
  itemType: 'task',
  title: 'Write unit tests',
  dueAt: null,
  startAt: null,
  endAt: null,
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
    const reopenedItem = { ...baseItem, serviceId: 'gmail', source: 'Gmail', isJustReopened: true };
    render(<FeedItemRow item={reopenedItem} onComplete={vi.fn()} />);
    expect(screen.getByText(/local to ordrctrl/)).toBeInTheDocument();
  });

  it('does not show isJustReopened notice for ordrctrl source', () => {
    const reopenedItem = { ...baseItem, source: 'ordrctrl', isJustReopened: true };
    render(<FeedItemRow item={reopenedItem} onComplete={vi.fn()} />);
    expect(screen.queryByText(/local to ordrctrl/)).toBeNull();
  });

  it('renders Restore button when onRestore is provided', () => {
    render(<FeedItemRow item={baseItem} onComplete={vi.fn()} onRestore={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Restore item' })).toBeInTheDocument();
  });

  it('calls onRestore with item id when Restore button clicked', async () => {
    const onRestore = vi.fn();
    render(<FeedItemRow item={baseItem} onComplete={vi.fn()} onRestore={onRestore} />);
    await userEvent.click(screen.getByRole('button', { name: 'Restore item' }));
    expect(onRestore).toHaveBeenCalledWith('item-1');
  });

  it('does not render Restore button when onRestore is not provided', () => {
    render(<FeedItemRow item={baseItem} onComplete={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Restore item' })).toBeNull();
  });

  it('renders Delete permanently button when onPermanentDelete is provided', () => {
    render(<FeedItemRow item={baseItem} onComplete={vi.fn()} onPermanentDelete={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Delete permanently' })).toBeInTheDocument();
  });

  it('calls onPermanentDelete when Delete permanently button clicked', async () => {
    const onPermanentDelete = vi.fn();
    render(<FeedItemRow item={baseItem} onComplete={vi.fn()} onPermanentDelete={onPermanentDelete} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));
    expect(onPermanentDelete).toHaveBeenCalled();
  });

  it('does not render Delete permanently button when onPermanentDelete is not provided', () => {
    render(<FeedItemRow item={baseItem} onComplete={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Delete permanently' })).toBeNull();
  });

  // T029 — Source link tests
  describe('source link (US2)', () => {
    const syncItem: FeedItem = {
      ...baseItem,
      id: 'sync:item-1',
      source: 'you@gmail.com',
      serviceId: 'gmail',
      sourceUrl: 'https://mail.google.com/mail/u/0/#inbox/abc123',
    };

    it('renders "Open in Gmail" link when sourceUrl is present', () => {
      render(<FeedItemRow item={syncItem} onComplete={vi.fn()} />);
      expect(screen.getByText('Open in Gmail')).toBeInTheDocument();
    });

    it('link has correct href and opens in new tab', () => {
      render(<FeedItemRow item={syncItem} onComplete={vi.fn()} />);
      const link = screen.getByText('Open in Gmail').closest('a');
      expect(link).toHaveAttribute('href', 'https://mail.google.com/mail/u/0/#inbox/abc123');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('renders "Open in To Do" for microsoft_tasks', () => {
      const msItem: FeedItem = { ...syncItem, serviceId: 'microsoft_tasks', sourceUrl: 'https://todo.microsoft.com/task/123' };
      render(<FeedItemRow item={msItem} onComplete={vi.fn()} />);
      expect(screen.getByText('Open in To Do')).toBeInTheDocument();
    });

    it('renders "Open in Calendar" for apple_calendar', () => {
      const calItem: FeedItem = { ...syncItem, serviceId: 'apple_calendar', sourceUrl: 'webcal://p01-caldav.icloud.com/event' };
      render(<FeedItemRow item={calItem} onComplete={vi.fn()} />);
      expect(screen.getByText('Open in Calendar')).toBeInTheDocument();
    });

    it('does not render source link when sourceUrl is null', () => {
      const noUrlItem: FeedItem = { ...syncItem, sourceUrl: null };
      render(<FeedItemRow item={noUrlItem} onComplete={vi.fn()} />);
      expect(screen.queryByText('Open in Gmail')).toBeNull();
    });

    it('does not render source link for native ordrctrl tasks', () => {
      const nativeItem: FeedItem = { ...baseItem, sourceUrl: 'https://example.com' };
      render(<FeedItemRow item={nativeItem} onComplete={vi.fn()} />);
      // serviceId is ordrctrl, so no source link even with sourceUrl
      expect(screen.queryByText(/Open in/)).toBeNull();
    });
  });
});

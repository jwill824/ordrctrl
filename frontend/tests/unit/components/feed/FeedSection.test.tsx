// T013 — Unit tests for FeedSection component
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FeedSection } from '@/components/feed/FeedSection';
import type { FeedItem } from '@/services/feed.service';

const makeItem = (id: string, title: string): FeedItem => ({
  id,
  source: 'ordrctrl',
  serviceId: 'ordrctrl',
  itemType: 'task',
  title,
  dueAt: null,
  startAt: null,
  endAt: null,
  completed: false,
  completedAt: null,
  isDuplicateSuspect: false,
  dismissed: false,
  hasUserDueAt: false,
});

describe('FeedSection', () => {
  it('renders the section label', () => {
    render(
      <FeedSection label="Upcoming" items={[makeItem('1', 'Task A')]} onComplete={vi.fn()} />
    );
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
  });

  it('renders each item in the section', () => {
    render(
      <FeedSection
        label="Upcoming"
        items={[makeItem('1', 'Task A'), makeItem('2', 'Task B')]}
        onComplete={vi.fn()}
      />
    );
    expect(screen.getByText('Task A')).toBeInTheDocument();
    expect(screen.getByText('Task B')).toBeInTheDocument();
  });

  it('returns null when items is empty and no emptyMessage', () => {
    const { container } = render(
      <FeedSection label="No Date" items={[]} onComplete={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders emptyMessage when items is empty', () => {
    render(
      <FeedSection label="No Date" items={[]} emptyMessage="Nothing here" onComplete={vi.fn()} />
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('calls onComplete with item id when item is completed', async () => {
    const onComplete = vi.fn();
    render(
      <FeedSection label="Upcoming" items={[makeItem('item-1', 'My Task')]} onComplete={onComplete} />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Mark complete' }));
    expect(onComplete).toHaveBeenCalledWith('item-1');
  });

  it('calls onPermanentDelete when provided and button clicked', async () => {
    const onPermanentDelete = vi.fn();
    render(
      <FeedSection
        label="Dismissed"
        items={[makeItem('item-1', 'Old Task')]}
        onComplete={vi.fn()}
        onPermanentDelete={onPermanentDelete}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));
    expect(onPermanentDelete).toHaveBeenCalledWith('item-1');
  });
});

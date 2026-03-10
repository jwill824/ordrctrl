import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TriageSheet } from '@/components/feed/TriageSheet';
import type { FeedItem } from '@/services/feed.service';

const sampleItem: FeedItem = {
  id: 'item-1',
  source: 'Gmail',
  itemType: 'task',
  title: 'Review PR #42',
  dueAt: null,
  startAt: null,
  endAt: null,
  completed: false,
  completedAt: null,
  isDuplicateSuspect: false,
};

const baseProps = {
  isOpen: true,
  loading: false,
  items: [] as FeedItem[],
  onClose: vi.fn(),
  onAcceptAll: vi.fn(),
  onDismissAll: vi.fn().mockResolvedValue(undefined),
  onDismissItem: vi.fn().mockResolvedValue(undefined),
};

describe('TriageSheet', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(<TriageSheet {...baseProps} isOpen={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows loading state when loading=true', () => {
    render(<TriageSheet {...baseProps} loading={true} />);
    expect(screen.getByText('Syncing…')).toBeInTheDocument();
  });

  it('shows empty state message when no items', () => {
    render(<TriageSheet {...baseProps} items={[]} />);
    expect(screen.getByText(/Nothing new/)).toBeInTheDocument();
  });

  it('shows singular item count in header', () => {
    render(<TriageSheet {...baseProps} items={[sampleItem]} />);
    expect(screen.getByText('1 new item')).toBeInTheDocument();
  });

  it('shows plural item count for multiple items', () => {
    const items = [sampleItem, { ...sampleItem, id: 'item-2', title: 'Another task' }];
    render(<TriageSheet {...baseProps} items={items} />);
    expect(screen.getByText('2 new items')).toBeInTheDocument();
  });

  it('renders item title', () => {
    render(<TriageSheet {...baseProps} items={[sampleItem]} />);
    expect(screen.getByText('Review PR #42')).toBeInTheDocument();
  });

  it('calls onAcceptAll when Accept all is clicked', async () => {
    const onAcceptAll = vi.fn();
    render(<TriageSheet {...baseProps} items={[sampleItem]} onAcceptAll={onAcceptAll} />);
    await userEvent.click(screen.getByText('Accept all'));
    expect(onAcceptAll).toHaveBeenCalledOnce();
  });

  it('calls onDismissAll when Dismiss all is clicked', async () => {
    const onDismissAll = vi.fn().mockResolvedValue(undefined);
    render(<TriageSheet {...baseProps} items={[sampleItem]} onDismissAll={onDismissAll} />);
    await userEvent.click(screen.getByText('Dismiss all'));
    expect(onDismissAll).toHaveBeenCalledOnce();
  });

  it('calls onDismissItem with correct id on per-item dismiss', async () => {
    const onDismissItem = vi.fn().mockResolvedValue(undefined);
    render(<TriageSheet {...baseProps} items={[sampleItem]} onDismissItem={onDismissItem} />);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss "Review PR #42"' }));
    expect(onDismissItem).toHaveBeenCalledWith('item-1');
  });

  it('calls onClose when × header button is clicked', async () => {
    const onClose = vi.fn();
    render(<TriageSheet {...baseProps} items={[sampleItem]} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows Done button when no items remain', () => {
    render(<TriageSheet {...baseProps} items={[]} />);
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.queryByText('Accept all')).toBeNull();
  });
});

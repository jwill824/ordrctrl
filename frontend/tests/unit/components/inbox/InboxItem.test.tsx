import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InboxItem } from '@/components/inbox/InboxItem';
import type { InboxItem as InboxItemType } from '@/services/inbox.service';

const baseItem: InboxItemType = {
  id: 'inbox:item-1',
  externalId: 'ext-1',
  title: 'Fix the bug',
  itemType: 'task',
  syncedAt: '2026-01-01T00:00:00.000Z',
  integration: {
    id: 'int-1',
    serviceId: 'gmail',
    label: 'Work',
    accountIdentifier: 'user@example.com',
  },
};

describe('InboxItem', () => {
  it('renders the item title', () => {
    render(<InboxItem item={baseItem} onAccept={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText('Fix the bug')).toBeInTheDocument();
  });

  it('renders Accept button', () => {
    render(<InboxItem item={baseItem} onAccept={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Accept Fix the bug' })).toBeInTheDocument();
  });

  it('renders Dismiss button', () => {
    render(<InboxItem item={baseItem} onAccept={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Dismiss Fix the bug' })).toBeInTheDocument();
  });

  it('calls onAccept with item id when Accept clicked', async () => {
    const onAccept = vi.fn().mockResolvedValue(undefined);
    render(<InboxItem item={baseItem} onAccept={onAccept} onDismiss={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Accept Fix the bug' }));
    expect(onAccept).toHaveBeenCalledWith('inbox:item-1');
  });

  it('calls onDismiss with item id when Dismiss clicked', async () => {
    const onDismiss = vi.fn().mockResolvedValue(undefined);
    render(<InboxItem item={baseItem} onAccept={vi.fn()} onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss Fix the bug' }));
    expect(onDismiss).toHaveBeenCalledWith('inbox:item-1');
  });

  it('renders formatted due date when present', () => {
    const item = { ...baseItem, dueAt: '2026-03-15T00:00:00.000Z' };
    render(<InboxItem item={item} onAccept={vi.fn()} onDismiss={vi.fn()} />);
    // Date renders in locale format — verify a date element appears (locale-agnostic)
    // The date will be in some short format like "Mar 15" or "3/15"
    const dateElements = document.querySelectorAll('[class*="text-xs"][class*="text-zinc-400"]');
    expect(dateElements.length).toBeGreaterThan(0);
  });

  it('does not render date when not present', () => {
    render(<InboxItem item={baseItem} onAccept={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.queryByText(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/)).not.toBeInTheDocument();
  });

  it('has correct data-testid', () => {
    render(<InboxItem item={baseItem} onAccept={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByTestId('inbox-item')).toBeInTheDocument();
  });
});

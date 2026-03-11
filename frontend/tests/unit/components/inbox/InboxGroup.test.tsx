import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InboxGroup } from '@/components/inbox/InboxGroup';
import type { InboxGroup as InboxGroupType } from '@/services/inbox.service';

const makeGroup = (overrides: Partial<InboxGroupType> = {}): InboxGroupType => ({
  integrationId: 'int-1',
  serviceId: 'gmail',
  accountLabel: 'Work',
  accountIdentifier: 'user@example.com',
  items: [
    {
      id: 'inbox:item-1',
      externalId: 'ext-1',
      title: 'Task One',
      itemType: 'task',
      syncedAt: '2026-01-01T00:00:00.000Z',
      integration: {
        id: 'int-1',
        serviceId: 'gmail',
        label: 'Work',
        accountIdentifier: 'user@example.com',
      },
    },
    {
      id: 'inbox:item-2',
      externalId: 'ext-2',
      title: 'Task Two',
      itemType: 'task',
      syncedAt: '2026-01-02T00:00:00.000Z',
      integration: {
        id: 'int-1',
        serviceId: 'gmail',
        label: 'Work',
        accountIdentifier: 'user@example.com',
      },
    },
  ],
  ...overrides,
});

describe('InboxGroup', () => {
  it('renders group account label', () => {
    render(
      <InboxGroup
        group={makeGroup()}
        onAcceptItem={vi.fn()}
        onDismissItem={vi.fn()}
        onAcceptAll={vi.fn()}
        onDismissAll={vi.fn()}
      />
    );
    expect(screen.getByText('Work')).toBeInTheDocument();
  });

  it('renders all items in the group', () => {
    render(
      <InboxGroup
        group={makeGroup()}
        onAcceptItem={vi.fn()}
        onDismissItem={vi.fn()}
        onAcceptAll={vi.fn()}
        onDismissAll={vi.fn()}
      />
    );
    expect(screen.getByText('Task One')).toBeInTheDocument();
    expect(screen.getByText('Task Two')).toBeInTheDocument();
  });

  it('renders Accept all button', () => {
    render(
      <InboxGroup
        group={makeGroup()}
        onAcceptItem={vi.fn()}
        onDismissItem={vi.fn()}
        onAcceptAll={vi.fn()}
        onDismissAll={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'Accept all from Work' })).toBeInTheDocument();
  });

  it('renders Dismiss all button', () => {
    render(
      <InboxGroup
        group={makeGroup()}
        onAcceptItem={vi.fn()}
        onDismissItem={vi.fn()}
        onAcceptAll={vi.fn()}
        onDismissAll={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'Dismiss all from Work' })).toBeInTheDocument();
  });

  it('calls onAcceptAll with integrationId when Accept all clicked', async () => {
    const onAcceptAll = vi.fn().mockResolvedValue(undefined);
    render(
      <InboxGroup
        group={makeGroup()}
        onAcceptItem={vi.fn()}
        onDismissItem={vi.fn()}
        onAcceptAll={onAcceptAll}
        onDismissAll={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Accept all from Work' }));
    expect(onAcceptAll).toHaveBeenCalledWith('int-1');
  });

  it('calls onDismissAll with integrationId when Dismiss all clicked', async () => {
    const onDismissAll = vi.fn().mockResolvedValue(undefined);
    render(
      <InboxGroup
        group={makeGroup()}
        onAcceptItem={vi.fn()}
        onDismissItem={vi.fn()}
        onAcceptAll={vi.fn()}
        onDismissAll={onDismissAll}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss all from Work' }));
    expect(onDismissAll).toHaveBeenCalledWith('int-1');
  });

  it('uses accountIdentifier as label when accountLabel is empty', () => {
    const group = makeGroup({ accountLabel: '' });
    render(
      <InboxGroup
        group={group}
        onAcceptItem={vi.fn()}
        onDismissItem={vi.fn()}
        onAcceptAll={vi.fn()}
        onDismissAll={vi.fn()}
      />
    );
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
  });

  it('has correct data-testid', () => {
    render(
      <InboxGroup
        group={makeGroup()}
        onAcceptItem={vi.fn()}
        onDismissItem={vi.fn()}
        onAcceptAll={vi.fn()}
        onDismissAll={vi.fn()}
      />
    );
    expect(screen.getByTestId('inbox-group')).toBeInTheDocument();
  });
});

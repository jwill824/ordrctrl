'use client';

// T010 — InboxGroup component
// Renders a group of inbox items under one integration header with bulk actions.

import type { InboxGroup as InboxGroupType } from '@/services/inbox.service';
import { InboxItem } from './InboxItem';

interface InboxGroupProps {
  group: InboxGroupType;
  onAcceptItem: (itemId: string) => Promise<void>;
  onDismissItem: (itemId: string) => Promise<void>;
  onAcceptAll: (integrationId: string) => Promise<void>;
  onDismissAll: (integrationId: string) => Promise<void>;
}

export function InboxGroup({
  group,
  onAcceptItem,
  onDismissItem,
  onAcceptAll,
  onDismissAll,
}: InboxGroupProps) {
  const label = group.accountLabel || group.accountIdentifier;
  const count = group.items.length;

  return (
    <section
      data-testid="inbox-group"
      className="mb-6"
      aria-label={`${label} — ${count} item${count !== 1 ? 's' : ''}`}
    >
      {/* Group header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xs font-semibold text-zinc-700 uppercase tracking-wide">
            {label}
          </p>
          <p className="text-xs text-zinc-400">
            {group.serviceId.replace(/_/g, ' ')} · {group.accountIdentifier}
          </p>
        </div>

        {/* Bulk action buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void onAcceptAll(group.integrationId)}
            aria-label={`Accept all from ${label}`}
            className="px-2 py-1 text-xs font-medium text-white bg-black hover:bg-zinc-800 rounded-sm"
          >
            Accept all
          </button>
          <button
            type="button"
            onClick={() => void onDismissAll(group.integrationId)}
            aria-label={`Dismiss all from ${label}`}
            className="px-2 py-1 text-xs font-medium text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded-sm"
          >
            Dismiss all
          </button>
        </div>
      </div>

      {/* Items */}
      <div className="border border-zinc-100 rounded-sm px-3">
        {group.items.map((item) => (
          <InboxItem
            key={item.id}
            item={item}
            onAccept={onAcceptItem}
            onDismiss={onDismissItem}
          />
        ))}
      </div>
    </section>
  );
}

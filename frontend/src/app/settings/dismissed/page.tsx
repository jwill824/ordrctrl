'use client';

// T023 — Dismissed Items settings page

import Link from 'next/link';
import { DismissedItemsPage } from '@/components/feed/DismissedItemsPage';

export default function DismissedSettingsPage() {
  return (
    <main className="min-h-screen bg-white py-8 px-5 max-w-[36rem] mx-auto">
      {/* Nav */}
      <nav className="flex items-center gap-4 mb-10">
        <Link href="/feed" className="text-[0.7rem] text-zinc-400 no-underline tracking-[0.08em]">
          ← Feed
        </Link>
        <span className="text-[0.7rem] font-bold tracking-[0.28em] uppercase text-black">
          ordrctrl
        </span>
      </nav>

      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-black mb-1.5">
          Dismissed Items
        </h1>
        <p className="text-sm text-zinc-500">
          Items you've dismissed from your feed. Restore any item to make it reappear.
        </p>
      </div>

      <DismissedItemsPage />
    </main>
  );
}

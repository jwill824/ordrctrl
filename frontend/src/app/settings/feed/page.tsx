// T026 — Feed settings page
// Houses AutoClearSettings and future feed preferences

import { Link } from 'react-router-dom';
import { AutoClearSettings } from '@/components/settings/AutoClearSettings';

export default function FeedSettingsPage() {
  return (
    <main className="min-h-screen bg-white py-8 px-5 max-w-[36rem] mx-auto">
      {/* Nav */}
      <nav className="flex items-center gap-4 mb-10">
        <Link to="/feed" className="text-[0.7rem] text-zinc-400 no-underline tracking-[0.08em]">
          ← Feed
        </Link>
        <span className="text-[0.7rem] font-bold tracking-[0.28em] uppercase text-black">
          ordrctrl
        </span>
      </nav>

      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-black mb-1.5">
          Feed preferences
        </h1>
        <p className="text-sm text-zinc-500">
          Customize how your feed handles completed and cleared tasks.
        </p>
      </div>

      <section>
        <h2 className="text-xs font-bold tracking-[0.15em] uppercase text-zinc-400 mb-4">
          Completed tasks
        </h2>
        <AutoClearSettings />
      </section>
    </main>
  );
}

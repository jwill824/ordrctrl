import React from 'react';
import { Link } from 'react-router-dom';

// ─── Icons (22×22 SVG) ────────────────────────────────────────────────────────

function CalendarIcon() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 4h16v12H4z" />
      <path d="M4 16l4-4h8l4 4" />
    </svg>
  );
}

function PlugIcon() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 7l-5 5 3 3 5-5M17 17l5-5-3-3-5 5M14 5l5 5M5 14l5 5M9 9l6 6" />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Tab {
  label: string;
  path: string;
  icon: React.ReactNode;
}

interface Props {
  inboxCount: number;
  activePath: string;
}

// ─── Tab definitions ─────────────────────────────────────────────────────────

const TABS: Tab[] = [
  { label: 'Planner', path: '/feed', icon: <CalendarIcon /> },
  { label: 'Inbox', path: '/inbox', icon: <InboxIcon /> },
  { label: 'Integrations', path: '/settings/integrations', icon: <PlugIcon /> },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function BottomTabBar({ inboxCount, activePath }: Props) {
  return (
    <div className="fixed bottom-0 left-0 right-0 flex md:hidden bg-white border-t border-zinc-100 z-30 pb-[env(safe-area-inset-bottom)]">
      {TABS.map((tab) => {
        const isActive = activePath.startsWith(tab.path);
        const colorClass = isActive ? 'text-black' : 'text-zinc-400';

        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={`flex-1 flex flex-col items-center justify-center pt-2 pb-1 gap-0.5 min-h-[56px] cursor-pointer select-none transition-colors ${colorClass}`}
          >
            {/* Icon wrapper — relative for badge positioning */}
            <div className="relative">
              {tab.icon}
              {tab.label === 'Inbox' && inboxCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-black text-white text-[0.55rem] font-semibold rounded-full flex items-center justify-center leading-none">
                  {inboxCount > 9 ? '9+' : String(inboxCount)}
                </span>
              )}
            </div>
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.08em]">
              {tab.label.toUpperCase()}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

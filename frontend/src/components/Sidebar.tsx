import React from 'react';
import { Link } from 'react-router-dom';
import { AccountMenu } from '@/components/AccountMenu';

// ─── Icons (16×16 SVG) ────────────────────────────────────────────────────────

function CalendarIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d="M4 4h16v12H4z" />
      <path d="M4 16l4-4h8l4 4" />
    </svg>
  );
}

function PlugIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d="M7 7l-5 5 3 3 5-5M17 17l5-5-3-3-5 5M14 5l5 5M5 14l5 5M9 9l6 6" />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

interface Props {
  inboxCount: number;
  activePath: string;
}

// ─── Nav item definitions ─────────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  { label: 'Planner', path: '/feed', icon: <CalendarIcon /> },
  { label: 'Inbox', path: '/inbox', icon: <InboxIcon /> },
  { label: 'Integrations', path: '/settings/integrations', icon: <PlugIcon /> },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function Sidebar({ inboxCount, activePath }: Props) {
  return (
    <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-[240px] flex-col bg-white border-r border-zinc-100 z-30 pt-[env(safe-area-inset-top)]">
      {/* Header */}
      <div className="h-12 px-5 flex items-center justify-between flex-shrink-0 border-b border-zinc-100">
        <span className="text-[0.65rem] font-semibold tracking-[0.28em] uppercase text-black">
          ordrctrl
        </span>
        <AccountMenu />
      </div>

      {/* Nav items */}
      <nav className="flex-1 flex flex-col pt-2 px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = activePath.startsWith(item.path);
          const itemClass = isActive
            ? 'bg-zinc-100 text-black font-semibold'
            : 'text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50 font-normal';

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer select-none transition-colors w-full ${itemClass}`}
            >
              {item.icon}
              <span className="text-sm flex-1">{item.label}</span>
              {item.label === 'Inbox' && inboxCount > 0 && (
                <span className="ml-auto min-w-[18px] h-[18px] px-1 bg-black text-white text-[0.55rem] font-semibold rounded-full flex items-center justify-center leading-none">
                  {inboxCount > 9 ? '9+' : String(inboxCount)}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

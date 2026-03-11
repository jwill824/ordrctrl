'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useInboxCount } from '@/hooks/useInboxCount';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function AccountMenu() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { inboxCount } = useInboxCount();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSignOut() {
    try {
      await fetch(`${API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    } finally {
      router.push('/');
    }
  }

  const initial = user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Account menu"
        aria-expanded={open}
      >
        {initial}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-md bg-white shadow-lg ring-1 ring-black/5 z-50">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs text-gray-500">Signed in as</p>
            <p className="truncate text-sm font-medium text-gray-900">{user?.email}</p>
          </div>
          <nav className="py-1">
            <a href="/inbox" className="flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              <span>Inbox</span>
              {inboxCount > 0 && (
                <span className="ml-2 min-w-[1.25rem] h-5 bg-black text-white text-[0.6rem] font-bold rounded-full flex items-center justify-center px-1">
                  {inboxCount > 99 ? '99+' : inboxCount}
                </span>
              )}
            </a>
            <a href="/settings/integrations" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              Integrations
            </a>
            <a href="/settings/feed" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              Feed preferences
            </a>
            <a href="/feed?showDismissed=true" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              Dismissed items
            </a>
          </nav>
          <div className="border-t border-gray-100 py-1">
            <button
              onClick={handleSignOut}
              className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-50"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

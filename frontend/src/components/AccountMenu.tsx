import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useInboxCount } from '@/hooks/useInboxCount';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function AccountMenu() {
  const { user } = useAuth();
  const navigate = useNavigate();
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
      navigate('/');
    }
  }

  function navTo(path: string) {
    setOpen(false);
    navigate(path);
  }

  const initial = user?.email?.[0]?.toUpperCase() ?? '?';

  // onTouchEnd with preventDefault is the primary handler for WKWebView on iOS.
  // The UIScrollView / overflow-hidden container stack can swallow click events;
  // touchend fires before the browser synthesises mousedown/click, so it is reliable.
  // onClick is kept as a fallback for desktop / non-touch environments.
  function touch(callback: () => void) {
    return (e: React.TouchEvent) => {
      e.preventDefault();
      callback();
    };
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onTouchEnd={touch(() => setOpen((v) => !v))}
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
            {/* Use buttons + navigate() instead of <Link> so Maestro/WKWebView accessibility
                activate() doesn't trigger a full-page navigation (which disconnects Maestro).
                onTouchEnd is primary; onClick is fallback for non-touch. */}
            <button
              type="button"
              onTouchEnd={touch(() => navTo('/inbox'))}
              onClick={() => navTo('/inbox')}
              className="flex items-center justify-between w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 bg-transparent border-0 cursor-pointer"
            >
              <span>Inbox</span>
              {inboxCount > 0 && (
                <span className="ml-2 min-w-[1.25rem] h-5 bg-black text-white text-[0.6rem] font-bold rounded-full flex items-center justify-center px-1">
                  {inboxCount > 99 ? '99+' : inboxCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onTouchEnd={touch(() => navTo('/settings/integrations'))}
              onClick={() => navTo('/settings/integrations')}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 bg-transparent border-0 cursor-pointer"
            >
              Integrations
            </button>
            <button
              type="button"
              onTouchEnd={touch(() => navTo('/settings/feed'))}
              onClick={() => navTo('/settings/feed')}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 bg-transparent border-0 cursor-pointer"
            >
              Feed preferences
            </button>
            <button
              type="button"
              onTouchEnd={touch(() => navTo('/feed?showDismissed=true'))}
              onClick={() => navTo('/feed?showDismissed=true')}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 bg-transparent border-0 cursor-pointer"
            >
              Dismissed items
            </button>
          </nav>
          <div className="border-t border-gray-100 py-1">
            <button
              onTouchEnd={touch(handleSignOut)}
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

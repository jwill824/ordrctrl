import { Outlet, useLocation } from 'react-router-dom';
import { useInboxCount } from '@/hooks/useInboxCount';
import { BottomTabBar } from '@/components/BottomTabBar';
import { Sidebar } from '@/components/Sidebar';
import { AccountMenu } from '@/components/AccountMenu';

export function AppShell() {
  const { inboxCount } = useInboxCount();
  const { pathname } = useLocation();
  return (
    <div className="h-[100dvh] bg-white flex overflow-hidden">
      <Sidebar inboxCount={inboxCount} activePath={pathname} />
      <div className="flex-1 flex flex-col pt-[env(safe-area-inset-top)] md:ml-[240px] overflow-hidden">
        <header className="border-b border-zinc-100 px-5 h-12 flex items-center justify-between flex-shrink-0 bg-white z-10 md:hidden">
          <span className="text-[0.65rem] font-semibold tracking-[0.28em] uppercase text-black">ordrctrl</span>
          <AccountMenu />
        </header>
        <main className="flex-1 overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
          <Outlet />
        </main>
        <BottomTabBar inboxCount={inboxCount} activePath={pathname} />
      </div>
    </div>
  );
}

// T054 — FeedEmptyState component
// Shown when no integrations + no native tasks

import { Link } from 'react-router-dom';

interface FeedEmptyStateProps {
  hasIntegrations: boolean;
}

export function FeedEmptyState({ hasIntegrations }: FeedEmptyStateProps) {
  return (
    <div className="text-center py-16 px-4 text-zinc-500">
      <div className="w-12 h-12 bg-zinc-100 mx-auto mb-6 flex items-center justify-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11l3 3L22 4"/>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
      </div>

      {hasIntegrations ? (
        <>
          <p className="text-[0.9rem] font-semibold text-black mb-1.5">
            Nothing here yet
          </p>
          <p className="text-[0.8rem] mb-6">
            Your synced items will appear here after the first sync completes.
          </p>
        </>
      ) : (
        <>
          <p className="text-[0.9rem] font-semibold text-black mb-1.5">
            No tasks yet
          </p>
          <p className="text-[0.8rem] mb-6">
            Connect a service to sync tasks automatically, or add your first task manually.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link to="/onboarding" className="bg-black text-white py-[0.625rem] px-4 text-[0.7rem] font-bold uppercase tracking-[0.12em] cursor-pointer transition-colors hover:bg-zinc-900 no-underline">
              Connect a service
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

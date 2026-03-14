import { useEffect } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

/** Wraps protected routes — redirects unauthenticated users to /login?redirect=<path> */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`, { replace: true });
    }
  }, [user, loading, navigate, location]);

  if (loading) return null;
  if (!user) return null;
  return <>{children}</>;
}

/** Wraps public auth routes — redirects already-authenticated users to /feed */
export function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to="/feed" replace />;
  return <>{children}</>;
}

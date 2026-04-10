import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, type UserRole } from '@/contexts/AuthContext';
interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Which roles can access this route. Omit = any authenticated user. */
  allowedRoles?: UserRole[];
}

/**
 * Wraps a route to enforce authentication.
 * - Waits for auth hydration (isHydrated) before evaluating access
 * - Unauthenticated → redirects to /login (preserving intended destination)
 * - Wrong role → redirects to /home with a message
 * - Prevents redirect loops and double renders
 */
const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, isHydrated, user } = useAuth();
  const location = useLocation();
  const [hydrationTimeout, setHydrationTimeout] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!isHydrated) {
      timer = setTimeout(() => setHydrationTimeout(true), 10000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isHydrated]);

  // UX-02 FIX: only show the spinner during initial hydration (!isHydrated).
  // Previously, isLoading was also checked, so a background token refresh
  // (which briefly sets isLoading=true) would flash a full-page spinner on
  // every protected page. Post-hydration loading states should not block the UI.
  if (!isHydrated) {
    if (hydrationTimeout) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-background min-h-[50vh]">
          <p className="mb-4 text-muted-foreground">Connection is taking longer than expected. Please verify your network.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 text-sm font-medium text-primary-foreground transition-colors rounded-md bg-primary hover:bg-primary/90"
          >
            Retry Connection
          </button>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" role="status" aria-label="Loading">
          <span className="sr-only">Loading…</span>
        </div>
      </div>
    );
  }

  // Not logged in → redirect to login, remember where they wanted to go
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // UX-02 FIX: Wrong-role users get an immediate synchronous <Navigate> instead of
  // rendering a spinner and waiting for a useEffect to fire post-paint. The previous
  // pattern showed a spinner for 1-2 frames before navigation, causing a visible flash.
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

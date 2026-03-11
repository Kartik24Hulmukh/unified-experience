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

  // Still hydrating from localStorage — show loading spinner
  // Use hardcoded white bg to prevent black flash in dark theme
  if (!isHydrated || isLoading) {
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

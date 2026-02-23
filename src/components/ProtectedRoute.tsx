import { useEffect, useRef } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, type UserRole } from '@/contexts/AuthContext';
import { safeNavigate } from '@/lib/utils';

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
  const navigate = useNavigate();
  const hasNavigated = useRef(false);

  // Auth bypass removed — production mode

  // Reset navigation flag when location changes
  useEffect(() => {
    hasNavigated.current = false;
  }, [location.pathname]);

  // Handle role-based redirection with useEffect to avoid render-time navigation
  useEffect(() => {
    // Wait for hydration to complete before making redirect decisions
    if (!isHydrated || isLoading || hasNavigated.current) return;

    // Role check - redirect if user doesn't have required role
    if (isAuthenticated && allowedRoles && user && !allowedRoles.includes(user.role)) {
      hasNavigated.current = true;
      safeNavigate(navigate, location.pathname, '/home', { replace: true });
    }
  }, [isAuthenticated, isLoading, isHydrated, user, allowedRoles, navigate, location.pathname]);

  // Still hydrating from localStorage — show loading spinner
  // Use hardcoded white bg to prevent black flash in dark theme
  if (!isHydrated || isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
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

  // Role check - don't render children if wrong role (navigation happens in useEffect)
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" role="status" aria-label="Redirecting">
          <span className="sr-only">Redirecting…</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;

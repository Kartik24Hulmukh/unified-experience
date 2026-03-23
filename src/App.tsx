import { lazy, Suspense, memo, useEffect, useRef } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, QueryCache, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate, useNavigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import ProtectedRoute from "@/components/ProtectedRoute";
import PageTransition from "./components/PageTransition";
import SkipToContent from "./components/SkipToContent";
import { FullPageLoader } from "./components/FallbackUI";
import { handleApiError } from "@/lib/error-handler";
import { ApiError } from "@/lib/api-client";
import { trackPageView } from "@/lib/monitoring";
import { LazyMotion, domAnimation } from 'framer-motion';
import { HelmetProvider } from 'react-helmet-async';

// Lazy-load heavy global decorations — not needed for first paint
const GooeyCursor = lazy(() => import('./components/GooeyCursor'));
const ContextNav = lazy(() => import('./components/ContextNav'));
const ScanlineOverlay = lazy(() => import('./components/ScanlineOverlay'));

// Lazy-load all route-level pages for code splitting
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Index = lazy(() => import('./pages/Index'));
const ResalePage = lazy(() => import('./pages/ResalePage'));
const AccommodationPage = lazy(() => import('./pages/AccommodationPage'));
const EssentialsPage = lazy(() => import('./pages/EssentialsPage'));
const AcademicsPage = lazy(() => import('./pages/AcademicsPage'));
const NotFound = lazy(() => import('./pages/NotFound'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const VerificationPage = lazy(() => import('./pages/VerificationPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const MessPage = lazy(() => import('./pages/MessPage'));
const JobsPage = lazy(() => import('./pages/JobsPage'));
const HospitalPage = lazy(() => import('./pages/HospitalPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const ListingDetailPage = lazy(() => import('./pages/ListingDetailPage'));
const SplashTestPage = lazy(() => import('./pages/SplashTestPage'));
import AgentsHub from './components/AgentsHub';

const queryClient = new QueryClient({
  // M2-FIX: global QueryCache error handler catches unrecoverable 401s from
  // background queries (e.g. profile refetch, stale-while-revalidate) that
  // would otherwise silently log the user out with no toast notification.
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'UNAUTHORIZED') {
        handleApiError(error, { context: 'BackgroundQuery' });
      }
    },
  }),
  defaultOptions: {
    queries: {
      // AUTH-SESSION-01: never retry 401/403 — the api-client already
      // handles token refresh. Retrying auth errors causes triple-logout
      // broadcasts, duplicate toasts, and cache thrashing.
      retry: (failureCount, error) => {
        if (error instanceof ApiError && (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN')) {
          return false;
        }
        return failureCount < 2;
      },
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (error) => handleApiError(error, { context: 'Mutation' }),
    },
  },
});

/** Route-level error boundary wrapper — granular recovery per page.
 *  MED-A FIX: key={pathname} forces ErrorBoundary to remount on each
 *  navigation so a caught error on one page doesn't persist to the next.
 */
const RouteErrorBoundary = memo(function RouteErrorBoundary({ name, children }: { name: string; children: React.ReactNode }) {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary key={pathname} boundary={name}>
      {children}
    </ErrorBoundary>
  );
});

/** Renders ScanlineOverlay only on dark-bg module pages */
const ConditionalScanline = memo(function ConditionalScanline() {
  const { pathname } = useLocation();
  const scanlinePages = ['/accommodation', '/essentials', '/mess', '/hospital'];
  if (!scanlinePages.includes(pathname)) return null;
  return (
    <Suspense fallback={null}>
      <ScanlineOverlay />
    </Suspense>
  );
});

/** Tracks page views for analytics / monitoring */
function PageViewTracker() {
  const { pathname } = useLocation();
  // UX-3 FIX: only fire after auth hydration is complete. Without this guard,
  // an authenticated user hitting '/' triggers: '/' view → redirect to '/home' →
  // '/home' view, polluting analytics with phantom page views before hydration.
  const { isHydrated } = useAuth();
  useEffect(() => {
    if (!isHydrated) return;
    trackPageView(pathname);
  }, [pathname, isHydrated]);
  return null;
}

/** H2-FIX: Clears the React Query cache on ANY auth→unauth transition.
 *  ContextNav only clears on explicit logout button click; this catches
 *  multi-tab logout, session expiry, and 401-triggered forced logout. */
function AuthCacheSyncer() {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const prevAuth = useRef(isAuthenticated);

  useEffect(() => {
    if (prevAuth.current && !isAuthenticated) {
      qc.clear();
    }
    prevAuth.current = isAuthenticated;
  }, [isAuthenticated, qc]);

  return null;
}

function AuthLogoutRedirectSyncer() {
  const { isAuthenticated, isHydrated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // If the user lands on the login page, their forced redirection is complete.
    // Clear the sentinel so they can navigate to /signup or / freely.
    if (location.pathname === '/login') {
      try {
        localStorage.removeItem('berozgar_post_logout_redirect');
      } catch {}
      return;
    }

    if (!isHydrated || isAuthenticated) return;

    let shouldRedirect = false;
    try {
      shouldRedirect = !!localStorage.getItem('berozgar_post_logout_redirect');
    } catch {
      shouldRedirect = false;
    }

    if (!shouldRedirect) return;

    navigate('/login', {
      replace: true,
      state: { from: location.pathname },
    });
  }, [isAuthenticated, isHydrated, location.pathname, navigate]);

  return null;
}

const App = () => (
  <HelmetProvider>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        disableTransitionOnChange
        storageKey="berozgar-theme"
      >
        <TooltipProvider>
          <AuthProvider>
            <ProfileProvider>
              <AuthCacheSyncer />
              <Toaster />
              <Sonner />
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <PageViewTracker />
                <AuthLogoutRedirectSyncer />
                <SkipToContent />
                <Suspense fallback={null}>
                  <GooeyCursor size={28} />
                </Suspense>
                <Suspense fallback={null}>
                  <ContextNav />
                </Suspense>
                <ConditionalScanline />

                <main id="main-content">
                  <PageTransition>
                    <ErrorBoundary boundary="LazyRoutes">
                      <Suspense fallback={<FullPageLoader />}>
                        <Routes>
                        {/* Landing Page (Cinematic Splash) */}
                        <Route path="/" element={<RouteErrorBoundary name="Landing"><LandingPage /></RouteErrorBoundary>} />
                        <Route path="/splash" element={<Navigate to="/" replace />} />
                        
                        <Route path="/login" element={<RouteErrorBoundary name="Login"><LoginPage /></RouteErrorBoundary>} />
                        <Route path="/signup" element={<RouteErrorBoundary name="Signup"><SignupPage /></RouteErrorBoundary>} />
                        <Route path="/verify" element={<RouteErrorBoundary name="Verify"><VerificationPage /></RouteErrorBoundary>} />
                        {/* Dev-only test route — excluded from production builds */}
                        {import.meta.env.DEV && <Route path="/splash-test" element={<SplashTestPage />} />}

                        {/* Post-login home — MasterExperience + modules */}
                        <Route path="/home" element={<RouteErrorBoundary name="Home"><Index /></RouteErrorBoundary>} />
                        <Route path="/dashboard" element={<Navigate to="/home" replace />} />

                        {/* Module routes — actions and viewing restricted to authenticated users to prevent data leaks */}
                        <Route path="/resale" element={<ProtectedRoute><RouteErrorBoundary name="Resale"><ResalePage /></RouteErrorBoundary></ProtectedRoute>} />
                        <Route path="/listing/:id" element={<ProtectedRoute><RouteErrorBoundary name="ListingDetail"><ListingDetailPage /></RouteErrorBoundary></ProtectedRoute>} />
                        <Route path="/accommodation" element={<ProtectedRoute><RouteErrorBoundary name="Accommodation"><AccommodationPage /></RouteErrorBoundary></ProtectedRoute>} />
                        <Route path="/essentials" element={<ProtectedRoute><RouteErrorBoundary name="Essentials"><EssentialsPage /></RouteErrorBoundary></ProtectedRoute>} />
                        <Route path="/academics" element={<ProtectedRoute><RouteErrorBoundary name="Academics"><AcademicsPage /></RouteErrorBoundary></ProtectedRoute>} />
                        <Route path="/jobs" element={<ProtectedRoute><RouteErrorBoundary name="Jobs"><JobsPage /></RouteErrorBoundary></ProtectedRoute>} />
                        <Route path="/mess" element={<ProtectedRoute><RouteErrorBoundary name="Mess"><MessPage /></RouteErrorBoundary></ProtectedRoute>} />
                        <Route path="/hospital" element={<ProtectedRoute><RouteErrorBoundary name="Hospital"><HospitalPage /></RouteErrorBoundary></ProtectedRoute>} />
                        <Route path="/agency" element={<ProtectedRoute allowedRoles={['admin']}><RouteErrorBoundary name="Agency"><AgentsHub /></RouteErrorBoundary></ProtectedRoute>} />

                        {/* Profile — any authenticated user */}
                        <Route path="/profile" element={<ProtectedRoute><RouteErrorBoundary name="Profile"><ProfilePage /></RouteErrorBoundary></ProtectedRoute>} />

                        {/* Admin drilldown — admin views a student profile (read-only) */}
                        <Route path="/profile/:userId" element={<ProtectedRoute allowedRoles={['admin']}><RouteErrorBoundary name="AdminDrilldown"><ProfilePage /></RouteErrorBoundary></ProtectedRoute>} />

                        {/* Admin — restricted to admin role */}
                        <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><RouteErrorBoundary name="Admin"><AdminPage /></RouteErrorBoundary></ProtectedRoute>} />

                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Suspense>
                  </ErrorBoundary>
                  </PageTransition>
                </main>
              </BrowserRouter>
            </ProfileProvider>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  </HelmetProvider>
);

export default App;

import { lazy, Suspense, memo, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import ProtectedRoute from "@/components/ProtectedRoute";
import PageTransition from "./components/PageTransition";
import SkipToContent from "./components/SkipToContent";
import { FullPageLoader } from "./components/FallbackUI";
import { handleApiError } from "@/lib/error-handler";
import { trackPageView } from "@/lib/monitoring";

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
const HospitalPage = lazy(() => import('./pages/HospitalPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const ListingDetailPage = lazy(() => import('./pages/ListingDetailPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (error) => handleApiError(error, { context: 'Mutation' }),
    },
  },
});

/** Route-level error boundary wrapper — granular recovery per page */
const RouteErrorBoundary = memo(function RouteErrorBoundary({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <ErrorBoundary boundary={name}>
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
  useEffect(() => {
    trackPageView(pathname);
  }, [pathname]);
  return null;
}

const App = () => (
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
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <PageViewTracker />
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
                    <Suspense fallback={<FullPageLoader />}>
                      <Routes>
                      {/* Public routes */}
                      <Route path="/" element={<RouteErrorBoundary name="Landing"><LandingPage /></RouteErrorBoundary>} />
                      <Route path="/login" element={<RouteErrorBoundary name="Login"><LoginPage /></RouteErrorBoundary>} />
                      <Route path="/signup" element={<RouteErrorBoundary name="Signup"><SignupPage /></RouteErrorBoundary>} />
                      <Route path="/verify" element={<RouteErrorBoundary name="Verify"><VerificationPage /></RouteErrorBoundary>} />

                      {/* Post-login home — MasterExperience + modules */}
                      <Route path="/home" element={<ProtectedRoute><RouteErrorBoundary name="Home"><Index /></RouteErrorBoundary></ProtectedRoute>} />

                      {/* Protected module routes — require authentication */}
                      <Route path="/resale" element={<ProtectedRoute><RouteErrorBoundary name="Resale"><ResalePage /></RouteErrorBoundary></ProtectedRoute>} />
                      <Route path="/listing/:id" element={<ProtectedRoute><RouteErrorBoundary name="ListingDetail"><ListingDetailPage /></RouteErrorBoundary></ProtectedRoute>} />
                      <Route path="/accommodation" element={<ProtectedRoute><RouteErrorBoundary name="Accommodation"><AccommodationPage /></RouteErrorBoundary></ProtectedRoute>} />
                      <Route path="/essentials" element={<ProtectedRoute><RouteErrorBoundary name="Essentials"><EssentialsPage /></RouteErrorBoundary></ProtectedRoute>} />
                      <Route path="/academics" element={<ProtectedRoute><RouteErrorBoundary name="Academics"><AcademicsPage /></RouteErrorBoundary></ProtectedRoute>} />
                      <Route path="/mess" element={<ProtectedRoute><RouteErrorBoundary name="Mess"><MessPage /></RouteErrorBoundary></ProtectedRoute>} />
                      <Route path="/hospital" element={<ProtectedRoute><RouteErrorBoundary name="Hospital"><HospitalPage /></RouteErrorBoundary></ProtectedRoute>} />

                      {/* Profile — any authenticated user */}
                      <Route path="/profile" element={<ProtectedRoute><RouteErrorBoundary name="Profile"><ProfilePage /></RouteErrorBoundary></ProtectedRoute>} />

                      {/* Admin drilldown — admin views a student profile (read-only) */}
                      <Route path="/profile/:userId" element={<ProtectedRoute allowedRoles={['admin']}><RouteErrorBoundary name="AdminDrilldown"><ProfilePage /></RouteErrorBoundary></ProtectedRoute>} />

                      {/* Admin — restricted to admin role */}
                      <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><RouteErrorBoundary name="Admin"><AdminPage /></RouteErrorBoundary></ProtectedRoute>} />

                      <Route path="*" element={<NotFound />} />
                    </Routes>
                    </Suspense>
                  </PageTransition>
                </main>
              </BrowserRouter>
            </ProfileProvider>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;

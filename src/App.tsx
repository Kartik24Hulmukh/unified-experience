import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import LandingPage from "./pages/LandingPage";
import Index from "./pages/Index";
import ResalePage from "./pages/ResalePage";
import AccommodationPage from "./pages/AccommodationPage";
import EssentialsPage from "./pages/EssentialsPage";
import AcademicsPage from "./pages/AcademicsPage";
import NotFound from "./pages/NotFound";
import ContextNav from "./components/ContextNav";
import GooeyCursor from "./components/GooeyCursor";
import PageTransition from "./components/PageTransition";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import VerificationPage from "./pages/VerificationPage";
import AdminPage from "./pages/AdminPage";
import MessPage from "./pages/MessPage";
import HospitalPage from "./pages/HospitalPage";
import SkipToContent from "./components/SkipToContent";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <SkipToContent />
          <GooeyCursor size={28} />
          <ContextNav />

          <PageTransition>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/verify" element={<VerificationPage />} />

              {/* Post-login home — MasterExperience + modules */}
              <Route path="/home" element={<ProtectedRoute><Index /></ProtectedRoute>} />

              {/* Protected module routes — require authentication */}
              <Route path="/resale" element={<ProtectedRoute><ResalePage /></ProtectedRoute>} />
              <Route path="/accommodation" element={<ProtectedRoute><AccommodationPage /></ProtectedRoute>} />
              <Route path="/essentials" element={<ProtectedRoute><EssentialsPage /></ProtectedRoute>} />
              <Route path="/academics" element={<ProtectedRoute><AcademicsPage /></ProtectedRoute>} />
              <Route path="/mess" element={<ProtectedRoute><MessPage /></ProtectedRoute>} />
              <Route path="/hospital" element={<ProtectedRoute><HospitalPage /></ProtectedRoute>} />

              {/* Admin — restricted to admin role */}
              <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminPage /></ProtectedRoute>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </PageTransition>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

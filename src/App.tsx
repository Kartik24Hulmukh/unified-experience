import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import SkipToContent from "./components/SkipToContent";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SkipToContent />
        {/* Global cursor */}
        <GooeyCursor size={28} />

        {/* Context-aware navigation */}
        <ContextNav />

        {/* Page transitions wrapper */}
        <PageTransition>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/resale" element={<ResalePage />} />
            <Route path="/accommodation" element={<AccommodationPage />} />
            <Route path="/essentials" element={<EssentialsPage />} />
            <Route path="/academics" element={<AcademicsPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/verify" element={<VerificationPage />} />
            <Route path="/admin" element={<AdminPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </PageTransition>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

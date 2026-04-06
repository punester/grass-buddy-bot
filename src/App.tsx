import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import Index from "./pages/Index";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Unsubscribe from "./pages/Unsubscribe";
import Admin from "./pages/Admin";
import ShortLinkRedirect from "./pages/ShortLinkRedirect";
import About from "./pages/About";
import Contact from "./pages/Contact";
import EmailUnsubscribe from "./pages/EmailUnsubscribe";
import Pricing from "./pages/Pricing";
import Privacy from "./pages/Privacy";
import TermsOfService from "./pages/TermsOfService";
import NotFound from "./pages/NotFound";
import Referrals from "./pages/Referrals";
import { useTrackingParams } from "@/hooks/useTrackingParams";

const queryClient = new QueryClient();

const TrackingParamsCapture = ({ children }: { children: React.ReactNode }) => {
  useTrackingParams();
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <TrackingParamsCapture>
        <AuthProvider>
          <SettingsProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/unsubscribe" element={<Unsubscribe />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/email-unsubscribe" element={<EmailUnsubscribe />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/tos" element={<TermsOfService />} />
              <Route path="/referrals" element={<Referrals />} />
              <Route path="/r/:code" element={<ShortLinkRedirect />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </SettingsProvider>
        </AuthProvider>
        </TrackingParamsCapture>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

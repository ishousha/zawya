import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import * as Sentry from "@sentry/react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import AppRoutes from "@/components/AppRoutes";
import PWAUpdatePrompt from "@/components/PWAUpdatePrompt";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,       // 60s — prevents re-fetch on tab switch
      gcTime: 5 * 60 * 1000,   // keep unused data 5 min before GC
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <Sentry.ErrorBoundary fallback={<p className="p-8 text-center text-destructive">Something went wrong. Please refresh the page.</p>}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <PWAUpdatePrompt />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </Sentry.ErrorBoundary>
);

export default App;

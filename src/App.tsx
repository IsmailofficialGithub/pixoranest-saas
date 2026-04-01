import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ClientLayout from "./components/client/ClientLayout";
import ClientDashboardHome from "./pages/client/ClientDashboardHome";
import VoiceAgentPage from "./pages/client/VoiceAgentPage";
import LeadsPage from "./pages/client/LeadsPage";
import CallOrbitorPage from "./pages/client/CallOrbitorPage";
import VoiceTelecallerPage from "./pages/client/VoiceTelecallerPage";
import VoiceReceptionistPage from "./pages/client/VoiceReceptionistPage";
import CampaignDetailPage from "./pages/client/CampaignDetailPage";
import CallLogsPage from "./pages/client/CallLogsPage";
import WhatsAppPage from "./pages/client/WhatsAppPage";
import WhatsAppHistoryPage from "./pages/client/WhatsAppHistoryPage";
import SocialMediaPage from "./pages/client/SocialMediaPage";
import UsageBillingPage from "./pages/client/UsageBillingPage";
import ClientSettingsPage from "./pages/client/ClientSettingsPage";
import ClientNotificationsPage from "./pages/client/ClientNotificationsPage";
import HelpSupportPage from "./pages/client/HelpSupportPage";
import InboundServicePage from "./pages/client/InboundServicePage";
import InstallPage from "./pages/client/InstallPage";
import ClientAnalyticsPage from "./pages/client/ClientAnalyticsPage";
import ServiceCatalogPage from "./pages/client/ServiceCatalogPage";
import EmailMarketingPage from "./pages/client/EmailMarketingPage";
import AIConfigurationPage from "./pages/client/AIConfigurationPage";
import LiveChatPage from "./pages/client/LiveChatPage";
import LandingPageBuilder from "./pages/client/LandingPageBuilder";
import NotFound from "./pages/NotFound";
import FloatingChatWidget from "./components/chat/FloatingChatWidget";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 8000),
      staleTime: 5 * 60 * 1000,
    },
    mutations: {
      retry: 1,
    },
  },
});

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/super-admin/*"
              element={
                <ProtectedRoute allowedRoles={["super_admin"]}>
                  <SuperAdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/*"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client"
              element={
                <ProtectedRoute allowedRoles={["client"]}>
                  <ClientLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<ClientDashboardHome />} />
              <Route path="voice-telecaller" element={<VoiceTelecallerPage />} />
              <Route path="voice-telecaller/calls" element={<CallLogsPage />} />
              <Route path="voice-telecaller/campaigns/:campaignId" element={<CampaignDetailPage />} />
              <Route path="voice-receptionist" element={<VoiceReceptionistPage />} />
              <Route path="inbound" element={<InboundServicePage />} />
              <Route path="voice-agent" element={<VoiceAgentPage />} />
              <Route path="whatsapp" element={<WhatsAppPage />} />
              <Route path="whatsapp/history" element={<WhatsAppHistoryPage />} />
              <Route path="social-media" element={<SocialMediaPage />} />
              <Route path="email-marketing" element={<EmailMarketingPage />} />
              <Route path="leads" element={<LeadsPage />} />
              <Route path="usage" element={<UsageBillingPage />} />
              <Route path="settings" element={<ClientSettingsPage />} />
              <Route path="notifications" element={<ClientNotificationsPage />} />
              <Route path="help" element={<HelpSupportPage />} />
              <Route path="install" element={<InstallPage />} />
              <Route path="analytics" element={<ClientAnalyticsPage />} />
              <Route path="services" element={<ServiceCatalogPage />} />
              <Route path="ai-config" element={<AIConfigurationPage />} />
              <Route path="live-chat" element={<LiveChatPage />} />
              <Route path="landing-page-builder" element={<LandingPageBuilder />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          <FloatingChatWidget />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;

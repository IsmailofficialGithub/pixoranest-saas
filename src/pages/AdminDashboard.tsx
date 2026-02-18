import { Routes, Route } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminDashboardHome from "@/pages/admin/AdminDashboardHome";
import WhiteLabelSettingsPage from "@/pages/admin/WhiteLabelSettingsPage";
import ServiceCatalogPage from "@/pages/admin/ServiceCatalogPage";
import MyPricingPage from "@/pages/admin/MyPricingPage";
import MyClientsPage from "@/pages/admin/MyClientsPage";
import AdminClientDetailPage from "@/pages/admin/AdminClientDetailPage";
import AdminAnalyticsPage from "@/pages/admin/AdminAnalyticsPage";
import AdminBillingPage from "@/pages/admin/AdminBillingPage";
import AdminSettingsPage from "@/pages/admin/AdminSettingsPage";
import VoiceAgentPage from "@/pages/admin/VoiceAgentPage";
import AdminVoiceReceptionistPage from "@/pages/admin/AdminVoiceReceptionistPage";
import AdminVoiceTelecallerPage from "@/pages/admin/AdminVoiceTelecallerPage";
import AdminWhatsAppPage from "@/pages/admin/AdminWhatsAppPage";
import AdminSocialMediaPage from "@/pages/admin/AdminSocialMediaPage";

export default function AdminDashboard() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<AdminDashboardHome />} />
        <Route path="white-label" element={<WhiteLabelSettingsPage />} />
        <Route path="services" element={<ServiceCatalogPage />} />
        <Route path="pricing" element={<MyPricingPage />} />
        <Route path="clients" element={<MyClientsPage />} />
        <Route path="clients/:clientId" element={<AdminClientDetailPage />} />
        <Route path="voice-agent" element={<VoiceAgentPage />} />
        <Route path="voice-receptionist" element={<AdminVoiceReceptionistPage />} />
        <Route path="voice-telecaller" element={<AdminVoiceTelecallerPage />} />
        <Route path="whatsapp" element={<AdminWhatsAppPage />} />
        <Route path="social-media" element={<AdminSocialMediaPage />} />
        <Route path="analytics" element={<AdminAnalyticsPage />} />
        <Route path="billing" element={<AdminBillingPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
      </Route>
    </Routes>
  );
}

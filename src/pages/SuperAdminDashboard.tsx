import { Routes, Route } from "react-router-dom";
import SuperAdminLayout from "@/components/super-admin/SuperAdminLayout";
import DashboardHome from "./super-admin/DashboardHome";

import ServicesPage from "./super-admin/ServicesPage";
import AdminsPage from "./super-admin/AdminsPage";
import AdminDetailPage from "./super-admin/AdminDetailPage";
import ClientsPage from "./super-admin/ClientsPage";
import ClientDetailPage from "./super-admin/ClientDetailPage";
import AnalyticsPage from "./super-admin/AnalyticsPage";
import SettingsPage from "./super-admin/SettingsPage";
import NotificationsPage from "./super-admin/NotificationsPage";
import N8nControllerPage from "./super-admin/N8nControllerPage";
import BotsPage from "./super-admin/BotsPage";
import OutboundCampaignsPage from "./super-admin/OutboundCampaignsPage";
import OutboundCallLogsPage from "./super-admin/OutboundCallLogsPage";
import InboundNumbersPage from "./super-admin/InboundNumbersPage";

export default function SuperAdminDashboard() {
  return (
    <Routes>
      <Route element={<SuperAdminLayout />}>
        <Route index element={<DashboardHome />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="admins" element={<AdminsPage />} />
        <Route path="admins/:adminId" element={<AdminDetailPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="clients/:clientId" element={<ClientDetailPage />} />
        <Route path="inbound-numbers" element={<InboundNumbersPage />} />
        <Route path="outbound-bots" element={<BotsPage />} />
        <Route path="outbound-campaigns" element={<OutboundCampaignsPage />} />
        <Route path="outbound-call-logs" element={<OutboundCallLogsPage />} />
        <Route path="n8n-controller" element={<N8nControllerPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>
    </Routes>
  );
}

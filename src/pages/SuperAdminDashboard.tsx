import { Routes, Route } from "react-router-dom";
import SuperAdminLayout from "@/components/super-admin/SuperAdminLayout";
import DashboardHome from "@/pages/super-admin/DashboardHome";

import ServicesPage from "@/pages/super-admin/ServicesPage";
import AdminsPage from "@/pages/super-admin/AdminsPage";
import AdminDetailPage from "@/pages/super-admin/AdminDetailPage";
import ClientsPage from "@/pages/super-admin/ClientsPage";
import ClientDetailPage from "@/pages/super-admin/ClientDetailPage";
import AnalyticsPage from "@/pages/super-admin/AnalyticsPage";
import SettingsPage from "@/pages/super-admin/SettingsPage";
import NotificationsPage from "@/pages/super-admin/NotificationsPage";
import N8nControllerPage from "@/pages/super-admin/N8nControllerPage";

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
        <Route path="n8n-controller" element={<N8nControllerPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>
    </Routes>
  );
}

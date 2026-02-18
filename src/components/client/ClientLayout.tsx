import { useState } from "react";
import { Outlet } from "react-router-dom";
import ClientSidebar from "./ClientSidebar";
import ClientHeader from "./ClientHeader";
import MobileBottomNav from "./MobileBottomNav";
import { ClientProvider } from "@/contexts/ClientContext";

export default function ClientLayout() {
  return (
    <ClientProvider>
      <ClientLayoutInner />
    </ClientProvider>
  );
}

function ClientLayoutInner() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-muted/40 md:flex">
      <ClientSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <ClientHeader onMenuClick={() => setSidebarOpen(true)} />

      <main className="flex-1 pt-14 md:pt-16 pb-16 md:pb-0 min-h-screen">
        <div className="p-4 md:p-6">
          <Outlet />
        </div>
      </main>

      <MobileBottomNav />
    </div>
  );
}

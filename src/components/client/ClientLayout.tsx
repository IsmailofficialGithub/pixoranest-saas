import { useState } from "react";
import { Outlet } from "react-router-dom";
import ClientSidebar from "./ClientSidebar";
import ClientHeader from "./ClientHeader";
import MobileBottomNav from "./MobileBottomNav";
import { ClientProvider } from "@/contexts/ClientContext";
import { motion, AnimatePresence } from "framer-motion";

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
    <div className="min-h-screen bg-mesh md:flex overflow-hidden">
      <ClientSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <ClientHeader onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto pt-14 md:pt-16 pb-16 md:pb-0">
          <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={window.location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      <MobileBottomNav />
    </div>
  );
}


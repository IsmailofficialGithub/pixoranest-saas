import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Activity,
  Settings,
  BarChart3,
  Package,
  X,
  Sparkles,
  Zap,
  MessageSquare,
  Layout,
  History as HistoryIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClient } from "@/contexts/ClientContext";
import { getServicePath, getServiceIcon, getServiceLabel } from "@/lib/service-routes";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface ClientSidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function ClientSidebar({ open, onClose }: ClientSidebarProps) {
  const location = useLocation();
  const { admin, assignedServices, primaryColor } = useClient();

  const isActive = (path: string) => {
    if (path === "/client") return location.pathname === "/client";
    return location.pathname.startsWith(path);
  };

  const serviceNavItems = assignedServices
    .map((svc) => {
      const slug = svc.service_slug;
      const Icon = getServiceIcon(slug);
      const label = getServiceLabel(slug) || svc.service_name;
      if (!Icon) return null;
      return { title: label, icon: Icon, path: getServicePath(slug) };
    })
    .filter(Boolean) as { title: string; icon: React.ElementType; path: string }[];

  const commonNavItems = [
    { title: "Live Chat", icon: MessageSquare, path: "/client/live-chat" },
    { title: "Bot History", icon: HistoryIcon, path: "/client/whatsapp/history" },
    // { title: "Landing Page Builder", icon: Layout, path: "/client/landing-page-builder" },
    { title: "AI Configuration", icon: Sparkles, path: "/client/ai-config" },
    { title: "Service Catalog", icon: Package, path: "/client/services" },
    { title: "Analytics", icon: BarChart3, path: "/client/analytics" },
    { title: "Usage & Billing", icon: Activity, path: "/client/usage" },
    { title: "Settings", icon: Settings, path: "/client/settings" },
  ];

  const allNavItems = [
    { title: "Dashboard", icon: LayoutDashboard, path: "/client" },
    ...serviceNavItems,
    ...commonNavItems,
  ];

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 bg-sidebar/60 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar flex flex-col transition-transform duration-300 md:translate-x-0 md:static md:z-0 border-r border-sidebar-border",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-6 py-6 border-b border-white/5 min-h-[80px]">
          <div className="flex items-center gap-3 min-w-0">
            <motion.div 
              whileHover={{ rotate: 5, scale: 1.05 }}
              className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white/5 shadow-lg shadow-black/20 shrink-0 border border-white/10"
            >
              <img src="/logo.png" alt="PIXORA" className="h-full w-full object-contain p-1" />
            </motion.div>
            <div className="flex flex-col min-w-0">
              <span className="text-xl font-black text-white tracking-tighter leading-none">PIXORA</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1 leading-none">CLIENT NEST</span>
            </div>
          </div>
          <button onClick={onClose} className="md:hidden p-2 rounded-full hover:bg-white/10 transition-colors">
            <X className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1 custom-scrollbar">
          {allNavItems.map((item, idx) => {
            const active = isActive(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/client"}
                onClick={onClose}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                  active
                    ? "text-white shadow-lg shadow-primary/10"
                    : "text-slate-200 hover:text-white hover:bg-white/5"
                )}
                style={active ? { backgroundColor: primaryColor || "#304f9f" } : undefined}
              >
                <item.icon className={cn(
                  "h-5 w-5 shrink-0 transition-transform group-hover:scale-110",
                  active ? "text-white" : "text-slate-300 group-hover:text-white"
                )} />
                <span className="truncate">{item.title}</span>
                {active && (
                  <motion.div 
                    layoutId="active-indicator"
                    className="ml-auto h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_white]" 
                  />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Support Card in Sidebar */}
        <div className="p-4 mt-auto">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
            <p className="text-xs font-semibold text-white mb-1">Need help?</p>
            <p className="text-[10px] text-slate-300 mb-3 leading-relaxed">Contact your manager for any assistance.</p>
            <Button size="sm" variant="ghost" className="w-full h-8 text-[11px] bg-primary/20 hover:bg-primary/30 text-white rounded-lg">
              Contact Support
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}


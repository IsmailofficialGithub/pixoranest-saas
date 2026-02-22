import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Activity,
  Settings,
  BarChart3,
  Package,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClient } from "@/contexts/ClientContext";
import { getServicePath, getServiceIcon, getServiceLabel } from "@/lib/service-routes";

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

  // Build dynamic service nav items using shared mapping
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
    { title: "Service Catalog", icon: Package, path: "/client/services" },
    { title: "Leads", icon: Users, path: "/client/leads" },
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
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r flex flex-col transition-transform duration-200 md:translate-x-0 md:static md:z-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand header */}
        <div className="flex items-center justify-between px-4 py-4 border-b min-h-[65px]">
          <div className="flex items-center gap-2.5 min-w-0">
            {admin?.logo_url ? (
              <img
                src={admin.logo_url}
                alt={admin.company_name}
                className="h-8 w-8 rounded-md object-cover shrink-0"
              />
            ) : (
              <img
                src="/logo.png"
                alt="Logo"
                className="h-8 w-8 rounded-md object-contain shrink-0"
              />
            )}
            <span className="font-semibold text-foreground truncate text-sm">
              {admin?.company_name || "Client Portal"}
            </span>
          </div>
          <button onClick={onClose} className="md:hidden p-1.5 rounded hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {allNavItems.map((item) => {
            const active = isActive(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/client"}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "text-white"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                style={active ? { backgroundColor: primaryColor } : undefined}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.title}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Palette,
  Package,
  DollarSign,
  Users,
  BarChart,
  CreditCard,
  Settings,
  Bot,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdmin } from "@/contexts/AdminContext";

const navItems = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/admin" },
  { title: "White-Label Settings", icon: Palette, path: "/admin/white-label" },
  { title: "Service Catalog", icon: Package, path: "/admin/services" },
  { title: "My Pricing", icon: DollarSign, path: "/admin/pricing" },
  { title: "My Clients", icon: Users, path: "/admin/clients" },
  { title: "AI Voice Agent", icon: Bot, path: "/admin/voice-agent" },
  { title: "Analytics", icon: BarChart, path: "/admin/analytics" },
  { title: "Billing", icon: CreditCard, path: "/admin/billing" },
  { title: "Settings", icon: Settings, path: "/admin/settings" },
];

interface AdminSidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function AdminSidebar({ open, onClose }: AdminSidebarProps) {
  const location = useLocation();
  const { admin, logo, primaryColor } = useAdmin();

  const isActive = (path: string) => {
    if (path === "/admin") return location.pathname === "/admin";
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-card shadow-sm transition-transform duration-300 ease-in-out",
          "md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="flex items-center justify-between px-5 py-5 border-b">
          <div className="flex items-center gap-2 min-w-0">
            {logo ? (
              <img
                src={logo}
                alt={admin?.company_name || "Logo"}
                className="h-8 w-auto max-w-[100px] object-contain"
              />
            ) : (
              <span className="font-bold text-lg text-foreground truncate">
                {admin?.company_name || "Admin Portal"}
              </span>
            )}
          </div>
          <button onClick={onClose} className="md:hidden p-1 rounded hover:bg-muted">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
        <p className="px-5 pt-2 text-xs text-muted-foreground">Admin Portal</p>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/admin"}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-md px-4 py-3 md:py-2.5 text-sm font-medium transition-colors min-h-[44px]",
                  active
                    ? "text-white"
                    : "text-muted-foreground hover:text-foreground"
                )}
                style={{
                  backgroundColor: active ? primaryColor : undefined,
                  ...((!active)
                    ? {}
                    : {}),
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = `${primaryColor}15`;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = "";
                  }
                }}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.title}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

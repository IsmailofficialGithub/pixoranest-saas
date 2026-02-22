import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Zap, LayoutDashboard, Layers, Users, Briefcase, Workflow, BarChart, Settings, X, Bot, List, PhoneCall, PhoneIncoming } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/super-admin" },
  { title: "Services", icon: Layers, path: "/super-admin/services" },
  { title: "Admins", icon: Users, path: "/super-admin/admins" },
  { title: "Clients", icon: Briefcase, path: "/super-admin/clients" },
  { title: "Inbound Numbers", icon: PhoneIncoming, path: "/super-admin/inbound-numbers" },
  { title: "Outbound Bots", icon: Bot, path: "/super-admin/outbound-bots" },
  { title: "Outbound Campaigns", icon: List, path: "/super-admin/outbound-campaigns" },
  { title: "Call Logs", icon: PhoneCall, path: "/super-admin/outbound-call-logs" },
  // { title: "n8n Controller", icon: Workflow, path: "/super-admin/n8n-controller" },
  { title: "Analytics", icon: BarChart, path: "/super-admin/analytics" },
  { title: "Settings", icon: Settings, path: "/super-admin/settings" },
];

interface SuperAdminSidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function SuperAdminSidebar({ open, onClose }: SuperAdminSidebarProps) {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/super-admin") return location.pathname === "/super-admin";
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
          <Link to="/super-admin" className="flex items-center gap-2">
            <img src="/logo.png" alt="Pixoranest" className="h-8 w-auto" />
          </Link>
          <button onClick={onClose} className="md:hidden p-1 rounded hover:bg-muted">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/super-admin"}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-md px-4 py-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-blue-500 text-white"
                    : "text-muted-foreground hover:bg-blue-50 hover:text-foreground"
                )}
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

import { useState } from "react";
import { motion } from "framer-motion";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Zap, LayoutDashboard, Layers, Users, Briefcase, BarChart, Settings, X, Bot, List, PhoneCall, PhoneIncoming, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/super-admin" },
  { title: "Services", icon: Layers, path: "/super-admin/services" },
  { title: "Admins", icon: Users, path: "/super-admin/admins" },
  { title: "Clients", icon: Briefcase, path: "/super-admin/clients" },
  { title: "Inbound Numbers", icon: PhoneIncoming, path: "/super-admin/inbound-numbers" },
  { title: "Outbound Bots", icon: Bot, path: "/super-admin/outbound-bots" },
  { title: "WhatsApp Management", icon: MessageCircle, path: "/super-admin/whatsapp/bots" },
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
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-sidebar border-r border-sidebar-border transition-transform duration-300 md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
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
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1 leading-none">SUPER NEST</span>
            </div>
          </div>
          <button onClick={onClose} className="md:hidden p-2 rounded-full hover:bg-white/10 transition-colors">
            <X className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1 custom-scrollbar">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/super-admin"}
                onClick={onClose}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-primary text-white shadow-lg shadow-primary/10"
                    : "text-slate-200 hover:text-white hover:bg-white/5"
                )}
              >
                <item.icon className={cn(
                  "h-5 w-5 shrink-0 transition-transform group-hover:scale-110",
                  active ? "text-white" : "text-slate-300 group-hover:text-white"
                )} />
                <span className="truncate">{item.title}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

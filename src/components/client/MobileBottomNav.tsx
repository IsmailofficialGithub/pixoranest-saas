import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Activity, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClient } from "@/contexts/ClientContext";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Settings, HelpCircle, Bell } from "lucide-react";
import { getServicePath, getServiceIcon, getServiceLabel } from "@/lib/service-routes";

export default function MobileBottomNav() {
  const location = useLocation();
  const { assignedServices, primaryColor } = useClient();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === "/client") return location.pathname === "/client";
    return location.pathname.startsWith(path);
  };

  // Build service items using shared mapping
  const serviceItems = assignedServices
    .map((svc) => {
      const slug = svc.service_slug;
      const Icon = getServiceIcon(slug);
      const label = getServiceLabel(slug) || svc.service_name;
      if (!Icon) return null;
      return { label, icon: Icon, path: getServicePath(slug) };
    })
    .filter(Boolean) as { label: string; icon: React.ElementType; path: string }[];

  const moreItems = [
    ...serviceItems,
    { label: "Settings", icon: Settings, path: "/client/settings" },
    { label: "Notifications", icon: Bell, path: "/client/notifications" },
    { label: "Help & Support", icon: HelpCircle, path: "/client/help" },
  ];

  const mainTabs = [
    { label: "Home", icon: LayoutDashboard, path: "/client" },
    { label: "Leads", icon: Users, path: "/client/leads" },
    { label: "Usage", icon: Activity, path: "/client/usage" },
    { label: "More", icon: Menu, path: "__more__" },
  ];

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-card border-t safe-area-bottom">
        <div className="flex items-center justify-around h-14">
          {mainTabs.map((tab) => {
            if (tab.path === "__more__") {
              const moreActive = ["/client/settings", "/client/notifications", "/client/help"].some(
                (p) => location.pathname.startsWith(p)
              ) || serviceItems.some((s) => location.pathname.startsWith(s.path));
              return (
                <button
                  key="more"
                  onClick={() => setMoreOpen(true)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[10px] font-medium transition-colors",
                    moreActive ? "text-foreground" : "text-muted-foreground"
                  )}
                  style={moreActive ? { color: primaryColor } : undefined}
                >
                  <tab.icon className="h-5 w-5" />
                  <span>{tab.label}</span>
                </button>
              );
            }

            const active = isActive(tab.path);
            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                end={tab.path === "/client"}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[10px] font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
                style={active ? { color: primaryColor } : undefined}
              >
                <tab.icon className="h-5 w-5" />
                <span>{tab.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* More sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-3 py-4">
            {moreItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-lg transition-colors min-h-[72px] justify-center",
                    active ? "bg-primary/10" : "hover:bg-muted"
                  )}
                  style={active ? { color: primaryColor } : undefined}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-xs font-medium text-center leading-tight">{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

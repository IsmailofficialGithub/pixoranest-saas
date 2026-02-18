import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useClient } from "@/contexts/ClientContext";
import { useNavigate, useLocation } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import ClientNotificationsDropdown from "./ClientNotificationsDropdown";

export default function ClientHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const { profile, logout } = useAuth();
  const { client, admin, assignedServices, primaryColor } = useClient();
  const navigate = useNavigate();
  const location = useLocation();

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : profile?.email?.slice(0, 2).toUpperCase() ?? "CL";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  // Calculate overall usage percentage
  const totalLimit = assignedServices.reduce((sum, s) => sum + s.usage_limit, 0);
  const totalConsumed = assignedServices.reduce((sum, s) => sum + s.usage_consumed, 0);
  const usagePercent = totalLimit > 0 ? Math.round((totalConsumed / totalLimit) * 100) : 0;

  // Determine page title from route
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === "/client") return "Dashboard";
    if (path.includes("/leads")) return "Leads";
    if (path.includes("/usage")) return "Usage & Billing";
    if (path.includes("/settings")) return "Settings";
    if (path.includes("/voice-telecaller")) return "Voice Telecaller";
    if (path.includes("/voice-receptionist")) return "Voice Receptionist";
    if (path.includes("/voice-agent")) return "Voice Agent";
    if (path.includes("/whatsapp")) return "WhatsApp";
    if (path.includes("/social-media")) return "Social Media";
    return "Dashboard";
  };

  return (
    <header className="fixed top-0 right-0 left-0 md:left-60 z-30 flex h-14 md:h-16 items-center justify-between border-b bg-card px-3 md:px-6 safe-area-top">
      {/* Left: hamburger on mobile */}
      <Button variant="ghost" size="icon" className="md:hidden h-10 w-10" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
      </Button>

      {/* Center: page title */}
      <span className="md:hidden text-sm font-semibold text-foreground truncate max-w-[140px]">
        {getPageTitle()}
      </span>
      <span className="hidden md:block text-sm font-semibold text-foreground">
        {getPageTitle()}
      </span>

      {/* Right */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Usage indicator */}
        {totalLimit > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="hidden md:flex items-center gap-2 h-9">
                <div className="w-20">
                  <Progress value={usagePercent} className="h-2" />
                </div>
                <span className="text-xs text-muted-foreground">{usagePercent}%</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Usage Overview</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {assignedServices.map((svc) => {
                const pct = svc.usage_limit > 0 ? Math.round((svc.usage_consumed / svc.usage_limit) * 100) : 0;
                return (
                  <div key={svc.id} className="px-2 py-1.5">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">{svc.service_name}</span>
                      <span className="text-muted-foreground">{svc.usage_consumed}/{svc.usage_limit}</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/client/usage")}>
                View Full Details
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Notifications */}
        <ClientNotificationsDropdown />

        {/* Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-9 w-9 rounded-full text-white text-sm font-semibold hover:opacity-90"
              style={{ backgroundColor: primaryColor }}
            >
              {initials}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium">{profile?.full_name ?? "Client"}</p>
              <p className="text-xs text-muted-foreground">{client?.company_name}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/client/settings")}>
              My Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/client/usage")}>
              Usage & Billing
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/client/settings")}>
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

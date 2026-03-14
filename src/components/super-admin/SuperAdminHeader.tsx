import { Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import NotificationsDropdown from "./NotificationsDropdown";

interface SuperAdminHeaderProps {
  onMenuClick: () => void;
}

export default function SuperAdminHeader({ onMenuClick }: SuperAdminHeaderProps) {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : profile?.email?.slice(0, 2).toUpperCase() ?? "SA";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="fixed top-0 right-0 left-0 md:left-60 z-30 flex h-16 items-center justify-between border-b border-white/5 bg-sidebar backdrop-blur-xl px-4 md:px-6 shadow-sm shadow-black/20">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="md:hidden text-white" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>
        <div className="md:hidden flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-white/5 border border-white/10 shrink-0">
          <img src="/logo.png" alt="PIXORA" className="h-full w-full object-contain p-0.5" />
        </div>
      </div>
      <div className="hidden md:block" />

      {/* Center: search */}
      <div className="relative w-full max-w-[400px] mx-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search..."
          className="pl-9 bg-white/10 border-0 text-white placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-white/20"
        />
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <NotificationsDropdown />

        {/* Profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 hover:text-white">
              {initials}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium">{profile?.full_name ?? "Super Admin"}</p>
              <p className="text-xs text-muted-foreground">{profile?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/super-admin/settings")}>
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/super-admin/settings")}>
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

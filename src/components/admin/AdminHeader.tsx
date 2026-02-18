import { Menu, Search, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/contexts/AdminContext";
import { useNavigate } from "react-router-dom";
import NotificationsDropdown from "@/components/super-admin/NotificationsDropdown";

interface AdminHeaderProps {
  onMenuClick: () => void;
  onMessagesClick?: () => void;
  unreadMessages?: number;
}

export default function AdminHeader({ onMenuClick, onMessagesClick, unreadMessages = 0 }: AdminHeaderProps) {
  const { profile, logout } = useAuth();
  const { admin, primaryColor } = useAdmin();
  const navigate = useNavigate();

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : profile?.email?.slice(0, 2).toUpperCase() ?? "AD";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="fixed top-0 right-0 left-0 md:left-60 z-30 flex h-14 md:h-16 items-center justify-between border-b bg-card px-3 md:px-6 safe-area-top">
      {/* Left: hamburger on mobile */}
      <Button variant="ghost" size="icon" className="md:hidden h-10 w-10" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
      </Button>

      {/* Center: company name on mobile, search on desktop */}
      <span className="md:hidden text-sm font-semibold text-foreground truncate max-w-[140px]">
        {admin?.company_name || "Admin"}
      </span>
      <div className="hidden md:block relative w-full max-w-[350px] mx-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search clients..."
          className="pl-9 bg-muted/50 border-0 focus-visible:ring-1"
        />
      </div>

      {/* Right */}
      <div className="flex items-center gap-1 md:gap-3">
        <Button variant="ghost" size="icon" className="relative h-10 w-10" onClick={onMessagesClick}>
          <MessageSquare className="h-5 w-5" />
          {unreadMessages > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
              {unreadMessages > 99 ? "99+" : unreadMessages}
            </span>
          )}
        </Button>

        <NotificationsDropdown />

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
              <p className="text-sm font-medium">{profile?.full_name ?? "Admin"}</p>
              <p className="text-xs text-muted-foreground">{admin?.company_name}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/admin/settings")}>
              My Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/admin/white-label")}>
              White-Label Settings
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

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, X, UserPlus, FileText, MessageSquare, BarChart3, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdmin } from "@/contexts/AdminContext";
import { cn } from "@/lib/utils";

interface QuickActionsFABProps {
  onAddClient?: () => void;
  onGenerateInvoice?: () => void;
  onOpenMessages?: () => void;
}

const actions: { id: string; label: string; icon: typeof Settings; route?: string }[] = [
  { id: "settings", label: "Settings", icon: Settings, route: "/admin/settings" },
  { id: "analytics", label: "View Analytics", icon: BarChart3, route: "/admin/analytics" },
  { id: "message", label: "Send Message", icon: MessageSquare },
  { id: "invoice", label: "Generate Invoice", icon: FileText, route: "/admin/billing" },
  { id: "client", label: "Add Client", icon: UserPlus, route: "/admin/clients" },
];

export default function QuickActionsFAB({ onAddClient, onGenerateInvoice, onOpenMessages }: QuickActionsFABProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { primaryColor } = useAdmin();

  function handleAction(id: string, route?: string) {
    setOpen(false);
    if (id === "message" && onOpenMessages) return onOpenMessages();
    if (id === "invoice" && onGenerateInvoice) return onGenerateInvoice();
    if (id === "client" && onAddClient) return onAddClient();
    if (route) navigate(route);
  }

  return (
    <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 flex flex-col-reverse items-end gap-3 safe-area-bottom">
      {/* Main FAB */}
      <Button
        size="icon"
        className="h-14 w-14 rounded-full shadow-lg transition-transform hover:scale-105"
        style={{ backgroundColor: primaryColor }}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close quick actions" : "Open quick actions"}
      >
        {open ? <X className="h-6 w-6 text-white" /> : <Plus className="h-6 w-6 text-white" />}
      </Button>

      {/* Action buttons */}
      {actions.map((action, i) => (
        <div
          key={action.id}
          className={cn(
            "flex items-center gap-2 transition-all duration-200",
            open
              ? "translate-y-0 opacity-100"
              : "translate-y-4 opacity-0 pointer-events-none"
          )}
          style={{ transitionDelay: open ? `${i * 40}ms` : "0ms" }}
        >
          <span className="rounded-md bg-popover px-2 py-1 text-xs font-medium text-popover-foreground shadow-md whitespace-nowrap">
            {action.label}
          </span>
          <Button
            size="icon"
            variant="secondary"
            className="h-11 w-11 rounded-full shadow-md"
            onClick={() => handleAction(action.id, action.route)}
            aria-label={action.label}
          >
            <action.icon className="h-5 w-5" />
          </Button>
        </div>
      ))}

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[-1]"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}

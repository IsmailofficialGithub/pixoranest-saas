import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lock, ArrowRight, Layers, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useClient } from "@/contexts/ClientContext";
import { getServicePath, SERVICE_ROUTE_MAP } from "@/lib/service-routes";

interface ServiceCardProps {
  service: {
    id: string;
    name: string;
    slug: string;
    icon_url: string | null;
    description: string | null;
    category: string;
    is_locked: boolean;
    lock_reason?: string;
  };
  primaryColor?: string;
}

export function ServiceCard({ service, primaryColor }: ServiceCardProps) {
  const navigate = useNavigate();
  const { client } = useClient();
  const [requesting, setRequesting] = useState(false);

  const handleClick = () => {
    if (service.is_locked) return;
    // Only navigate if route exists
    const routeSlug = SERVICE_ROUTE_MAP[service.slug];
    if (!routeSlug) {
      toast.error("This service page is not available yet.");
      return;
    }
    navigate(getServicePath(service.slug));
  };

  const handleRequestAccess = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!client) return;
    setRequesting(true);
    try {
      // Find the admin's user_id
      const { data: admin } = await supabase
        .from("admins")
        .select("user_id")
        .eq("id", client.admin_id)
        .maybeSingle();

      if (!admin) throw new Error("Admin not found");

      await supabase.from("notifications").insert({
        user_id: admin.user_id,
        title: "Service Access Request",
        message: `${client.company_name} requested access to "${service.name}".`,
        type: "info" as const,
        action_url: `/admin/clients/${client.id}`,
      });

      toast.success("Access request sent to your administrator");
    } catch {
      toast.error("Failed to send request");
    } finally {
      setRequesting(false);
    }
  };

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all",
        service.is_locked
          ? "opacity-70 border-dashed"
          : "hover-lift cursor-pointer"
      )}
      onClick={handleClick}
    >
      {/* Lock overlay */}
      {service.is_locked && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
          <div className="rounded-full bg-muted p-3">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      )}

      <CardContent className="pt-6 space-y-3">
        <div className="flex items-start gap-3">
          {service.icon_url ? (
            <img
              src={service.icon_url}
              alt=""
              className="h-10 w-10 rounded-lg object-cover"
            />
          ) : (
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${primaryColor || "hsl(var(--primary))"}15` }}
            >
              <Layers className="h-5 w-5" style={{ color: primaryColor }} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">
              {service.name}
            </p>
            <Badge variant="outline" className="text-[10px] capitalize mt-0.5">
              {service.category}
            </Badge>
          </div>
        </div>

        {service.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {service.description}
          </p>
        )}

        {service.is_locked ? (
          <div className="space-y-2">
            <Badge variant="secondary" className="text-xs">
              <Lock className="mr-1 h-3 w-3" />
              Not Available
            </Badge>
            <p className="text-[11px] text-muted-foreground">
              {service.lock_reason || "This service is not enabled for your account. Contact your administrator."}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs"
              disabled={requesting}
              onClick={handleRequestAccess}
            >
              <Send className="mr-1 h-3 w-3" />
              {requesting ? "Sending..." : "Request Access"}
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            className="w-full text-white"
            style={{ backgroundColor: primaryColor }}
          >
            Open Dashboard
            <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

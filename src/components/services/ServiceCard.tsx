import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lock, ArrowRight, Layers, Send, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useClient } from "@/contexts/ClientContext";
import { getServicePath, SERVICE_ROUTE_MAP } from "@/lib/service-routes";
import { motion } from "framer-motion";

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
    <motion.div
      whileHover={service.is_locked ? {} : { y: -5 }}
      className="group h-full"
    >
      <Card
        className={cn(
          "relative h-full overflow-hidden transition-all duration-300 bg-white border-slate-200/60 shadow-sm",
          service.is_locked
            ? "opacity-80 grayscale-[0.5]"
            : "hover:shadow-md cursor-pointer hover:border-primary/20"
        )}
        onClick={handleClick}
      >
        <div 
          className="absolute -top-12 -right-12 h-24 w-24 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity pointer-events-none" 
          style={{ backgroundColor: primaryColor }}
        />

        <CardContent className="pt-8 space-y-5 flex flex-col h-full">
          <div className="flex items-start gap-4">
            {service.icon_url ? (
              <img
                src={service.icon_url}
                alt=""
                className="h-12 w-12 rounded-2xl object-cover shadow-lg group-hover:scale-110 transition-transform md:h-14 md:w-14"
              />
            ) : (
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 shrink-0 group-hover:scale-110 transition-transform md:h-14 md:w-14"
                style={{ backgroundColor: `${primaryColor || "hsl(var(--primary))"}15` }}
              >
                <Layers className="h-6 w-6 md:h-7 md:w-7" style={{ color: primaryColor || "#304f9f" }} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold text-slate-900 tracking-tight truncate leading-tight group-hover:text-primary transition-colors">
                {service.name}
              </p>
              <Badge variant="outline" className="text-[10px] uppercase tracking-tighter mt-1 bg-primary/5 border-primary/10 text-primary transition-colors">
                {service.category}
              </Badge>
            </div>
          </div>

          <div className="flex-1">
            {service.description ? (
              <p className="text-xs text-slate-500 font-medium leading-relaxed line-clamp-3">
                {service.description}
              </p>
            ) : (
              <p className="text-xs text-slate-400 italic">No description provided for this neural interface.</p>
            )}
          </div>

          <div className="pt-4 border-t border-white/5">
            {service.is_locked ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                  <Lock className="h-3 w-3" />
                  Locked Interface
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs h-10 rounded-xl border-slate-200 hover:bg-black text-slate-600 transition-all active:scale-95"
                  disabled={requesting}
                  onClick={handleRequestAccess}
                >
                  <Send className="mr-2 h-3.5 w-3.5 text-primary" />
                  {requesting ? "Transmitting..." : "Initialize Access Request"}
                </Button>
              </div>
            ) : (
              <Button
                size="lg"
                className="w-full text-white font-bold h-11 rounded-xl shadow-lg shadow-primary/10 group-hover:shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ backgroundColor: primaryColor || "#304f9f" }}
              >
                Connect to Console
                <ArrowRight className="ml-2 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Button>
            )}
          </div>
        </CardContent>
        
        {!service.is_locked && (
          <div className="absolute top-4 right-4 text-primary opacity-0 group-hover:opacity-30 transition-opacity duration-700 animate-pulse-slow">
            <Sparkles className="h-4 w-4" />
          </div>
        )}
      </Card>
    </motion.div>
  );
}

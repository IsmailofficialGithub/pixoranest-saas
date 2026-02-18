import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Layers, Lock, Unlock, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { Tables } from "@/integrations/supabase/types";

type Service = Tables<"services">;

interface Props {
  adminId: string;
  adminName?: string;
}

export default function AdminServiceAssignment({ adminId, adminName }: Props) {
  const [open, setOpen] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [assignments, setAssignments] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [servicesRes, assignRes] = await Promise.all([
      supabase.from("services").select("*").eq("is_active", true).order("name"),
      supabase
        .from("admin_service_assignments")
        .select("service_id, is_enabled")
        .eq("admin_id", adminId),
    ]);

    setServices(servicesRes.data ?? []);
    const map: Record<string, boolean> = {};
    (assignRes.data ?? []).forEach((a) => {
      map[a.service_id] = a.is_enabled ?? false;
    });
    setAssignments(map);
    setLoading(false);
  }, [adminId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const toggle = async (serviceId: string, enabled: boolean) => {
    setToggling(serviceId);
    const { error } = await supabase
      .from("admin_service_assignments")
      .upsert(
        {
          admin_id: adminId,
          service_id: serviceId,
          is_enabled: enabled,
          assigned_at: new Date().toISOString(),
        },
        { onConflict: "admin_id,service_id" }
      );

    if (error) {
      toast.error("Failed to update assignment");
    } else {
      toast.success(`Service ${enabled ? "enabled" : "disabled"}`);
      setAssignments((prev) => ({ ...prev, [serviceId]: enabled }));
    }
    setToggling(null);
  };

  const unassign = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    const { error } = await supabase
      .from("admin_service_assignments")
      .delete()
      .eq("admin_id", adminId)
      .eq("service_id", removeTarget.id);

    if (error) {
      toast.error("Failed to unassign service");
    } else {
      toast.success(`${removeTarget.name} unassigned`);
      setAssignments((prev) => {
        const next = { ...prev };
        delete next[removeTarget.id];
        return next;
      });
    }
    setRemoving(false);
    setRemoveTarget(null);
  };

  const enabledCount = Object.values(assignments).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Layers className="mr-2 h-4 w-4" />
          Services
          {enabledCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {enabledCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Assign Services{adminName ? ` — ${adminName}` : ""}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 py-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : services.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No active services found.
          </p>
        ) : (
          <div className="max-h-[60vh] space-y-3 overflow-y-auto py-2 pr-1">
            {services.map((service) => {
              const enabled = assignments[service.id] ?? false;
              return (
                <div
                  key={service.id}
                  className="flex items-center justify-between rounded-lg border p-3 hover-lift"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {service.icon_url ? (
                      <img
                        src={service.icon_url}
                        alt=""
                        className="h-8 w-8 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                        <Layers className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {service.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {service.category} · ₹{service.base_price}/{service.base_pricing_model.replace("per_", "")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {assignments[service.id] !== undefined && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setRemoveTarget({ id: service.id, name: service.name })}
                        title="Unassign service"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Badge
                      variant={enabled ? "default" : "outline"}
                      className="text-xs"
                    >
                      {enabled ? (
                        <>
                          <Unlock className="mr-1 h-3 w-3" />
                          Enabled
                        </>
                      ) : (
                        <>
                          <Lock className="mr-1 h-3 w-3" />
                          Disabled
                        </>
                      )}
                    </Badge>
                    <Switch
                      checked={enabled}
                      disabled={toggling === service.id}
                      onCheckedChange={(checked) => toggle(service.id, checked)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(v) => { if (!v) setRemoveTarget(null); }}
        title="Unassign Service"
        description={`Are you sure you want to unassign "${removeTarget?.name}" from ${adminName || "this admin"}? This will remove their access to this service.`}
        confirmLabel="Unassign"
        variant="destructive"
        onConfirm={unassign}
        loading={removing}
      />
    </Dialog>
  );
}

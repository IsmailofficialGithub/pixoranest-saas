import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, Layers, CreditCard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ServiceFormModal from "@/components/super-admin/ServiceFormModal";
import ServicePlansDialog from "@/components/super-admin/ServicePlansDialog";
import type { Tables } from "@/integrations/supabase/types";

interface ServiceRow {
  id: string;
  name: string;
  description: string | null;
  category: "voice" | "messaging" | "social_media";
  base_price: number;
  base_pricing_model: string;
  is_active: boolean;
  icon_url: string | null;
  slug: string;
  created_at: string;
  client_count: number;
}

const categoryConfig: Record<string, { label: string; className: string }> = {
  voice: { label: "Voice", className: "bg-blue-100 text-blue-700 hover:bg-blue-100" },
  messaging: { label: "Messaging", className: "bg-green-100 text-green-700 hover:bg-green-100" },
  social_media: { label: "Social Media", className: "bg-purple-100 text-purple-700 hover:bg-purple-100" },
};

function formatPricingModel(model: string) {
  return model.replace("per_", "per ").replace("_", " ");
}

export default function ServicesPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ServiceRow | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Tables<"services"> | null>(null);
  const [plansTarget, setPlansTarget] = useState<ServiceRow | null>(null);

  const fetchServices = useCallback(async () => {
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Enrich with client counts
    const enriched: ServiceRow[] = await Promise.all(
      (data ?? []).map(async (s) => {
        const { count } = await supabase
          .from("client_services")
          .select("id", { count: "exact", head: true })
          .eq("service_id", s.id);
        return { ...s, client_count: count ?? 0 };
      })
    );

    setServices(enriched);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const handleToggle = async (service: ServiceRow) => {
    setTogglingId(service.id);
    const newState = !service.is_active;
    const { error } = await supabase
      .from("services")
      .update({ is_active: newState })
      .eq("id", service.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Service ${newState ? "activated" : "deactivated"} successfully` });
      setServices((prev) =>
        prev.map((s) => (s.id === service.id ? { ...s, is_active: newState } : s))
      );
    }
    setTogglingId(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from("services")
      .update({ is_active: false })
      .eq("id", deleteTarget.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Service deactivated successfully" });
      setServices((prev) =>
        prev.map((s) => (s.id === deleteTarget.id ? { ...s, is_active: false } : s))
      );
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Services Management</h1>
          <p className="text-muted-foreground">Manage your service catalog and pricing</p>
        </div>
        <Button onClick={() => { setEditTarget(null); setModalOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add New Service
        </Button>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-4 p-6">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : services.length === 0 ? (
        /* Empty state */
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Layers className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">No services yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Get started by adding your first service.</p>
            <Button className="mt-4" onClick={() => { setEditTarget(null); setModalOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Add your first service
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Services grid */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => {
            const cat = categoryConfig[service.category] ?? categoryConfig.voice;
            return (
              <Card key={service.id} className="flex flex-col">
                <CardContent className="flex flex-1 flex-col gap-3 p-6">
                  {/* Icon + toggle row */}
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      {service.icon_url ? (
                        <img src={service.icon_url} alt="" className="h-6 w-6 rounded" />
                      ) : (
                        <Layers className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <Switch
                      checked={service.is_active}
                      disabled={togglingId === service.id}
                      onCheckedChange={() => handleToggle(service)}
                    />
                  </div>

                  {/* Name */}
                  <h3 className="text-lg font-semibold text-foreground">{service.name}</h3>

                  {/* Description */}
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {service.description || "No description"}
                  </p>

                  {/* Category badge */}
                  <div>
                    <Badge variant="secondary" className={cat.className}>
                      {cat.label}
                    </Badge>
                  </div>

                  {/* Pricing */}
                  <p className="text-sm font-medium text-foreground">
                    ₹{Number(service.base_price).toFixed(2)}{" "}
                    <span className="font-normal text-muted-foreground">
                      {formatPricingModel(service.base_pricing_model)}
                    </span>
                  </p>

                  {/* Client count */}
                  <p className="text-xs text-muted-foreground">
                    {service.client_count} client{service.client_count !== 1 ? "s" : ""} using
                  </p>

                  {/* Actions */}
                  <div className="mt-auto flex gap-2 border-t pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setPlansTarget(service)}
                    >
                      <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                      Plans
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        const fullService = services.find((s) => s.id === service.id);
                        if (fullService) {
                          setEditTarget(fullService as unknown as Tables<"services">);
                          setModalOpen(true);
                        }
                      }}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDeleteTarget(service)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the service. Existing client assignments will remain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add/Edit Modal */}
      <ServiceFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(null); }}
        onSaved={() => { setLoading(true); fetchServices(); }}
        editService={editTarget}
      />

      {/* Plans Dialog */}
      {plansTarget && (
        <ServicePlansDialog
          open={!!plansTarget}
          onOpenChange={(v) => { if (!v) setPlansTarget(null); }}
          serviceId={plansTarget.id}
          serviceName={plansTarget.name}
          pricingModel={plansTarget.base_pricing_model}
        />
      )}
    </div>
  );
}

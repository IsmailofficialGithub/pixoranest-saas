import { useState } from "react";
import { useClient } from "@/contexts/ClientContext";
import { useServiceCatalog, type CatalogService } from "@/hooks/useServiceCatalog";
import { CatalogServiceCard } from "@/components/services/CatalogServiceCard";
import { ServiceDetailsModal } from "@/components/services/ServiceDetailsModal";
import { RequestAccessDialog } from "@/components/services/RequestAccessDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, CheckCircle, Lock, Clock } from "lucide-react";

export default function ServiceCatalogPage() {
  const { primaryColor } = useClient();
  const { services, loading, refetch } = useServiceCatalog();

  const [detailService, setDetailService] = useState<CatalogService | null>(null);
  const [requestService, setRequestService] = useState<CatalogService | null>(null);
  const [preselectedPlanId, setPreselectedPlanId] = useState<string | undefined>();
  const [filter, setFilter] = useState<"all" | "active" | "locked" | "pending">("all");

  const filtered = services.filter((s) => {
    if (filter === "active") return s.is_unlocked;
    if (filter === "locked") return s.is_locked && s.request_status !== "pending";
    if (filter === "pending") return s.request_status === "pending";
    return true;
  });

  const activeCount = services.filter((s) => s.is_unlocked).length;
  const lockedCount = services.filter((s) => s.is_locked && s.request_status !== "pending").length;
  const pendingCount = services.filter((s) => s.request_status === "pending").length;

  const handleRequestFromModal = (svc: CatalogService, planId?: string) => {
    setDetailService(null);
    setPreselectedPlanId(planId);
    setRequestService(svc);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-72" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
            <Package className="h-6 w-6" style={{ color: primaryColor }} />
            Service Catalog
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Explore all available AI services and manage your subscriptions
          </p>
        </div>
        <div className="flex gap-2">
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
            <CheckCircle className="mr-1 h-3 w-3" />
            {activeCount} Active
          </Badge>
          <Badge variant="secondary">
            <Lock className="mr-1 h-3 w-3" />
            {lockedCount} Locked
          </Badge>
          {pendingCount > 0 && (
            <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">
              <Clock className="mr-1 h-3 w-3" />
              {pendingCount} Pending
            </Badge>
          )}
        </div>
      </div>

      {/* Filters */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList>
          <TabsTrigger value="all">All ({services.length})</TabsTrigger>
          <TabsTrigger value="active">Active ({activeCount})</TabsTrigger>
          <TabsTrigger value="locked">Locked ({lockedCount})</TabsTrigger>
          {pendingCount > 0 && (
            <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
          )}
        </TabsList>
      </Tabs>

      {/* Service Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm font-medium text-foreground">No services found</p>
          <p className="text-xs text-muted-foreground mt-1">
            {filter !== "all" ? "Try changing the filter above." : "No services are available yet."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {/* Show unlocked first, then pending, then locked */}
          {filtered
            .sort((a, b) => {
              const order = (s: CatalogService) =>
                s.is_unlocked ? 0 : s.request_status === "pending" ? 1 : 2;
              return order(a) - order(b);
            })
            .map((s) => (
              <CatalogServiceCard
                key={s.id}
                service={s}
                primaryColor={primaryColor}
                onViewDetails={setDetailService}
                onRequestAccess={(svc) => {
                  setPreselectedPlanId(undefined);
                  setRequestService(svc);
                }}
              />
            ))}
        </div>
      )}

      {/* Modals */}
      <ServiceDetailsModal
        service={detailService}
        open={!!detailService}
        onClose={() => setDetailService(null)}
        onRequestAccess={handleRequestFromModal}
        primaryColor={primaryColor}
      />

      <RequestAccessDialog
        service={requestService}
        preselectedPlanId={preselectedPlanId}
        open={!!requestService}
        onClose={() => {
          setRequestService(null);
          setPreselectedPlanId(undefined);
        }}
        onSuccess={refetch}
        primaryColor={primaryColor}
      />
    </div>
  );
}

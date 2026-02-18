import { useEffect, useState, useCallback } from "react";
import {
  Play, Pause, Copy, Check, AlertTriangle, Loader2, Zap, RefreshCw, Plus,
} from "lucide-react";
import ConfigureCredentialsDialog from "@/components/super-admin/ConfigureCredentialsDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface ManageWorkflowsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientCompanyName: string;
}

interface AssignedService {
  id: string;
  service_id: string;
  service_name: string;
  service_slug: string;
  category: string;
}

interface WorkflowInstance {
  id: string;
  service_id: string;
  workflow_name: string;
  n8n_workflow_id: string;
  status: string | null;
  is_active: boolean | null;
  webhook_url: string | null;
  test_webhook_url: string | null;
  last_executed_at: string | null;
  execution_count: number | null;
  error_message: string | null;
  service_name: string;
  template_name: string | null;
  required_credentials: string[] | null;
}

type WorkflowStatus = "not_created" | "pending" | "configured" | "active" | "error";

const statusConfig: Record<WorkflowStatus, { label: string; variant: "secondary" | "default" | "destructive" | "outline"; className: string }> = {
  not_created: { label: "Not Created", variant: "secondary", className: "" },
  pending: { label: "Pending", variant: "outline", className: "border-yellow-300 bg-yellow-50 text-yellow-700" },
  configured: { label: "Configured", variant: "outline", className: "border-blue-300 bg-blue-50 text-blue-700" },
  active: { label: "Active", variant: "default", className: "bg-green-100 text-green-700 hover:bg-green-100" },
  error: { label: "Error", variant: "destructive", className: "" },
};

export default function ManageWorkflowsDialog({
  open, onOpenChange, clientId, clientCompanyName,
}: ManageWorkflowsDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<AssignedService[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowInstance[]>([]);
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const [activateTarget, setActivateTarget] = useState<WorkflowInstance | null>(null);
  const [activating, setActivating] = useState(false);
  const [bulkCreating, setBulkCreating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [credentialsTarget, setCredentialsTarget] = useState<WorkflowInstance | null>(null);

  const fetchData = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);

    const [servicesRes, workflowsRes] = await Promise.all([
      supabase
        .from("client_services")
        .select("id, service_id, services(name, slug, category)")
        .eq("client_id", clientId)
        .eq("is_active", true),
      supabase
        .from("client_workflow_instances")
        .select("*, services(name), workflow_templates(template_name, required_credentials)")
        .eq("client_id", clientId),
    ]);

    const svcList: AssignedService[] = (servicesRes.data ?? []).map((cs: any) => ({
      id: cs.id,
      service_id: cs.service_id,
      service_name: cs.services?.name ?? "Unknown",
      service_slug: cs.services?.slug ?? "",
      category: cs.services?.category ?? "",
    }));

    const wfList: WorkflowInstance[] = (workflowsRes.data ?? []).map((w: any) => ({
      id: w.id,
      service_id: w.service_id,
      workflow_name: w.workflow_name,
      n8n_workflow_id: w.n8n_workflow_id,
      status: w.status,
      is_active: w.is_active,
      webhook_url: w.webhook_url,
      test_webhook_url: w.test_webhook_url,
      last_executed_at: w.last_executed_at,
      execution_count: w.execution_count,
      error_message: w.error_message,
      service_name: w.services?.name ?? "Unknown",
      template_name: w.workflow_templates?.template_name ?? null,
      required_credentials: w.workflow_templates?.required_credentials ?? null,
    }));

    setServices(svcList);
    setWorkflows(wfList);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    if (open) fetchData();
  }, [open, fetchData]);

  const getWorkflowForService = (serviceId: string) =>
    workflows.find((w) => w.service_id === serviceId);

  const getStatus = (serviceId: string): WorkflowStatus => {
    const wf = getWorkflowForService(serviceId);
    if (!wf) return "not_created";
    if (wf.status === "error") return "error";
    if (wf.status === "active" && wf.is_active) return "active";
    if (wf.status === "configured") return "configured";
    return "pending";
  };

  const createWorkflow = async (serviceId: string) => {
    setCreatingFor(serviceId);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const res = await fetch(
      `https://ukxoyojiztuvaqgslegw.supabase.co/functions/v1/clone-workflow-for-client`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVreG95b2ppenR1dmFxZ3NsZWd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NTU4NzgsImV4cCI6MjA4NjUzMTg3OH0.yq_ZJzxkZvL3VdB2GrhkWVkw3DrVZdHelDErQIkKgY4",
        },
        body: JSON.stringify({ client_id: clientId, service_id: serviceId }),
      }
    );

    const result = await res.json();
    if (!res.ok) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    } else {
      toast({ title: "Workflow created successfully" });
      await fetchData();
    }
    setCreatingFor(null);
  };

  const handleActivate = async () => {
    if (!activateTarget) return;
    setActivating(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const res = await fetch(
      `https://ukxoyojiztuvaqgslegw.supabase.co/functions/v1/activate-client-workflow`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVreG95b2ppenR1dmFxZ3NsZWd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NTU4NzgsImV4cCI6MjA4NjUzMTg3OH0.yq_ZJzxkZvL3VdB2GrhkWVkw3DrVZdHelDErQIkKgY4",
        },
        body: JSON.stringify({ workflow_instance_id: activateTarget.id, activate: true }),
      }
    );

    const result = await res.json();
    if (!res.ok) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    } else {
      toast({ title: "Workflow activated" });
      await fetchData();
    }
    setActivating(false);
    setActivateTarget(null);
  };

  const handleDeactivate = async (wf: WorkflowInstance) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const res = await fetch(
      `https://ukxoyojiztuvaqgslegw.supabase.co/functions/v1/activate-client-workflow`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVreG95b2ppenR1dmFxZ3NsZWd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NTU4NzgsImV4cCI6MjA4NjUzMTg3OH0.yq_ZJzxkZvL3VdB2GrhkWVkw3DrVZdHelDErQIkKgY4",
        },
        body: JSON.stringify({ workflow_instance_id: wf.id, activate: false }),
      }
    );

    if (res.ok) {
      toast({ title: "Workflow deactivated" });
      await fetchData();
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const missingServices = services.filter((s) => !getWorkflowForService(s.service_id));

  const handleBulkCreate = async () => {
    setBulkCreating(true);
    setBulkProgress({ current: 0, total: missingServices.length });

    for (let i = 0; i < missingServices.length; i++) {
      setBulkProgress({ current: i + 1, total: missingServices.length });
      await createWorkflow(missingServices[i].service_id);
    }

    setBulkCreating(false);
  };

  const categoryLabel = (cat: string) => {
    const map: Record<string, string> = { voice: "Voice", messaging: "Messaging", social_media: "Social Media" };
    return map[cat] ?? cat;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Workflows — {clientCompanyName}</DialogTitle>
            <DialogDescription>
              View and manage workflow instances for this client's assigned services.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="space-y-3 py-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : services.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <Zap className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                No active services assigned to this client.
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {/* Bulk action */}
              {missingServices.length > 0 && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleBulkCreate}
                  disabled={bulkCreating}
                >
                  {bulkCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating {bulkProgress.current} of {bulkProgress.total} workflows...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Create All Missing Workflows ({missingServices.length})
                    </>
                  )}
                </Button>
              )}

              {/* Service cards */}
              {services.map((svc) => {
                const status = getStatus(svc.service_id);
                const wf = getWorkflowForService(svc.service_id);
                const cfg = statusConfig[status];

                return (
                  <Card key={svc.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">{svc.service_name}</CardTitle>
                          <Badge variant="outline" className="text-xs">
                            {categoryLabel(svc.category)}
                          </Badge>
                        </div>
                        <Badge variant={cfg.variant} className={cfg.className}>
                          {cfg.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {/* Not Created */}
                      {status === "not_created" && (
                        <Button
                          size="sm"
                          onClick={() => createWorkflow(svc.service_id)}
                          disabled={creatingFor === svc.service_id}
                        >
                          {creatingFor === svc.service_id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="mr-2 h-4 w-4" />
                          )}
                          Create Workflow
                        </Button>
                      )}

                      {/* Pending */}
                      {status === "pending" && wf && (
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => setCredentialsTarget(wf)}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Configure Credentials
                          </Button>
                        </div>
                      )}

                      {/* Configured */}
                      {status === "configured" && wf && (
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => setCredentialsTarget(wf)}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Configure Credentials
                          </Button>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => setActivateTarget(wf)}
                          >
                            <Play className="mr-2 h-4 w-4" />
                            Activate Workflow
                          </Button>
                        </div>
                      )}

                      {/* Active */}
                      {status === "active" && wf && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-muted-foreground">Last executed:</span>{" "}
                              <span className="font-medium">
                                {wf.last_executed_at
                                  ? format(new Date(wf.last_executed_at), "MMM d, yyyy HH:mm")
                                  : "Never"}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Executions:</span>{" "}
                              <span className="font-medium">{wf.execution_count ?? 0}</span>
                            </div>
                          </div>
                          {wf.webhook_url && (
                            <div className="flex items-center gap-2">
                              <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">
                                {wf.webhook_url}
                              </code>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => copyUrl(wf.webhook_url!)}
                              >
                                {copiedUrl === wf.webhook_url ? (
                                  <Check className="h-3 w-3" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleDeactivate(wf)}>
                              <Pause className="mr-2 h-4 w-4" />
                              Deactivate
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setCredentialsTarget(wf)}>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Reconfigure
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Error */}
                      {status === "error" && wf && (
                        <div className="space-y-2">
                          <div className="flex items-start gap-2 text-sm text-destructive">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{wf.error_message ?? "An error occurred with this workflow."}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => setCredentialsTarget(wf)}>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Fix Configuration
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activate confirmation */}
      <AlertDialog open={!!activateTarget} onOpenChange={() => setActivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate workflow for {activateTarget?.service_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will start the workflow and it will begin processing requests.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleActivate} disabled={activating}>
              {activating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Configure Credentials Dialog */}
      <ConfigureCredentialsDialog
        open={!!credentialsTarget}
        onOpenChange={(open) => { if (!open) setCredentialsTarget(null); }}
        workflowInstanceId={credentialsTarget?.id ?? ""}
        serviceName={credentialsTarget?.service_name ?? ""}
        onSuccess={fetchData}
      />
    </>
  );
}

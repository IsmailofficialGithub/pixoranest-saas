import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Play,
  Pause,
  RefreshCw,
  Workflow,
  Activity,
  Settings,
  Eye,
  Download,
  Plus,
  Pencil,
  Power,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import TemplateFormModal from "@/components/super-admin/TemplateFormModal";
import TemplateDetailDialog from "@/components/super-admin/TemplateDetailDialog";

type WorkflowTemplate = Tables<"workflow_templates">;
type WorkflowInstance = Tables<"client_workflow_instances">;
type WorkflowExecution = Tables<"workflow_executions">;

const statusColor: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  configured: "secondary",
  pending: "outline",
  error: "destructive",
  suspended: "destructive",
};

const execStatusColor: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  success: "default",
  running: "secondary",
  waiting: "outline",
  error: "destructive",
  cancelled: "destructive",
};

export default function N8nControllerPage() {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [instances, setInstances] = useState<(WorkflowInstance & { client_name?: string; service_name?: string })[]>([]);
  const [executions, setExecutions] = useState<(WorkflowExecution & { workflow_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [n8nUrl, setN8nUrl] = useState("");
  const [n8nApiKey, setN8nApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [serviceMap, setServiceMap] = useState<Record<string, string>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkflowTemplate | null>(null);
  const [detailTemplate, setDetailTemplate] = useState<WorkflowTemplate | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [templatesRes, instancesRes, executionsRes] = await Promise.all([
        supabase
          .from("workflow_templates")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("client_workflow_instances")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("workflow_executions")
          .select("*")
          .order("executed_at", { ascending: false })
          .limit(100),
      ]);

      const rawTemplates = templatesRes.data ?? [];
      setTemplates(rawTemplates);

      // Build service map for template display
      if (rawTemplates.length > 0) {
        const tplServiceIds = [...new Set(rawTemplates.map((t) => t.service_id))];
        const { data: svcData } = await supabase
          .from("services")
          .select("id, name")
          .in("id", tplServiceIds);
        const sMap = Object.fromEntries((svcData ?? []).map((s) => [s.id, s.name]));
        setServiceMap((prev) => ({ ...prev, ...sMap }));
      }

      // Enrich instances with client + service names
      const rawInstances = instancesRes.data ?? [];
      if (rawInstances.length > 0) {
        const clientIds = [...new Set(rawInstances.map((i) => i.client_id))];
        const serviceIds = [...new Set(rawInstances.map((i) => i.service_id))];
        const [clientsRes, servicesRes] = await Promise.all([
          supabase.from("clients").select("id, company_name").in("id", clientIds),
          supabase.from("services").select("id, name").in("id", serviceIds),
        ]);
        const clientMap = Object.fromEntries((clientsRes.data ?? []).map((c) => [c.id, c.company_name]));
        const serviceMap = Object.fromEntries((servicesRes.data ?? []).map((s) => [s.id, s.name]));
        setInstances(
          rawInstances.map((inst) => ({
            ...inst,
            client_name: clientMap[inst.client_id] ?? "Unknown",
            service_name: serviceMap[inst.service_id] ?? "Unknown",
          }))
        );
      } else {
        setInstances([]);
      }

      // Enrich executions with workflow name
      const rawExec = executionsRes.data ?? [];
      if (rawExec.length > 0) {
        const wfIds = [...new Set(rawExec.map((e) => e.workflow_instance_id))];
        const { data: wfData } = await supabase
          .from("client_workflow_instances")
          .select("id, workflow_name")
          .in("id", wfIds);
        const wfMap = Object.fromEntries((wfData ?? []).map((w) => [w.id, w.workflow_name]));
        setExecutions(
          rawExec.map((ex) => ({
            ...ex,
            workflow_name: wfMap[ex.workflow_instance_id] ?? "Unknown",
          }))
        );
      } else {
        setExecutions([]);
      }
    } catch {
      toast.error("Failed to load workflow data");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "n8n_base_url")
      .maybeSingle();
    if (data?.value) setN8nUrl(data.value);

    const { data: keyData } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "n8n_api_key")
      .maybeSingle();
    if (keyData?.value) setN8nApiKey(keyData.value);
  }, []);

  useEffect(() => {
    loadData();
    loadSettings();
  }, [loadData, loadSettings]);

  const saveSettings = async () => {
    setSaving(true);
    const { error: e1 } = await supabase
      .from("platform_settings")
      .upsert({ key: "n8n_base_url", value: n8nUrl, updated_at: new Date().toISOString() }, { onConflict: "key" });
    const { error: e2 } = await supabase
      .from("platform_settings")
      .upsert({ key: "n8n_api_key", value: n8nApiKey, updated_at: new Date().toISOString() }, { onConflict: "key" });
    setSaving(false);
    if (e1 || e2) {
      toast.error("Failed to save settings");
    } else {
      toast.success("N8N settings saved");
    }
  };

  const toggleInstance = async (inst: WorkflowInstance) => {
    const newActive = !inst.is_active;
    const { error } = await supabase
      .from("client_workflow_instances")
      .update({ is_active: newActive, status: newActive ? "active" : "suspended" })
      .eq("id", inst.id);
    if (error) {
      toast.error("Failed to toggle workflow");
    } else {
      toast.success(`Workflow ${newActive ? "activated" : "suspended"}`);
      loadData();
    }
  };

  const toggleTemplateActive = async (t: WorkflowTemplate) => {
    const newActive = !t.is_active;
    const { error } = await supabase
      .from("workflow_templates")
      .update({ is_active: newActive } as any)
      .eq("id", t.id);
    if (error) {
      toast.error("Failed to toggle template");
    } else {
      toast.success(`Template ${newActive ? "activated" : "deactivated"}`);
      loadData();
    }
  };

  const exportTemplate = (t: WorkflowTemplate) => {
    const blob = new Blob([JSON.stringify(t, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `template-${t.template_name}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Template exported");
  };

  const activeCount = instances.filter((i) => i.is_active).length;
  const errorCount = instances.filter((i) => i.status === "error").length;
  const totalExecToday = executions.filter(
    (e) => e.executed_at && new Date(e.executed_at).toDateString() === new Date().toDateString()
  ).length;

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Workflow className="h-6 w-6 text-primary" />
            N8N Controller
          </h1>
          <p className="text-muted-foreground">Manage automation workflows and integrations</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Templates</p>
            <p className="text-2xl font-bold">{loading ? <Skeleton className="h-7 w-10" /> : templates.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Active Instances</p>
            <p className="text-2xl font-bold">{loading ? <Skeleton className="h-7 w-10" /> : activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Errors</p>
            <p className="text-2xl font-bold text-destructive">{loading ? <Skeleton className="h-7 w-10" /> : errorCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Executions Today</p>
            <p className="text-2xl font-bold">{loading ? <Skeleton className="h-7 w-10" /> : totalExecToday}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">
            <Workflow className="mr-1.5 h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="instances">
            <Activity className="mr-1.5 h-4 w-4" />
            Client Instances
          </TabsTrigger>
          <TabsTrigger value="executions">
            <Eye className="mr-1.5 h-4 w-4" />
            Execution Logs
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="mr-1.5 h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Templates Tab */}
        <TabsContent value="templates">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Workflow Templates</CardTitle>
              <Button
                size="sm"
                onClick={() => {
                  setEditingTemplate(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Add Template
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-3 p-6">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : templates.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No workflow templates found. Click "Add Template" to create one.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Master Prompt</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {templates.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">{t.template_name}</TableCell>
                          <TableCell className="text-sm">{serviceMap[t.service_id] ?? "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                            {(t as any).master_prompt
                              ? ((t as any).master_prompt as string).slice(0, 60) + ((t as any).master_prompt.length > 60 ? "…" : "")
                              : "—"}
                          </TableCell>
                          <TableCell>{t.version ?? "1.0"}</TableCell>
                          <TableCell>
                            <Badge variant={t.is_active ? "default" : "secondary"}>
                              {t.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setDetailTemplate(t);
                                  setDetailOpen(true);
                                }}
                                title="View Details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingTemplate(t);
                                  setFormOpen(true);
                                }}
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleTemplateActive(t)}
                                title={t.is_active ? "Deactivate" : "Activate"}
                              >
                                <Power className={`h-4 w-4 ${t.is_active ? "text-destructive" : "text-primary"}`} />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => exportTemplate(t)} title="Export">
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Client Instances Tab */}
        <TabsContent value="instances">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Client Workflow Instances</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-3 p-6">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : instances.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No workflow instances found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Workflow</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Executions</TableHead>
                        <TableHead>Last Run</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {instances.map((inst) => (
                        <TableRow key={inst.id}>
                          <TableCell className="font-medium">{inst.workflow_name}</TableCell>
                          <TableCell className="text-sm">{inst.client_name}</TableCell>
                          <TableCell className="text-sm">{inst.service_name}</TableCell>
                          <TableCell>
                            <Badge variant={statusColor[inst.status ?? "pending"] ?? "outline"}>
                              {inst.status ?? "pending"}
                            </Badge>
                          </TableCell>
                          <TableCell>{inst.execution_count ?? 0}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {inst.last_executed_at
                              ? new Date(inst.last_executed_at).toLocaleString()
                              : "Never"}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleInstance(inst)}
                              title={inst.is_active ? "Suspend" : "Activate"}
                            >
                              {inst.is_active ? (
                                <Pause className="h-4 w-4 text-warning" />
                              ) : (
                                <Play className="h-4 w-4 text-primary" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Execution Logs Tab */}
        <TabsContent value="executions">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Executions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-3 p-6">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : executions.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No execution logs found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Workflow</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Executed At</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {executions.map((ex) => (
                        <TableRow key={ex.id}>
                          <TableCell className="font-medium">{ex.workflow_name}</TableCell>
                          <TableCell>
                            <Badge variant={execStatusColor[ex.status ?? "waiting"] ?? "outline"}>
                              {ex.status ?? "unknown"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{ex.execution_mode ?? "—"}</TableCell>
                          <TableCell className="text-sm">
                            {ex.duration_ms != null ? `${(ex.duration_ms / 1000).toFixed(1)}s` : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {ex.executed_at ? new Date(ex.executed_at).toLocaleString() : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-destructive max-w-xs truncate">
                            {ex.error_message ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">N8N Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-lg">
              <div className="space-y-2">
                <Label htmlFor="n8n-url">N8N Instance URL</Label>
                <Input
                  id="n8n-url"
                  placeholder="https://your-n8n-instance.com"
                  value={n8nUrl}
                  onChange={(e) => setN8nUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="n8n-key">API Key</Label>
                <Input
                  id="n8n-key"
                  type="password"
                  placeholder="Enter n8n API key"
                  value={n8nApiKey}
                  onChange={(e) => setN8nApiKey(e.target.value)}
                />
              </div>
              <Button onClick={saveSettings} disabled={saving}>
                {saving ? "Saving..." : "Save Configuration"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <TemplateFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        template={editingTemplate}
        onSaved={loadData}
      />

      <TemplateDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        template={detailTemplate}
        serviceName={detailTemplate ? serviceMap[detailTemplate.service_id] : undefined}
      />
    </div>
  );
}

import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Mail, Phone, Pencil, MoreHorizontal, ShieldOff, ShieldCheck,
  Trash2, Settings, Copy, ExternalLink, Clock, Activity, PhoneCall,
  MessageSquare, DollarSign, Layers,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import ManageWorkflowsDialog from "@/components/super-admin/ManageWorkflowsDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ClientDetail {
  id: string;
  user_id: string;
  company_name: string;
  industry: string | null;
  company_size: string | null;
  admin_id: string;
  admin_company: string;
  is_active: boolean;
  allow_admin_raw_access: boolean;
  created_at: string;
  onboarded_at: string | null;
  full_name: string | null;
  email: string;
  phone: string | null;
}

interface AssignedService {
  id: string;
  service_id: string;
  service_name: string;
  slug: string;
  category: string;
  plan_name: string | null;
  usage_consumed: number;
  usage_limit: number;
  reset_period: string | null;
  last_reset_at: string | null;
  is_active: boolean;
  base_pricing_model: string;
}

interface WorkflowInstance {
  id: string;
  workflow_name: string;
  n8n_workflow_id: string;
  status: string | null;
  is_active: boolean;
  webhook_url: string | null;
  last_executed_at: string | null;
  execution_count: number;
  service_name: string;
  category: string;
  error_message: string | null;
}

interface ActivityItem {
  type: string;
  timestamp: string | null;
  service_name: string;
  status: string | null;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  configured: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-700",
  suspended: "bg-gray-100 text-gray-700",
};

export default function ClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [services, setServices] = useState<AssignedService[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowInstance[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [stats, setStats] = useState({ totalCalls: 0, totalMessages: 0, totalCost: 0, activeServices: 0 });
  const [loading, setLoading] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ company_name: "", industry: "", company_size: "", full_name: "", phone: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [workflowDialogOpen, setWorkflowDialogOpen] = useState(false);

  const fetchClient = useCallback(async () => {
    if (!clientId) return;
    const { data: c, error } = await supabase.from("clients").select("*").eq("id", clientId).single();
    if (error || !c) {
      toast({ title: "Error", description: "Client not found", variant: "destructive" });
      navigate("/super-admin/clients");
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("full_name, email, phone").eq("user_id", c.user_id).single();
    const { data: admin } = await supabase.from("admins").select("company_name").eq("id", c.admin_id).single();

    setClient({
      id: c.id,
      user_id: c.user_id,
      company_name: c.company_name,
      industry: c.industry,
      company_size: c.company_size,
      admin_id: c.admin_id,
      admin_company: admin?.company_name ?? "—",
      is_active: c.is_active,
      allow_admin_raw_access: c.allow_admin_raw_access ?? false,
      created_at: c.created_at,
      onboarded_at: c.onboarded_at,
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? "",
      phone: profile?.phone ?? null,
    });
  }, [clientId, navigate, toast]);

  const fetchServices = useCallback(async () => {
    if (!clientId) return;
    const { data } = await supabase
      .from("client_services")
      .select("*, services(name, slug, category, base_pricing_model), service_plans(plan_name)")
      .eq("client_id", clientId)
      .order("assigned_at", { ascending: false });

    setServices(
      (data ?? []).map((d: any) => ({
        id: d.id,
        service_id: d.service_id,
        service_name: d.services?.name ?? "Unknown",
        slug: d.services?.slug ?? "",
        category: d.services?.category ?? "",
        plan_name: d.service_plans?.plan_name ?? null,
        usage_consumed: d.usage_consumed ?? 0,
        usage_limit: d.usage_limit ?? 0,
        reset_period: d.reset_period,
        last_reset_at: d.last_reset_at,
        is_active: d.is_active ?? false,
        base_pricing_model: d.services?.base_pricing_model ?? "",
      }))
    );
  }, [clientId]);

  const fetchWorkflows = useCallback(async () => {
    if (!clientId) return;
    const { data } = await supabase
      .from("client_workflow_instances")
      .select("*, services(name, category)")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    setWorkflows(
      (data ?? []).map((d: any) => ({
        id: d.id,
        workflow_name: d.workflow_name,
        n8n_workflow_id: d.n8n_workflow_id,
        status: d.status,
        is_active: d.is_active ?? false,
        webhook_url: d.webhook_url,
        last_executed_at: d.last_executed_at,
        execution_count: d.execution_count ?? 0,
        service_name: d.services?.name ?? "Unknown",
        category: d.services?.category ?? "",
        error_message: d.error_message,
      }))
    );
  }, [clientId]);

  const fetchActivities = useCallback(async () => {
    if (!clientId) return;

    const { data: calls } = await supabase
      .from("call_logs")
      .select("executed_at, status, services(name)")
      .eq("client_id", clientId)
      .order("executed_at", { ascending: false })
      .limit(5);

    const { data: campaigns } = await supabase
      .from("voice_campaigns")
      .select("started_at, status")
      .eq("client_id", clientId)
      .order("started_at", { ascending: false })
      .limit(5);

    const items: ActivityItem[] = [
      ...(calls ?? []).map((c: any) => ({
        type: "call" as const,
        timestamp: c.executed_at,
        service_name: c.services?.name ?? "Voice",
        status: c.status,
      })),
      ...(campaigns ?? []).map((c: any) => ({
        type: "campaign" as const,
        timestamp: c.started_at,
        service_name: "Voice Telecaller",
        status: c.status,
      })),
    ];

    items.sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tb - ta;
    });

    setActivities(items.slice(0, 10));
  }, [clientId]);

  const fetchStats = useCallback(async () => {
    if (!clientId) return;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { count: callCount } = await supabase
      .from("call_logs")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .gte("executed_at", thirtyDaysAgo);

    const { count: msgCount } = await supabase
      .from("whatsapp_messages")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .gte("sent_at", thirtyDaysAgo);

    const { data: costData } = await supabase
      .from("usage_tracking")
      .select("total_cost")
      .eq("client_id", clientId)
      .gte("recorded_at", thirtyDaysAgo);

    const totalCost = (costData ?? []).reduce((sum, r) => sum + (Number(r.total_cost) || 0), 0);

    const { count: activeCount } = await supabase
      .from("client_services")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("is_active", true);

    setStats({
      totalCalls: callCount ?? 0,
      totalMessages: msgCount ?? 0,
      totalCost: totalCost,
      activeServices: activeCount ?? 0,
    });
  }, [clientId]);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchClient(), fetchServices(), fetchWorkflows(), fetchActivities(), fetchStats()]);
      setLoading(false);
    };
    loadAll();
  }, [fetchClient, fetchServices, fetchWorkflows, fetchActivities, fetchStats]);

  const handleRawAccessToggle = async (checked: boolean) => {
    if (!client) return;
    const { error } = await supabase.from("clients").update({ allow_admin_raw_access: checked }).eq("id", client.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setClient((prev) => prev ? { ...prev, allow_admin_raw_access: checked } : prev);
      toast({ title: `Admin raw access ${checked ? "enabled" : "disabled"}` });
    }
  };

  const openEdit = () => {
    if (!client) return;
    setEditForm({
      company_name: client.company_name,
      industry: client.industry ?? "",
      company_size: client.company_size ?? "",
      full_name: client.full_name ?? "",
      phone: client.phone ?? "",
    });
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!client) return;
    setEditSaving(true);
    const { error: ce } = await supabase
      .from("clients")
      .update({
        company_name: editForm.company_name,
        industry: editForm.industry || null,
        company_size: (editForm.company_size || null) as any,
      })
      .eq("id", client.id);

    if (ce) { toast({ title: "Error", description: ce.message, variant: "destructive" }); setEditSaving(false); return; }

    const { error: pe } = await supabase
      .from("profiles")
      .update({ full_name: editForm.full_name || null, phone: editForm.phone || null })
      .eq("user_id", client.user_id);

    if (pe) { toast({ title: "Error", description: pe.message, variant: "destructive" }); setEditSaving(false); return; }

    setClient((prev) => prev ? {
      ...prev,
      company_name: editForm.company_name,
      industry: editForm.industry || null,
      company_size: editForm.company_size || null,
      full_name: editForm.full_name || null,
      phone: editForm.phone || null,
    } : prev);
    toast({ title: "Client updated successfully" });
    setEditOpen(false);
    setEditSaving(false);
  };

  const handleSuspendToggle = async () => {
    if (!client) return;
    const newActive = !client.is_active;
    const { error } = await supabase.from("clients").update({ is_active: newActive }).eq("id", client.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setClient((prev) => prev ? { ...prev, is_active: newActive } : prev);
      toast({ title: `Client ${newActive ? "activated" : "suspended"}` });
    }
    setSuspendOpen(false);
  };

  const handleDelete = async () => {
    if (!client) return;
    const { error } = await supabase.from("clients").update({ is_active: false }).eq("id", client.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Client deleted" });
      navigate("/super-admin/clients");
    }
    setDeleteOpen(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const usagePercent = (consumed: number, limit: number) => limit === 0 ? 0 : Math.min((consumed / limit) * 100, 100);
  const usageColor = (pct: number) => pct > 90 ? "bg-red-500" : pct > 70 ? "bg-yellow-500" : "bg-green-500";

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!client) return null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/super-admin">Home</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/super-admin/clients">Clients</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{client.company_name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{client.company_name}</h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">Client ID: {client.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={openEdit}>
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={openEdit}><Pencil className="mr-2 h-4 w-4" /> Edit Client Info</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setWorkflowDialogOpen(true)}><Settings className="mr-2 h-4 w-4" /> Manage Workflows</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSuspendOpen(true)}>
                {client.is_active
                  ? <><ShieldOff className="mr-2 h-4 w-4" /> Suspend Account</>
                  : <><ShieldCheck className="mr-2 h-4 w-4" /> Activate Account</>}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete Client
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <PhoneCall className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Calls (30d)</p>
              <p className="text-2xl font-bold text-foreground">{stats.totalCalls}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Messages (30d)</p>
              <p className="text-2xl font-bold text-foreground">{stats.totalMessages}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Cost (30d)</p>
              <p className="text-2xl font-bold text-foreground">₹{stats.totalCost.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-purple-600">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Services</p>
              <p className="text-2xl font-bold text-foreground">{stats.activeServices}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client Info */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Client Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Company Name</span>
              <span className="font-semibold text-foreground">{client.company_name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Contact Person</span>
              <span className="text-foreground">{client.full_name ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-sm text-muted-foreground"><Mail className="h-3 w-3" /> Email</span>
              <span className="text-foreground">{client.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-sm text-muted-foreground"><Phone className="h-3 w-3" /> Phone</span>
              <span className="text-foreground">{client.phone ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Industry</span>
              {client.industry ? <Badge variant="outline">{client.industry}</Badge> : <span className="text-muted-foreground">—</span>}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Company Size</span>
              {client.company_size ? <Badge variant="secondary">{client.company_size}</Badge> : <span className="text-muted-foreground">—</span>}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant={client.is_active ? "default" : "destructive"} className={client.is_active ? "bg-green-100 text-green-700 hover:bg-green-100" : ""}>
                {client.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
            <div className="flex items-center justify-between border-t pt-4">
              <div>
                <Label htmlFor="raw-access" className="text-sm">Allow admin raw data access</Label>
                <p className="text-xs text-muted-foreground">Recordings, messages, transcripts</p>
              </div>
              <Switch id="raw-access" checked={client.allow_admin_raw_access} onCheckedChange={handleRawAccessToggle} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Managed By</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Admin Company</span>
              <span className="font-semibold text-foreground">{client.admin_company}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Onboarded</span>
              <span className="text-foreground">
                {client.onboarded_at ? format(new Date(client.onboarded_at), "MMM d, yyyy") : format(new Date(client.created_at), "MMM d, yyyy")}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assigned Services */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Assigned Services</CardTitle>
            <CardDescription>{services.length} services assigned</CardDescription>
          </div>
          <Badge variant="secondary">{services.filter((s) => s.is_active).length} active</Badge>
        </CardHeader>
        <CardContent>
          {services.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No services assigned yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((s) => {
                const pct = usagePercent(s.usage_consumed, s.usage_limit);
                return (
                  <Card key={s.id} className="border">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">{s.service_name}</span>
                        <Badge variant="outline" className="text-xs">{s.category}</Badge>
                      </div>
                      {s.plan_name && <p className="text-xs text-muted-foreground">Plan: {s.plan_name}</p>}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{s.usage_consumed} / {s.usage_limit} used</span>
                          <span>{pct.toFixed(0)}%</span>
                        </div>
                        <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                          <div className={`h-full transition-all ${usageColor(pct)}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Resets: {s.reset_period ?? "never"}</span>
                        <Badge variant={s.is_active ? "default" : "destructive"} className={`text-xs ${s.is_active ? "bg-green-100 text-green-700 hover:bg-green-100" : ""}`}>
                          {s.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      {s.last_reset_at && (
                        <p className="text-xs text-muted-foreground">Last reset: {format(new Date(s.last_reset_at), "MMM d, yyyy")}</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workflow Instances */}
      <Card>
        <CardHeader>
          <CardTitle>Workflow Instances</CardTitle>
        </CardHeader>
        <CardContent>
          {workflows.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No workflow instances yet.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Workflow</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Webhook URL</TableHead>
                    <TableHead>Last Executed</TableHead>
                    <TableHead className="text-center">Executions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workflows.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-medium">{w.service_name}</TableCell>
                      <TableCell>{w.workflow_name}</TableCell>
                      <TableCell>
                        <Badge className={`${statusColors[w.status ?? "pending"]} border-0`}>
                          {w.status ?? "pending"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {w.webhook_url ? (
                          <Button variant="ghost" size="sm" className="h-auto gap-1 p-0 text-xs text-muted-foreground" onClick={() => copyToClipboard(w.webhook_url!)}>
                            <Copy className="h-3 w-3" />
                            Copy URL
                          </Button>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {w.last_executed_at ? formatDistanceToNow(new Date(w.last_executed_at), { addSuffix: true }) : "Never"}
                      </TableCell>
                      <TableCell className="text-center">{w.execution_count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No recent activity.</p>
          ) : (
            <div className="space-y-3">
              {activities.map((a, i) => (
                <div key={i} className="flex items-center gap-3 rounded-md border p-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${a.type === "call" ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"}`}>
                    {a.type === "call" ? <PhoneCall className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {a.type === "call" ? "Call" : "Campaign"} — {a.service_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.timestamp ? formatDistanceToNow(new Date(a.timestamp), { addSuffix: true }) : "—"}
                    </p>
                  </div>
                  {a.status && (
                    <Badge variant="outline" className="text-xs">{a.status}</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>Update client information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Company Name</Label><Input value={editForm.company_name} onChange={(e) => setEditForm((f) => ({ ...f, company_name: e.target.value }))} /></div>
            <div><Label>Contact Name</Label><Input value={editForm.full_name} onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))} /></div>
            <div><Label>Phone</Label><Input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} /></div>
            <div><Label>Industry</Label><Input value={editForm.industry} onChange={(e) => setEditForm((f) => ({ ...f, industry: e.target.value }))} /></div>
            <div>
              <Label>Company Size</Label>
              <Select value={editForm.company_size} onValueChange={(v) => setEditForm((f) => ({ ...f, company_size: v }))}>
                <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
                <SelectContent>
                  {["1-10", "11-50", "51-200", "201-500", "500+"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={editSaving || !editForm.company_name.trim()}>
              {editSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend Dialog */}
      <AlertDialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{client.is_active ? "Suspend" : "Activate"} Client?</AlertDialogTitle>
            <AlertDialogDescription>
              {client.is_active
                ? "This will suspend the client account and disable all services."
                : "This will reactivate the client account."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSuspendToggle}>
              {client.is_active ? "Suspend" : "Activate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client?</AlertDialogTitle>
            <AlertDialogDescription>This will deactivate the client. This action cannot be undone easily.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manage Workflows Dialog */}
      <ManageWorkflowsDialog
        open={workflowDialogOpen}
        onOpenChange={setWorkflowDialogOpen}
        clientId={client.id}
        clientCompanyName={client.company_name}
      />
    </div>
  );
}

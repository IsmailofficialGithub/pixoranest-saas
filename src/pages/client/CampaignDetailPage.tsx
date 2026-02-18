import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { useClient } from "@/contexts/ClientContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft, Phone, CheckCircle, Users, DollarSign,
  Play, Pause, Trash2, Copy, Download, FileText, BarChart3,
  Loader2, Clock, PhoneCall, PhoneOff, PhoneMissed,
  AlertTriangle, Pencil, Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow, format } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

// ─── Types ───
interface Campaign {
  id: string;
  campaign_name: string;
  campaign_type: string | null;
  status: string | null;
  script: string | null;
  total_contacts: number | null;
  contacts_called: number | null;
  contacts_answered: number | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface CallLog {
  id: string;
  phone_number: string;
  status: string | null;
  duration_seconds: number | null;
  ai_summary: string | null;
  recording_url: string | null;
  transcript: string | null;
  executed_at: string | null;
  call_type: string | null;
  contact_name?: string;
}

interface Lead {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  company: string | null;
  status: string | null;
  lead_score: number | null;
  interest_level: number | null;
  created_at: string;
  notes: string | null;
}

interface ActivityItem {
  id: string;
  phone: string;
  name: string | null;
  status: string;
  timestamp: string;
  isLead?: boolean;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  draft: { color: "text-muted-foreground", bg: "bg-muted", label: "Draft" },
  scheduled: { color: "text-blue-600", bg: "bg-blue-100", label: "Scheduled" },
  running: { color: "text-green-600", bg: "bg-green-100", label: "Running" },
  paused: { color: "text-yellow-600", bg: "bg-yellow-100", label: "Paused" },
  completed: { color: "text-green-700", bg: "bg-green-100", label: "Completed" },
  cancelled: { color: "text-destructive", bg: "bg-destructive/10", label: "Cancelled" },
};

const CALL_STATUS_CONFIG: Record<string, { icon: typeof Phone; color: string }> = {
  completed: { icon: CheckCircle, color: "text-green-600" },
  answered: { icon: PhoneCall, color: "text-green-600" },
  busy: { icon: PhoneOff, color: "text-yellow-600" },
  no_answer: { icon: PhoneMissed, color: "text-muted-foreground" },
  failed: { icon: AlertTriangle, color: "text-destructive" },
  initiated: { icon: Phone, color: "text-blue-500" },
  ringing: { icon: Phone, color: "text-blue-500" },
};

const PIE_COLORS = ["#22c55e", "#eab308", "#94a3b8", "#ef4444", "#3b82f6"];

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "0s";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatElapsed(startedAt: string | null): string {
  if (!startedAt) return "—";
  const ms = Date.now() - new Date(startedAt).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function CampaignDetailPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const { client, primaryColor, assignedServices, isLoading: ctxLoading } = useClient();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Dialogs
  const [pauseDialog, setPauseDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Derived stats
  const totalContacts = campaign?.total_contacts || 0;
  const contactsCalled = campaign?.contacts_called || 0;
  const contactsAnswered = campaign?.contacts_answered || 0;
  const progressPct = totalContacts > 0 ? Math.round((contactsCalled / totalContacts) * 100) : 0;
  const answerRate = contactsCalled > 0 ? Math.round((contactsAnswered / contactsCalled) * 100) : 0;
  const leadsCount = leads.length;
  const isRunning = campaign?.status === "running";

  // Fetch campaign
  const fetchCampaign = useCallback(async () => {
    if (!campaignId || !client) return;
    const { data, error } = await supabase
      .from("voice_campaigns")
      .select("*")
      .eq("id", campaignId)
      .eq("client_id", client.id)
      .maybeSingle();

    if (error || !data) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setCampaign(data as Campaign);
    setLoading(false);
  }, [campaignId, client]);

  // Fetch call logs
  const fetchCallLogs = useCallback(async () => {
    if (!campaignId || !client) return;
    // Get contacts for this campaign
    const { data: contacts } = await supabase
      .from("campaign_contacts")
      .select("phone_number, contact_name, call_log_id, call_status")
      .eq("campaign_id", campaignId);

    const contactMap = new Map(
      (contacts || []).filter(c => c.call_log_id).map(c => [c.call_log_id!, c])
    );

    if (contactMap.size > 0) {
      const { data: logs } = await supabase
        .from("call_logs")
        .select("*")
        .in("id", Array.from(contactMap.keys()))
        .order("executed_at", { ascending: false });

      setCallLogs(
        (logs || []).map(l => ({
          ...l,
          contact_name: contactMap.get(l.id)?.contact_name || undefined,
        })) as CallLog[]
      );
    } else {
      setCallLogs([]);
    }

    // Build activity feed from contacts
    const recentContacts = (contacts || [])
      .filter(c => c.call_status && c.call_status !== "pending")
      .slice(0, 20)
      .map(c => ({
        id: c.call_log_id || c.phone_number,
        phone: c.phone_number,
        name: c.contact_name,
        status: c.call_status || "pending",
        timestamp: new Date().toISOString(), // We don't have exact timestamp on contacts
        isLead: false,
      }));
    setActivity(recentContacts);
  }, [campaignId, client]);

  // Fetch leads
  const fetchLeads = useCallback(async () => {
    if (!campaignId) return;
    const { data } = await supabase
      .from("leads")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false });
    setLeads((data || []) as Lead[]);
  }, [campaignId]);

  useEffect(() => {
    if (client && campaignId) {
      fetchCampaign();
      fetchCallLogs();
      fetchLeads();
    }
  }, [client, campaignId, fetchCampaign, fetchCallLogs, fetchLeads]);

  // Realtime subscription
  useEffect(() => {
    if (!campaignId || !client) return;

    const channel = supabase
      .channel(`campaign-detail-${campaignId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "voice_campaigns",
        filter: `id=eq.${campaignId}`,
      }, () => fetchCampaign())
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "campaign_contacts",
        filter: `campaign_id=eq.${campaignId}`,
      }, () => {
        fetchCallLogs();
        fetchCampaign();
      })
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "leads",
        filter: `campaign_id=eq.${campaignId}`,
      }, () => fetchLeads())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [campaignId, client, fetchCampaign, fetchCallLogs, fetchLeads]);

  // Actions
  async function handlePauseResume() {
    if (!campaign) return;
    setActionLoading(true);
    const newStatus = campaign.status === "running" ? "paused" : "running";
    const { error } = await supabase
      .from("voice_campaigns")
      .update({ status: newStatus as any })
      .eq("id", campaign.id);
    if (error) toast.error("Failed to update campaign");
    else toast.success(newStatus === "paused" ? "Campaign paused" : "Campaign resumed");
    setPauseDialog(false);
    setActionLoading(false);
    fetchCampaign();
  }

  async function handleDelete() {
    if (!campaign || deleteConfirmName !== campaign.campaign_name) return;
    setActionLoading(true);
    // Delete contacts first, then campaign
    await supabase.from("campaign_contacts").delete().eq("campaign_id", campaign.id);
    const { error } = await supabase.from("voice_campaigns").delete().eq("id", campaign.id);
    if (error) toast.error("Failed to delete campaign");
    else {
      toast.success("Campaign deleted");
      navigate("/client/voice-telecaller");
    }
    setActionLoading(false);
    setDeleteDialog(false);
  }

  async function handleLaunchNow() {
    if (!campaign) return;
    setActionLoading(true);
    const { error } = await supabase
      .from("voice_campaigns")
      .update({ status: "running" as any, started_at: new Date().toISOString() })
      .eq("id", campaign.id);
    if (error) toast.error("Failed to launch");
    else toast.success("Campaign launched!");
    setActionLoading(false);
    fetchCampaign();
  }

  function exportCallLogsCsv() {
    const headers = "Contact Name,Phone Number,Status,Duration,AI Summary,Timestamp\n";
    const rows = callLogs.map(l =>
      [
        l.contact_name || "",
        l.phone_number,
        l.status || "",
        formatDuration(l.duration_seconds),
        (l.ai_summary || "").replace(/,/g, ";").replace(/\n/g, " "),
        l.executed_at ? format(new Date(l.executed_at), "yyyy-MM-dd HH:mm") : "",
      ].join(",")
    ).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${campaign?.campaign_name || "campaign"}_calls.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Chart data for overview (must be before early returns)
  const callStatusDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    callLogs.forEach(l => {
      const s = l.status || "unknown";
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [callLogs]);

  // Check access
  const telecallerService = assignedServices.find(s => s.service_slug === "voice-telecaller");
  if (!ctxLoading && !telecallerService) return <Navigate to="/client" replace />;

  if (loading || ctxLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (notFound || !campaign) {
    return (
      <div className="p-6 text-center py-20">
        <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Campaign Not Found</h2>
        <p className="text-muted-foreground mb-4">This campaign doesn't exist or you don't have access.</p>
        <Button onClick={() => navigate("/client/voice-telecaller")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Telecaller
        </Button>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[campaign.status || "draft"] || STATUS_CONFIG.draft;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/client/voice-telecaller")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">{campaign.campaign_name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={`${statusConfig.bg} ${statusConfig.color} border-0`}>
                {isRunning && <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse mr-1.5 inline-block" />}
                {statusConfig.label}
              </Badge>
              {campaign.created_at && (
                <span className="text-xs text-muted-foreground">
                  Created {formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true })}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {(campaign.status === "scheduled" || campaign.status === "draft") && (
            <Button
              size="sm"
              onClick={handleLaunchNow}
              disabled={actionLoading}
              style={{ backgroundColor: primaryColor, color: "white" }}
            >
              <Rocket className="h-4 w-4 mr-1" /> Launch Now
            </Button>
          )}
          {isRunning && (
            <Button size="sm" variant="outline" className="border-yellow-500 text-yellow-600 hover:bg-yellow-50" onClick={() => setPauseDialog(true)}>
              <Pause className="h-4 w-4 mr-1" /> Pause
            </Button>
          )}
          {campaign.status === "paused" && (
            <Button size="sm" onClick={() => setPauseDialog(true)} style={{ backgroundColor: primaryColor, color: "white" }}>
              <Play className="h-4 w-4 mr-1" /> Resume
            </Button>
          )}
          {campaign.status === "completed" && (
            <>
              <Button size="sm" variant="outline" onClick={exportCallLogsCsv}>
                <Download className="h-4 w-4 mr-1" /> Export Report
              </Button>
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">•••</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportCallLogsCsv}>
                <Download className="h-4 w-4 mr-2" /> Export CSV
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialog(true)}>
                <Trash2 className="h-4 w-4 mr-2" /> Delete Campaign
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Live Progress (for running campaigns) */}
      {(isRunning || campaign.status === "paused") && (
        <Card className="border-2" style={{ borderColor: isRunning ? primaryColor + "60" : undefined }}>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Circular Progress */}
              <div className="flex flex-col items-center justify-center">
                <div className="relative w-36 h-36">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--secondary))" strokeWidth="8" />
                    <circle
                      cx="50" cy="50" r="42" fill="none"
                      stroke={primaryColor}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${progressPct * 2.64} 264`}
                      className="transition-all duration-700"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold">{progressPct}%</span>
                    <span className="text-[10px] text-muted-foreground">{contactsCalled}/{totalContacts}</span>
                  </div>
                </div>
                <p className="text-sm mt-2 text-muted-foreground">
                  {isRunning ? "Campaign in progress..." : "Campaign paused"}
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Calls Made" value={contactsCalled} />
                <MiniStat label="Answered" value={`${contactsAnswered} (${answerRate}%)`} />
                <MiniStat label="Leads" value={leadsCount} />
                <MiniStat label="Elapsed" value={formatElapsed(campaign.started_at)} />
              </div>

              {/* Activity Feed */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Live Activity</p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {activity.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">Waiting for calls...</p>
                  ) : activity.slice(0, 8).map((item, i) => {
                    const cfg = CALL_STATUS_CONFIG[item.status] || CALL_STATUS_CONFIG.initiated;
                    const Icon = cfg.icon;
                    return (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <Icon className={`h-3.5 w-3.5 shrink-0 ${cfg.color}`} />
                        <span className="font-mono truncate flex-1">{item.name || item.phone}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {item.status.replace("_", " ")}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Phone} label="Total Contacts" value={totalContacts} color={primaryColor} />
        <StatCard icon={CheckCircle} label="Answer Rate" value={`${answerRate}%`} sub={`${contactsAnswered} of ${contactsCalled}`} color="#22c55e" />
        <StatCard icon={Users} label="Leads Captured" value={leadsCount} color="#8b5cf6" />
        <StatCard icon={DollarSign} label="Calls Completed" value={contactsCalled} color="#f59e0b" />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 md:w-auto md:inline-flex">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="calls">Call Logs</TabsTrigger>
          <TabsTrigger value="leads">Leads ({leadsCount})</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Campaign Information</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                <InfoRow label="Created" value={format(new Date(campaign.created_at), "MMM dd, yyyy HH:mm")} />
                {campaign.started_at && <InfoRow label="Started" value={format(new Date(campaign.started_at), "MMM dd, yyyy HH:mm")} />}
                {campaign.completed_at && <InfoRow label="Completed" value={format(new Date(campaign.completed_at), "MMM dd, yyyy HH:mm")} />}
                {campaign.scheduled_at && <InfoRow label="Scheduled For" value={format(new Date(campaign.scheduled_at), "MMM dd, yyyy HH:mm")} />}
                <InfoRow label="Type" value={campaign.campaign_type || "Telecaller"} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Call Script</CardTitle>
              </CardHeader>
              <CardContent>
                {campaign.script ? (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-6">
                    {campaign.script}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No script configured</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Progress Chart */}
          {callLogs.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Call Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={callStatusDistribution}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {callStatusDistribution.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend />
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Call Logs Tab */}
        <TabsContent value="calls" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{callLogs.length} call logs</p>
            {callLogs.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportCallLogsCsv}>
                <Download className="h-4 w-4 mr-1" /> Export CSV
              </Button>
            )}
          </div>

          {callLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Phone className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No call logs yet</p>
              <p className="text-xs">Calls will appear here as the campaign runs.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contact</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead className="hidden md:table-cell">AI Summary</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {callLogs.map(log => {
                    const cfg = CALL_STATUS_CONFIG[log.status || "initiated"] || CALL_STATUS_CONFIG.initiated;
                    const Icon = cfg.icon;
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs font-medium">{log.contact_name || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{log.phone_number}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${cfg.color}`}>
                            <Icon className="h-3 w-3 mr-1" />
                            {(log.status || "initiated").replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{formatDuration(log.duration_seconds)}</TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[200px] truncate" title={log.ai_summary || ""}>
                          {log.ai_summary || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {log.executed_at ? formatDistanceToNow(new Date(log.executed_at), { addSuffix: true }) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Leads Tab */}
        <TabsContent value="leads" className="space-y-4 mt-4">
          {leads.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No leads captured yet</p>
              <p className="text-xs">Leads will appear here as the AI qualifies contacts.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {leads.map(lead => (
                <Card key={lead.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{lead.name || lead.phone}</p>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span>{lead.phone}</span>
                        {lead.email && <span>{lead.email}</span>}
                        {lead.company && <span>{lead.company}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {lead.lead_score != null && (
                        <Badge variant="outline" className="text-xs">Score: {lead.lead_score}</Badge>
                      )}
                      <Badge className={
                        lead.status === "qualified" ? "bg-green-100 text-green-700 border-0" :
                        lead.status === "converted" ? "bg-blue-100 text-blue-700 border-0" :
                        "bg-muted text-muted-foreground border-0"
                      }>
                        {lead.status || "new"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6 mt-4">
          {callLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No data yet</p>
              <p className="text-xs">Analytics will be available once calls have been made.</p>
            </div>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Call Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={callStatusDistribution}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {callStatusDistribution.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Legend />
                        <RechartsTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Call Duration Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <DurationChart callLogs={callLogs} primaryColor={primaryColor} />
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Pause/Resume Dialog */}
      <Dialog open={pauseDialog} onOpenChange={setPauseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {campaign.status === "running" ? "Pause Campaign?" : "Resume Campaign?"}
            </DialogTitle>
            <DialogDescription>
              {campaign.status === "running"
                ? "No new calls will be made until you resume the campaign."
                : "The campaign will continue making calls from where it left off."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPauseDialog(false)}>Cancel</Button>
            <Button onClick={handlePauseResume} disabled={actionLoading}
              style={{ backgroundColor: primaryColor, color: "white" }}>
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {campaign.status === "running" ? "Pause" : "Resume"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Campaign</DialogTitle>
            <DialogDescription>
              This will delete all campaign data including call logs. This cannot be undone.
              Type <strong>{campaign.campaign_name}</strong> to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Type campaign name to confirm"
            value={deleteConfirmName}
            onChange={e => setDeleteConfirmName(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteDialog(false); setDeleteConfirmName(""); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirmName !== campaign.campaign_name || actionLoading}
              onClick={handleDelete}
            >
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Sub-components ─── */

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: typeof Phone; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-start gap-3">
        <div className="p-2 rounded-lg" style={{ backgroundColor: color + "15" }}>
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center p-2 rounded-lg bg-muted/50">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function DurationChart({ callLogs, primaryColor }: { callLogs: CallLog[]; primaryColor: string }) {
  const buckets = useMemo(() => {
    const ranges = [
      { label: "0-15s", min: 0, max: 15 },
      { label: "15-30s", min: 15, max: 30 },
      { label: "30-60s", min: 30, max: 60 },
      { label: "1-2m", min: 60, max: 120 },
      { label: "2-5m", min: 120, max: 300 },
      { label: "5m+", min: 300, max: Infinity },
    ];
    return ranges.map(r => ({
      name: r.label,
      count: callLogs.filter(l => {
        const d = l.duration_seconds || 0;
        return d >= r.min && d < r.max;
      }).length,
    }));
  }, [callLogs]);

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={buckets}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <RechartsTooltip />
          <Line type="monotone" dataKey="count" stroke={primaryColor} strokeWidth={2} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

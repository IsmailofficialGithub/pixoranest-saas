import { useEffect, useState, useCallback } from "react";
import { useClient } from "@/contexts/ClientContext";
import { supabase } from "@/integrations/supabase/client";
import { Navigate, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Phone, CheckCircle, Users, Plus, MoreVertical, Play,
  FileText, ArrowRight, Lightbulb, ChevronDown, X,
  Pause, Copy, Trash2, Eye, Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import CreateCampaignWizard from "@/components/client/telecaller/CreateCampaignWizard";

interface CampaignStats {
  totalCalls: number;
  completedCalls: number;
  successRate: number;
  leadsCount: number;
}

interface Campaign {
  id: string;
  campaign_name: string;
  status: string;
  campaign_type: string | null;
  total_contacts: number;
  contacts_called: number;
  contacts_answered: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  script: string | null;
}

interface CallLog {
  id: string;
  phone_number: string;
  duration_seconds: number;
  status: string;
  ai_summary: string | null;
  executed_at: string;
  recording_url: string | null;
  call_type: string | null;
}

export default function VoiceTelecallerPage() {
  const { client, assignedServices, isLoading: contextLoading, primaryColor } = useClient();
  const navigate = useNavigate();

  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [recentCalls, setRecentCalls] = useState<CallLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [tipsVisible, setTipsVisible] = useState(() => {
    return localStorage.getItem("hide-telecaller-tips") !== "true";
  });
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  // Check access
  const telecallerService = assignedServices.find(s => s.service_slug === "voice-telecaller" || s.service_slug === "ai-voice-telecaller");

  useEffect(() => {
    if (!client || contextLoading) return;
    if (!telecallerService) return;

    // Get the actual service ID
    const fetchServiceId = async () => {
      const { data } = await supabase
        .from("services")
        .select("id")
        .eq("slug", "ai-voice-telecaller")
        .maybeSingle();
      if (data) {
        setServiceId(data.id);
      }
    };
    fetchServiceId();
  }, [client, contextLoading, telecallerService]);

  useEffect(() => {
    if (!client || !serviceId) return;
    fetchAllData();
  }, [client, serviceId]);

  // Realtime subscription for campaigns
  useEffect(() => {
    if (!client) return;
    const channel = supabase
      .channel("telecaller-campaigns")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "voice_campaigns",
        filter: `client_id=eq.${client.id}`,
      }, () => {
        fetchCampaigns();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [client]);

  const fetchAllData = useCallback(async () => {
    if (!client || !serviceId) return;
    setIsLoading(true);
    await Promise.all([fetchStats(), fetchCampaigns(), fetchRecentCalls()]);
    setIsLoading(false);
  }, [client, serviceId]);

  async function fetchStats() {
    if (!client || !serviceId) return;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [callsRes, leadsRes] = await Promise.all([
      supabase
        .from("call_logs")
        .select("status")
        .eq("client_id", client.id)
        .eq("service_id", serviceId)
        .gte("executed_at", monthStart),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("client_id", client.id)
        .eq("lead_source", "telecaller")
        .gte("created_at", monthStart),
    ]);

    const calls = callsRes.data || [];
    const completed = calls.filter(c => c.status === "completed").length;
    const total = calls.length;

    setStats({
      totalCalls: total,
      completedCalls: completed,
      successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      leadsCount: leadsRes.count || 0,
    });
  }

  async function fetchCampaigns() {
    if (!client) return;
    const { data } = await supabase
      .from("voice_campaigns")
      .select("*")
      .eq("client_id", client.id)
      .eq("campaign_type", "telecaller")
      .order("created_at", { ascending: false });
    setCampaigns((data as Campaign[]) || []);
  }

  async function fetchRecentCalls() {
    if (!client || !serviceId) return;
    const { data } = await supabase
      .from("call_logs")
      .select("id, phone_number, duration_seconds, status, ai_summary, executed_at, recording_url, call_type")
      .eq("client_id", client.id)
      .eq("service_id", serviceId)
      .order("executed_at", { ascending: false })
      .limit(10);
    setRecentCalls((data as CallLog[]) || []);
  }

  if (contextLoading) {
    return <LoadingSkeleton />;
  }

  if (!telecallerService) {
    return <Navigate to="/client" replace />;
  }

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  const filteredCampaigns = activeTab === "all"
    ? campaigns
    : campaigns.filter(c => c.status === activeTab);

  const dismissTips = () => {
    setTipsVisible(false);
    localStorage.setItem("hide-telecaller-tips", "true");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">AI Voice Telecaller</h1>
          <p className="text-sm text-muted-foreground">Automate your outbound calling campaigns</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Badge variant="outline" className="text-xs py-1 px-3">
            {telecallerService.usage_consumed} / {telecallerService.usage_limit} calls used
          </Badge>
          <Button style={{ backgroundColor: primaryColor, color: "white" }} onClick={() => setWizardOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Campaign
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <StatsCard
          icon={<Phone className="h-5 w-5" />}
          color={primaryColor}
          label="Total Calls"
          value={stats?.totalCalls ?? 0}
          subtext="This month"
        />
        <StatsCard
          icon={<CheckCircle className="h-5 w-5" />}
          color="#22c55e"
          label="Success Rate"
          value={`${stats?.successRate ?? 0}%`}
          subtext={`${stats?.completedCalls ?? 0} of ${stats?.totalCalls ?? 0} calls`}
        />
        <StatsCard
          icon={<Users className="h-5 w-5" />}
          color={primaryColor}
          label="Leads Captured"
          value={stats?.leadsCount ?? 0}
          linkText="View Leads"
          onLinkClick={() => navigate("/client/leads")}
        />
      </div>

      {/* Quick Tips */}
      {tipsVisible && (
        <Collapsible defaultOpen>
          <Card className="border-dashed">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CollapsibleTrigger className="flex items-center gap-2 cursor-pointer">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                <CardTitle className="text-sm">Quick Tips</CardTitle>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </CollapsibleTrigger>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={dismissTips}>
                <X className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="grid gap-2 sm:grid-cols-2 text-xs text-muted-foreground">
                  <p>📝 Prepare your call script with variables like {"{name}"}, {"{company}"}</p>
                  <p>📊 Upload contacts as CSV with name, phone, and custom fields</p>
                  <p>🎯 Best time to call: 10 AM – 4 PM on weekdays</p>
                  <p>✅ Review AI summaries to identify hot leads</p>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Campaigns Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">My Campaigns</h2>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {[
            { key: "all", label: "All Campaigns" },
            { key: "running", label: "Running" },
            { key: "scheduled", label: "Scheduled" },
            { key: "completed", label: "Completed" },
          ].map(tab => (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? "default" : "outline"}
              size="sm"
              className="text-xs shrink-0"
              style={activeTab === tab.key ? { backgroundColor: primaryColor, color: "white" } : undefined}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              {tab.key !== "all" && (
                <span className="ml-1.5 text-[10px] opacity-70">
                  ({campaigns.filter(c => tab.key === "all" ? true : c.status === tab.key).length})
                </span>
              )}
            </Button>
          ))}
        </div>

        {/* Campaign Cards */}
        {filteredCampaigns.length > 0 ? (
          <div className="space-y-3">
            {filteredCampaigns.map(campaign => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                primaryColor={primaryColor}
                navigate={navigate}
              />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          /* Empty state – no campaigns at all */
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-5 mb-4">
                <Phone className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                No calling campaigns yet
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-6">
                Create your first campaign to start reaching out to customers with AI-powered calls.
              </p>
              <Button style={{ backgroundColor: primaryColor, color: "white" }} size="lg" onClick={() => setWizardOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Campaign
              </Button>
            </CardContent>
          </Card>
        ) : (
          /* Empty state – filter has no results */
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-sm text-muted-foreground">No {activeTab} campaigns found.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Calls */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Recent Calls</CardTitle>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/client/voice-telecaller/calls")}>
            View All <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          {recentCalls.length > 0 ? (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Phone Number</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>AI Summary</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentCalls.map(call => (
                      <TableRow key={call.id}>
                        <TableCell className="font-mono text-sm">{call.phone_number}</TableCell>
                        <TableCell className="text-sm">{formatDuration(call.duration_seconds)}</TableCell>
                        <TableCell><CallStatusBadge status={call.status} /></TableCell>
                        <TableCell>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]" title={call.ai_summary || ""}>
                            {call.ai_summary || "—"}
                          </p>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(call.executed_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {call.recording_url && (
                                <DropdownMenuItem>
                                  <Play className="h-3 w-3 mr-2" /> Play Recording
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem>
                                <FileText className="h-3 w-3 mr-2" /> View Transcript
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Users className="h-3 w-3 mr-2" /> Mark as Lead
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {recentCalls.map(call => (
                  <div key={call.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm">{call.phone_number}</span>
                      <CallStatusBadge status={call.status} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatDuration(call.duration_seconds)}</span>
                      <span>{formatDistanceToNow(new Date(call.executed_at), { addSuffix: true })}</span>
                    </div>
                    {call.ai_summary && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{call.ai_summary}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-10">
              <Phone className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No calls recorded yet</p>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Campaign Wizard */}
      <CreateCampaignWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        primaryColor={primaryColor}
        usageLimit={telecallerService.usage_limit}
        usageConsumed={telecallerService.usage_consumed}
        clientId={client?.id || ""}
      />
    </div>
  );
}

/* ─── Sub Components ─── */

function StatsCard({
  icon, color, label, value, subtext, linkText, onLinkClick,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  value: string | number;
  subtext?: string;
  linkText?: string;
  onLinkClick?: () => void;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg p-2.5" style={{ backgroundColor: `${color}15` }}>
            <div style={{ color }}>{icon}</div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
            {subtext && <p className="text-[11px] text-muted-foreground">{subtext}</p>}
          </div>
          {linkText && onLinkClick && (
            <Button variant="ghost" size="sm" className="text-xs shrink-0" onClick={onLinkClick}>
              {linkText} <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CampaignCard({
  campaign, primaryColor, navigate,
}: {
  campaign: Campaign;
  primaryColor: string;
  navigate: (path: string) => void;
}) {
  const total = campaign.total_contacts || 0;
  const called = campaign.contacts_called || 0;
  const answered = campaign.contacts_answered || 0;
  const progress = total > 0 ? Math.round((called / total) * 100) : 0;
  const successRate = called > 0 ? Math.round((answered / called) * 100) : 0;

  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1 min-w-0 space-y-3">
            {/* Title + Status */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{campaign.campaign_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  Created {formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true })}
                </p>
              </div>
              <CampaignStatusBadge status={campaign.status} />
            </div>

            {/* Progress */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">{called} / {total} calls made</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {/* Mini stats */}
            <div className="flex gap-4 text-xs">
              <div>
                <span className="text-muted-foreground">Answered: </span>
                <span className="font-medium">{answered}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Success: </span>
                <span className="font-medium">{successRate}%</span>
              </div>
              <div>
                <span className="text-muted-foreground">Total: </span>
                <span className="font-medium">{total}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem><Eye className="h-3 w-3 mr-2" /> View Details</DropdownMenuItem>
              <DropdownMenuItem><Phone className="h-3 w-3 mr-2" /> View Calls</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/client/leads")}>
                <Users className="h-3 w-3 mr-2" /> View Leads
              </DropdownMenuItem>
              {campaign.status === "running" && (
                <DropdownMenuItem><Pause className="h-3 w-3 mr-2" /> Pause</DropdownMenuItem>
              )}
              {campaign.status === "paused" && (
                <DropdownMenuItem><Play className="h-3 w-3 mr-2" /> Resume</DropdownMenuItem>
              )}
              <DropdownMenuItem><Copy className="h-3 w-3 mr-2" /> Clone Campaign</DropdownMenuItem>
              {(campaign.status === "draft" || campaign.status === "completed") && (
                <DropdownMenuItem className="text-destructive focus:text-destructive">
                  <Trash2 className="h-3 w-3 mr-2" /> Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

function CampaignStatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; className?: string }> = {
    draft: { variant: "outline", label: "Draft" },
    scheduled: { variant: "secondary", label: "Scheduled" },
    running: { variant: "default", label: "Running", className: "animate-pulse" },
    paused: { variant: "outline", label: "Paused", className: "border-yellow-500 text-yellow-600" },
    completed: { variant: "default", label: "Completed" },
    cancelled: { variant: "destructive", label: "Cancelled" },
  };
  const c = config[status] || { variant: "outline" as const, label: status };
  return <Badge variant={c.variant} className={`text-[10px] ${c.className || ""}`}>{c.label}</Badge>;
}

function CallStatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    completed: { variant: "default", label: "Completed" },
    answered: { variant: "default", label: "Answered" },
    busy: { variant: "outline", label: "Busy" },
    no_answer: { variant: "secondary", label: "No Answer" },
    failed: { variant: "destructive", label: "Failed" },
    initiated: { variant: "outline", label: "Initiated" },
    ringing: { variant: "secondary", label: "Ringing" },
  };
  const c = config[status] || { variant: "outline" as const, label: status };
  return <Badge variant={c.variant} className="text-[10px]">{c.label}</Badge>;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "0s";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}
      </div>
      <Skeleton className="h-64" />
      <Skeleton className="h-48" />
    </div>
  );
}

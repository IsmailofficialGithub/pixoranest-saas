import { useEffect, useState, useCallback } from "react";
import { useClient } from "@/contexts/ClientContext";
import { supabase } from "@/integrations/supabase/client";
import { Navigate, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bot, Phone, Clock, CheckCircle, Users, ArrowRight,
  Play, Copy, Settings, MoreVertical, FileText, Activity,
  PhoneCall, TrendingUp, Pause,
} from "lucide-react";
import { formatDistanceToNow, format, subDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

/* ─── Types ─── */
interface AgentStats {
  totalCalls: number;
  answeredCalls: number;
  answerRate: number;
  avgDuration: number;
  leadsCount: number;
}

interface CallLog {
  id: string;
  phone_number: string;
  duration_seconds: number | null;
  status: string | null;
  ai_summary: string | null;
  executed_at: string;
  recording_url: string | null;
  call_type: string | null;
}

/* ─── Main Page ─── */
export default function VoiceAgentPage() {
  const { client, assignedServices, isLoading: contextLoading, primaryColor } = useClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [stats, setStats] = useState<AgentStats | null>(null);
  const [recentCalls, setRecentCalls] = useState<CallLog[]>([]);
  const [chartData, setChartData] = useState<{ date: string; calls: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [workflowInstance, setWorkflowInstance] = useState<any>(null);

  const agentService = assignedServices.find(
    (s) => s.service_slug === "voice-agent" || s.service_slug === "ai-voice-agent"
  );

  useEffect(() => {
    if (!client || contextLoading || !agentService) return;
    const fetchServiceId = async () => {
      // Try both slug variants
      let { data } = await supabase
        .from("services")
        .select("id")
        .eq("slug", "voice-agent")
        .maybeSingle();
      if (!data) {
        const res = await supabase
          .from("services")
          .select("id")
          .eq("slug", "ai-voice-agent")
          .maybeSingle();
        data = res.data;
      }
      if (data) setServiceId(data.id);
    };
    fetchServiceId();
  }, [client, contextLoading, agentService]);

  useEffect(() => {
    if (!client || !serviceId) return;
    fetchAllData();
  }, [client, serviceId]);

  const fetchAllData = useCallback(async () => {
    if (!client || !serviceId) return;
    setIsLoading(true);
    await Promise.all([fetchStats(), fetchWorkflow(), fetchRecentCalls(), fetchChartData()]);
    setIsLoading(false);
  }, [client, serviceId]);

  async function fetchStats() {
    if (!client || !serviceId) return;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [callsRes, leadsRes] = await Promise.all([
      supabase
        .from("call_logs")
        .select("status, duration_seconds")
        .eq("client_id", client.id)
        .eq("service_id", serviceId)
        .gte("executed_at", monthStart),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("client_id", client.id)
        .eq("lead_source", "voice_agent")
        .gte("created_at", monthStart),
    ]);

    const calls = callsRes.data || [];
    const answered = calls.filter(
      (c) => c.status === "completed" || c.status === "answered"
    ).length;
    const totalDuration = calls.reduce((s, c) => s + (c.duration_seconds || 0), 0);

    setStats({
      totalCalls: calls.length,
      answeredCalls: answered,
      answerRate: calls.length > 0 ? Math.round((answered / calls.length) * 100) : 0,
      avgDuration: calls.length > 0 ? Math.round(totalDuration / calls.length) : 0,
      leadsCount: leadsRes.count || 0,
    });
  }

  async function fetchWorkflow() {
    if (!client || !serviceId) return;
    const { data } = await supabase
      .from("client_workflow_instances")
      .select("*")
      .eq("client_id", client.id)
      .eq("service_id", serviceId)
      .maybeSingle();
    setWorkflowInstance(data);
  }

  async function fetchRecentCalls() {
    if (!client || !serviceId) return;
    const { data } = await supabase
      .from("call_logs")
      .select(
        "id, phone_number, duration_seconds, status, ai_summary, executed_at, recording_url, call_type"
      )
      .eq("client_id", client.id)
      .eq("service_id", serviceId)
      .order("executed_at", { ascending: false })
      .limit(10);
    setRecentCalls((data as CallLog[]) || []);
  }

  async function fetchChartData() {
    if (!client || !serviceId) return;
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
    const { data } = await supabase
      .from("call_logs")
      .select("executed_at")
      .eq("client_id", client.id)
      .eq("service_id", serviceId)
      .gte("executed_at", thirtyDaysAgo);

    const counts: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "MMM d");
      counts[d] = 0;
    }
    (data || []).forEach((c) => {
      const d = format(new Date(c.executed_at), "MMM d");
      if (counts[d] !== undefined) counts[d]++;
    });
    setChartData(Object.entries(counts).map(([date, calls]) => ({ date, calls })));
  }

  const isActive =
    workflowInstance?.status === "active" && workflowInstance?.is_active;

  const toggleActive = async (activate: boolean) => {
    if (!workflowInstance) {
      toast({
        title: "No workflow configured",
        description: "Contact your admin to set up the Voice Agent workflow.",
        variant: "destructive",
      });
      return;
    }
    const { error } = await supabase
      .from("client_workflow_instances")
      .update({
        is_active: activate,
        status: activate ? "active" : "suspended",
        updated_at: new Date().toISOString(),
      })
      .eq("id", workflowInstance.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: activate ? "Voice Agent activated ✓" : "Voice Agent deactivated" });
      setWorkflowInstance((prev: any) =>
        prev ? { ...prev, is_active: activate, status: activate ? "active" : "suspended" } : prev
      );
    }
  };

  if (contextLoading) return <LoadingSkeleton />;
  if (!agentService) return <Navigate to="/client" replace />;
  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
            <Bot className="h-6 w-6" style={{ color: primaryColor }} />
            AI Voice Agent
          </h1>
          <p className="text-sm text-muted-foreground">
            Your AI-powered voice conversations
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="outline" className="text-xs py-1 px-3">
            {agentService.usage_consumed} / {agentService.usage_limit} calls used
          </Badge>
          <div className="flex items-center gap-2">
            {isActive ? (
              <Badge className="bg-primary/15 text-primary text-xs animate-pulse">
                ● Active
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">
                ● Inactive
              </Badge>
            )}
            <Switch checked={isActive} onCheckedChange={toggleActive} />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          icon={<PhoneCall className="h-5 w-5" />}
          color={primaryColor}
          label="Total Calls"
          value={stats?.totalCalls ?? 0}
          subtext="This month"
        />
        <StatsCard
          icon={<TrendingUp className="h-5 w-5" />}
          color="#22c55e"
          label="Answer Rate"
          value={`${stats?.answerRate ?? 0}%`}
          subtext={`${stats?.answeredCalls ?? 0} answered`}
        />
        <StatsCard
          icon={<Clock className="h-5 w-5" />}
          color={primaryColor}
          label="Avg Duration"
          value={formatDuration(stats?.avgDuration ?? 0)}
          subtext="Per call average"
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

      {/* Status Card */}
      <Card>
        <CardContent className="pt-6">
          {isActive ? (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/15 p-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    Your AI Voice Agent is ACTIVE
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Handling calls automatically with AI
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-muted p-5 text-center">
              <Pause className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="font-semibold text-foreground">
                Your AI Voice Agent is INACTIVE
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                {workflowInstance
                  ? "Activate to start handling calls"
                  : "Contact your admin to set up the agent workflow"}
              </p>
              {workflowInstance && (
                <Button
                  style={{ backgroundColor: primaryColor, color: "white" }}
                  onClick={() => toggleActive(true)}
                >
                  Activate Now
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Call Trend Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Call Volume (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.some((d) => d.calls > 0) ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="calls"
                  stroke={primaryColor}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-10">
              <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No call data yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Calls */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Recent Calls</CardTitle>
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
                      <TableHead>Type</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>AI Summary</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentCalls.map((call) => (
                      <TableRow key={call.id}>
                        <TableCell className="font-mono text-sm">
                          {call.phone_number}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {call.call_type || "voice"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDuration(call.duration_seconds || 0)}
                        </TableCell>
                        <TableCell>
                          <CallStatusBadge status={call.status || "unknown"} />
                        </TableCell>
                        <TableCell>
                          <p
                            className="text-xs text-muted-foreground truncate max-w-[200px]"
                            title={call.ai_summary || ""}
                          >
                            {call.ai_summary || "—"}
                          </p>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(call.executed_at), {
                            addSuffix: true,
                          })}
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
                {recentCalls.map((call) => (
                  <div key={call.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm">{call.phone_number}</span>
                      <CallStatusBadge status={call.status || "unknown"} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatDuration(call.duration_seconds || 0)}</span>
                      <span>
                        {formatDistanceToNow(new Date(call.executed_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    {call.ai_summary && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {call.ai_summary}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-10">
              <Phone className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No calls recorded yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Calls will appear here once your voice agent starts handling them.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Sub Components ─── */

function StatsCard({
  icon,
  color,
  label,
  value,
  subtext,
  linkText,
  onLinkClick,
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
          <div
            className="rounded-lg p-2.5"
            style={{ backgroundColor: `${color}15` }}
          >
            <div style={{ color }}>{icon}</div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
            {subtext && (
              <p className="text-[11px] text-muted-foreground">{subtext}</p>
            )}
          </div>
          {linkText && onLinkClick && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs shrink-0"
              onClick={onLinkClick}
            >
              {linkText} <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CallStatusBadge({ status }: { status: string }) {
  const variant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    completed: "default",
    answered: "default",
    ringing: "secondary",
    "in-progress": "secondary",
    failed: "destructive",
    "no-answer": "outline",
    busy: "outline",
  };
  return (
    <Badge variant={variant[status] || "outline"} className="text-[10px] capitalize">
      {status}
    </Badge>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-32" />
      <Skeleton className="h-[260px]" />
      <Skeleton className="h-[300px]" />
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

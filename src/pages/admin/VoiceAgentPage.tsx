import { useEffect, useState } from "react";
import { useAdmin } from "@/contexts/AdminContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Bot, Phone, Clock, Users, Activity, PhoneCall,
  TrendingUp, AlertCircle, CheckCircle2, XCircle,
} from "lucide-react";
import { format } from "date-fns";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  AreaChart, Area,
} from "recharts";

interface ClientAgentStats {
  clientId: string;
  companyName: string;
  contactName: string | null;
  totalCalls: number;
  answeredCalls: number;
  avgDuration: number;
  isActive: boolean;
  hasWorkflow: boolean;
}

interface DailyCallData {
  date: string;
  calls: number;
  answered: number;
}

interface AgentOverview {
  totalClients: number;
  activeAgents: number;
  totalCalls: number;
  answeredCalls: number;
  avgDuration: number;
  pendingSetup: number;
}

export default function VoiceAgentPage() {
  const { admin, primaryColor } = useAdmin();
  const [overview, setOverview] = useState<AgentOverview | null>(null);
  const [clientStats, setClientStats] = useState<ClientAgentStats[]>([]);
  const [dailyCalls, setDailyCalls] = useState<DailyCallData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!admin) return;
    fetchData();
  }, [admin]);

  async function fetchData() {
    setLoading(true);
    try {
      await Promise.all([fetchOverview(), fetchClientStats(), fetchDailyCallTrend()]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchOverview() {
    if (!admin) return;

    const { data: clients } = await supabase
      .from("clients")
      .select("id")
      .eq("admin_id", admin.id)
      .eq("is_active", true);

    if (!clients?.length) {
      setOverview({ totalClients: 0, activeAgents: 0, totalCalls: 0, answeredCalls: 0, avgDuration: 0, pendingSetup: 0 });
      return;
    }

    const clientIds = clients.map((c) => c.id);

    // Get voice-agent service id
    const { data: voiceAgentService } = await supabase
      .from("services")
      .select("id")
      .eq("slug", "voice-agent")
      .maybeSingle();

    if (!voiceAgentService) {
      setOverview({ totalClients: 0, activeAgents: 0, totalCalls: 0, answeredCalls: 0, avgDuration: 0, pendingSetup: 0 });
      return;
    }

    const [workflowRes, callsRes] = await Promise.all([
      supabase
        .from("client_workflow_instances")
        .select("id, client_id, is_active, status")
        .in("client_id", clientIds)
        .eq("service_id", voiceAgentService.id),
      supabase
        .from("call_logs")
        .select("status, duration_seconds")
        .in("client_id", clientIds)
        .eq("call_type", "inbound"),
    ]);

    const workflows = workflowRes.data || [];
    const calls = callsRes.data || [];
    const activeAgents = workflows.filter((w) => w.is_active).length;
    const pendingSetup = workflows.filter((w) => w.status === "pending").length;
    const answeredCalls = calls.filter((c) => c.status === "answered" || c.status === "completed").length;
    const totalDuration = calls.reduce((s, c) => s + (c.duration_seconds || 0), 0);

    setOverview({
      totalClients: clients.length,
      activeAgents,
      totalCalls: calls.length,
      answeredCalls,
      avgDuration: calls.length > 0 ? Math.round(totalDuration / calls.length) : 0,
      pendingSetup,
    });
  }

  async function fetchClientStats() {
    if (!admin) return;

    const { data: clients } = await supabase
      .from("clients")
      .select("id, company_name, is_active, user_id")
      .eq("admin_id", admin.id)
      .order("company_name");

    if (!clients?.length) { setClientStats([]); return; }

    const clientIds = clients.map((c) => c.id);
    const userIds = clients.map((c) => c.user_id);

    const { data: voiceAgentService } = await supabase
      .from("services")
      .select("id")
      .eq("slug", "voice-agent")
      .maybeSingle();

    const [profilesRes, workflowsRes, callsRes] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name").in("user_id", userIds),
      voiceAgentService
        ? supabase
            .from("client_workflow_instances")
            .select("client_id, is_active")
            .in("client_id", clientIds)
            .eq("service_id", voiceAgentService.id)
        : Promise.resolve({ data: [] as any[] }),
      supabase
        .from("call_logs")
        .select("client_id, status, duration_seconds")
        .in("client_id", clientIds)
        .eq("call_type", "inbound"),
    ]);

    const profileMap = new Map(profilesRes.data?.map((p) => [p.user_id, p.full_name]) || []);
    const workflowMap = new Map<string, boolean>();
    (workflowsRes.data || []).forEach((w: any) => {
      if (w.is_active) workflowMap.set(w.client_id, true);
      else if (!workflowMap.has(w.client_id)) workflowMap.set(w.client_id, false);
    });

    const callsByClient = new Map<string, { total: number; answered: number; duration: number }>();
    (callsRes.data || []).forEach((c) => {
      const existing = callsByClient.get(c.client_id) || { total: 0, answered: 0, duration: 0 };
      existing.total++;
      if (c.status === "answered" || c.status === "completed") existing.answered++;
      existing.duration += c.duration_seconds || 0;
      callsByClient.set(c.client_id, existing);
    });

    setClientStats(
      clients.map((cl) => {
        const calls = callsByClient.get(cl.id) || { total: 0, answered: 0, duration: 0 };
        return {
          clientId: cl.id,
          companyName: cl.company_name,
          contactName: profileMap.get(cl.user_id) || null,
          totalCalls: calls.total,
          answeredCalls: calls.answered,
          avgDuration: calls.total > 0 ? Math.round(calls.duration / calls.total) : 0,
          isActive: cl.is_active,
          hasWorkflow: workflowMap.has(cl.id),
        };
      })
    );
  }

  async function fetchDailyCallTrend() {
    if (!admin) return;

    const { data: clients } = await supabase
      .from("clients")
      .select("id")
      .eq("admin_id", admin.id);

    if (!clients?.length) { setDailyCalls([]); return; }

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const { data: calls } = await supabase
      .from("call_logs")
      .select("executed_at, status")
      .in("client_id", clients.map((c) => c.id))
      .eq("call_type", "inbound")
      .gte("executed_at", fourteenDaysAgo.toISOString());

    const byDate = new Map<string, { calls: number; answered: number }>();
    (calls || []).forEach((c) => {
      const d = c.executed_at ? c.executed_at.split("T")[0] : null;
      if (!d) return;
      const ex = byDate.get(d) || { calls: 0, answered: 0 };
      ex.calls++;
      if (c.status === "answered" || c.status === "completed") ex.answered++;
      byDate.set(d, ex);
    });

    const trend: DailyCallData[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      const entry = byDate.get(key) || { calls: 0, answered: 0 };
      trend.push({ date: key, ...entry });
    }
    setDailyCalls(trend);
  }

  const chartConfig = {
    calls: { label: "Total Calls", color: primaryColor },
    answered: { label: "Answered", color: "hsl(var(--secondary))" },
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </div>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-[300px]" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  const answerRate = overview && overview.totalCalls > 0
    ? Math.round((overview.answeredCalls / overview.totalCalls) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
          <Bot className="h-6 w-6" style={{ color: primaryColor }} />
          AI Voice Agent
        </h1>
        <p className="text-sm text-muted-foreground">
          Monitor and manage AI voice agents across your clients
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Agents</p>
              <p className="text-2xl font-bold text-foreground">{overview?.activeAgents ?? 0}</p>
              <p className="text-xs text-muted-foreground">
                of {overview?.totalClients ?? 0} clients
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary/10">
              <PhoneCall className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Calls</p>
              <p className="text-2xl font-bold text-foreground">{overview?.totalCalls ?? 0}</p>
              <p className="text-xs text-muted-foreground">
                {overview?.answeredCalls ?? 0} answered
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent">
              <TrendingUp className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Answer Rate</p>
              <p className="text-2xl font-bold text-foreground">{answerRate}%</p>
              <p className="text-xs text-muted-foreground">across all agents</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Duration</p>
              <p className="text-2xl font-bold text-foreground">{formatDuration(overview?.avgDuration ?? 0)}</p>
              <p className="text-xs text-muted-foreground">per call avg</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Setup Alert */}
      {(overview?.pendingSetup ?? 0) > 0 && (
        <Card className="border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {overview?.pendingSetup} client(s) have voice agent workflows pending setup.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Call Trend Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Call Volume (Last 14 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyCalls.some((d) => d.calls > 0) ? (
            <ChartContainer config={chartConfig} className="h-[260px] w-full">
              <AreaChart data={dailyCalls} margin={{ left: 10, right: 10 }}>
                <defs>
                  <linearGradient id="callsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={primaryColor} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => format(new Date(v), "MMM d")}
                />
                <YAxis tick={{ fontSize: 10 }} />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  labelFormatter={(v) => format(new Date(v), "MMM d, yyyy")}
                />
                <Area
                  type="monotone"
                  dataKey="calls"
                  stroke={primaryColor}
                  fill="url(#callsGradient)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="answered"
                  stroke="hsl(var(--secondary))"
                  fill="transparent"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                />
              </AreaChart>
            </ChartContainer>
          ) : (
            <p className="text-sm text-muted-foreground py-10 text-center">
              No call data available yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Client Voice Agent Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Client Voice Agents</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {clientStats.length > 0 ? (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Agent Status</TableHead>
                      <TableHead className="text-right">Total Calls</TableHead>
                      <TableHead className="text-right">Answered</TableHead>
                      <TableHead className="text-right">Answer Rate</TableHead>
                      <TableHead className="text-right">Avg Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientStats.map((cs) => {
                      const rate = cs.totalCalls > 0
                        ? Math.round((cs.answeredCalls / cs.totalCalls) * 100)
                        : 0;
                      return (
                        <TableRow key={cs.clientId}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{cs.companyName}</p>
                              <p className="text-xs text-muted-foreground">{cs.contactName ?? "—"}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {!cs.hasWorkflow ? (
                              <Badge variant="outline" className="text-muted-foreground">Not Setup</Badge>
                            ) : cs.isActive ? (
                              <Badge variant="default">
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Active
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <XCircle className="h-3 w-3 mr-1" /> Inactive
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">{cs.totalCalls}</TableCell>
                          <TableCell className="text-right">{cs.answeredCalls}</TableCell>
                          <TableCell className="text-right">
                            <span className={rate >= 70 ? "text-emerald-600 dark:text-emerald-400" : rate >= 40 ? "text-amber-600 dark:text-amber-400" : "text-destructive"}>
                              {cs.totalCalls > 0 ? `${rate}%` : "—"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">{formatDuration(cs.avgDuration)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 p-4 md:hidden">
                {clientStats.map((cs) => {
                  const rate = cs.totalCalls > 0
                    ? Math.round((cs.answeredCalls / cs.totalCalls) * 100)
                    : 0;
                  return (
                    <div key={cs.clientId} className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{cs.companyName}</p>
                          <p className="text-xs text-muted-foreground">{cs.contactName ?? "—"}</p>
                        </div>
                        {!cs.hasWorkflow ? (
                          <Badge variant="outline" className="text-muted-foreground text-xs">Not Setup</Badge>
                        ) : cs.isActive ? (
                          <Badge variant="default" className="text-xs">Active</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">Inactive</Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t">
                        <div>
                          <p className="text-lg font-bold text-foreground">{cs.totalCalls}</p>
                          <p className="text-[10px] text-muted-foreground">Total Calls</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-foreground">
                            {cs.totalCalls > 0 ? `${rate}%` : "—"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Answer Rate</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-foreground">{formatDuration(cs.avgDuration)}</p>
                          <p className="text-[10px] text-muted-foreground">Avg Duration</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground p-6 text-center">
              No clients found. Add clients to start using AI Voice Agents.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return "0s";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

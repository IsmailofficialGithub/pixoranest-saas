import { useEffect, useState } from "react";
import { useAdmin } from "@/contexts/AdminContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  PhoneIncoming, Phone, Clock, Users, TrendingUp, AlertCircle,
  CheckCircle2, XCircle,
} from "lucide-react";
import { format } from "date-fns";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";

interface ClientStats {
  clientId: string;
  companyName: string;
  totalCalls: number;
  answeredCalls: number;
  avgDuration: number;
  hasWorkflow: boolean;
  isActive: boolean;
}

interface DailyData {
  date: string;
  calls: number;
  answered: number;
}

export default function AdminVoiceReceptionistPage() {
  const { admin, primaryColor } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ activeAgents: 0, totalCalls: 0, answeredCalls: 0, avgDuration: 0, pendingSetup: 0 });
  const [clientStats, setClientStats] = useState<ClientStats[]>([]);
  const [dailyCalls, setDailyCalls] = useState<DailyData[]>([]);

  useEffect(() => {
    if (!admin) return;
    fetchAll();
  }, [admin]);

  async function fetchAll() {
    setLoading(true);
    try {
      const { data: clients } = await supabase
        .from("clients").select("id, company_name, is_active")
        .eq("admin_id", admin!.id);
      if (!clients?.length) { setLoading(false); return; }

      const clientIds = clients.map(c => c.id);
      const { data: svc } = await supabase.from("services").select("id").eq("slug", "ai-voice-receptionist").maybeSingle();
      if (!svc) { setLoading(false); return; }

      const [wfRes, callsRes] = await Promise.all([
        supabase.from("client_workflow_instances").select("client_id, is_active, status")
          .in("client_id", clientIds).eq("service_id", svc.id),
        supabase.from("call_logs").select("client_id, status, duration_seconds, executed_at")
          .in("client_id", clientIds).eq("call_type", "inbound"),
      ]);

      const workflows = wfRes.data || [];
      const calls = callsRes.data || [];
      const activeAgents = workflows.filter(w => w.is_active).length;
      const pendingSetup = workflows.filter(w => w.status === "pending").length;
      const answered = calls.filter(c => c.status === "answered" || c.status === "completed").length;
      const totalDur = calls.reduce((s, c) => s + (c.duration_seconds || 0), 0);

      setStats({
        activeAgents,
        totalCalls: calls.length,
        answeredCalls: answered,
        avgDuration: calls.length > 0 ? Math.round(totalDur / calls.length) : 0,
        pendingSetup,
      });

      // Client stats
      const wfMap = new Map<string, { active: boolean; has: boolean }>();
      workflows.forEach(w => {
        const cur = wfMap.get(w.client_id);
        if (!cur) wfMap.set(w.client_id, { active: !!w.is_active, has: true });
        else if (w.is_active) cur.active = true;
      });
      const callMap = new Map<string, { total: number; answered: number; dur: number }>();
      calls.forEach(c => {
        const e = callMap.get(c.client_id) || { total: 0, answered: 0, dur: 0 };
        e.total++;
        if (c.status === "answered" || c.status === "completed") e.answered++;
        e.dur += c.duration_seconds || 0;
        callMap.set(c.client_id, e);
      });
      setClientStats(clients.map(cl => {
        const c = callMap.get(cl.id) || { total: 0, answered: 0, dur: 0 };
        const wf = wfMap.get(cl.id);
        return {
          clientId: cl.id,
          companyName: cl.company_name,
          totalCalls: c.total,
          answeredCalls: c.answered,
          avgDuration: c.total > 0 ? Math.round(c.dur / c.total) : 0,
          hasWorkflow: !!wf?.has,
          isActive: !!wf?.active,
        };
      }));

      // Daily trend
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      const byDate = new Map<string, { calls: number; answered: number }>();
      calls.forEach(c => {
        const d = c.executed_at?.split("T")[0];
        if (!d || new Date(d) < fourteenDaysAgo) return;
        const e = byDate.get(d) || { calls: 0, answered: 0 };
        e.calls++;
        if (c.status === "answered" || c.status === "completed") e.answered++;
        byDate.set(d, e);
      });
      const trend: DailyData[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const key = d.toISOString().split("T")[0];
        trend.push({ date: key, ...(byDate.get(key) || { calls: 0, answered: 0 }) });
      }
      setDailyCalls(trend);
    } finally {
      setLoading(false);
    }
  }

  const fmtDur = (s: number) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  const answerRate = stats.totalCalls > 0 ? Math.round((stats.answeredCalls / stats.totalCalls) * 100) : 0;
  const chartConfig = {
    calls: { label: "Total Calls", color: primaryColor },
    answered: { label: "Answered", color: "hsl(var(--secondary))" },
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
          <PhoneIncoming className="h-6 w-6" style={{ color: primaryColor }} />
          AI Voice Receptionist
        </h1>
        <p className="text-sm text-muted-foreground">Monitor inbound call handling across your clients</p>
      </div>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
          <div><p className="text-sm text-muted-foreground">Active Receptionists</p><p className="text-2xl font-bold">{stats.activeAgents}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary/10"><Phone className="h-5 w-5 text-secondary" /></div>
          <div><p className="text-sm text-muted-foreground">Total Inbound Calls</p><p className="text-2xl font-bold">{stats.totalCalls}</p><p className="text-xs text-muted-foreground">{stats.answeredCalls} answered</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent"><TrendingUp className="h-5 w-5 text-accent-foreground" /></div>
          <div><p className="text-sm text-muted-foreground">Answer Rate</p><p className="text-2xl font-bold">{answerRate}%</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10"><Clock className="h-5 w-5 text-primary" /></div>
          <div><p className="text-sm text-muted-foreground">Avg Duration</p><p className="text-2xl font-bold">{fmtDur(stats.avgDuration)}</p></div>
        </CardContent></Card>
      </div>

      {stats.pendingSetup > 0 && (
        <Card className="border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-200">{stats.pendingSetup} client(s) have receptionist workflows pending setup.</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-lg">Inbound Call Volume (Last 14 Days)</CardTitle></CardHeader>
        <CardContent>
          {dailyCalls.some(d => d.calls > 0) ? (
            <ChartContainer config={chartConfig} className="h-[260px] w-full">
              <AreaChart data={dailyCalls} margin={{ left: 10, right: 10 }}>
                <defs>
                  <linearGradient id="recCallsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={primaryColor} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => format(new Date(v), "MMM d")} />
                <YAxis tick={{ fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} labelFormatter={v => format(new Date(v), "MMM d, yyyy")} />
                <Area type="monotone" dataKey="calls" stroke={primaryColor} fill="url(#recCallsGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="answered" stroke="hsl(var(--secondary))" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
              </AreaChart>
            </ChartContainer>
          ) : (
            <p className="text-sm text-muted-foreground py-10 text-center">No call data available yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-lg">Client Receptionists</CardTitle></CardHeader>
        <CardContent className="p-0">
          {clientStats.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total Calls</TableHead>
                  <TableHead className="text-right">Answered</TableHead>
                  <TableHead className="text-right">Answer Rate</TableHead>
                  <TableHead className="text-right">Avg Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientStats.map(cs => {
                  const rate = cs.totalCalls > 0 ? Math.round((cs.answeredCalls / cs.totalCalls) * 100) : 0;
                  return (
                    <TableRow key={cs.clientId}>
                      <TableCell className="font-medium">{cs.companyName}</TableCell>
                      <TableCell>
                        {!cs.hasWorkflow ? <Badge variant="outline" className="text-muted-foreground">Not Setup</Badge>
                          : cs.isActive ? <Badge variant="default"><CheckCircle2 className="h-3 w-3 mr-1" />Active</Badge>
                          : <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Inactive</Badge>}
                      </TableCell>
                      <TableCell className="text-right font-medium">{cs.totalCalls}</TableCell>
                      <TableCell className="text-right">{cs.answeredCalls}</TableCell>
                      <TableCell className="text-right">
                        <span className={rate >= 70 ? "text-emerald-600" : rate >= 40 ? "text-amber-600" : "text-destructive"}>
                          {cs.totalCalls > 0 ? `${rate}%` : "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{fmtDur(cs.avgDuration)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground py-10 text-center">No clients with this service.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

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
  Phone, Users, Clock, TrendingUp, AlertCircle,
  CheckCircle2, XCircle, Target,
} from "lucide-react";
import { format } from "date-fns";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";

interface ClientStats {
  clientId: string;
  companyName: string;
  totalCampaigns: number;
  activeCampaigns: number;
  totalCalls: number;
  answeredCalls: number;
  avgDuration: number;
}

interface DailyData {
  date: string;
  calls: number;
  answered: number;
}

export default function AdminVoiceTelecallerPage() {
  const { admin, primaryColor } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState({ totalCampaigns: 0, activeCampaigns: 0, totalCalls: 0, answeredCalls: 0, avgDuration: 0 });
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
        .from("clients").select("id, company_name")
        .eq("admin_id", admin!.id);
      if (!clients?.length) { setLoading(false); return; }

      const clientIds = clients.map(c => c.id);

      const [campaignsRes, callsRes] = await Promise.all([
        supabase.from("voice_campaigns").select("id, client_id, status").in("client_id", clientIds),
        supabase.from("call_logs").select("client_id, status, duration_seconds, executed_at")
          .in("client_id", clientIds).eq("call_type", "outbound"),
      ]);

      const campaigns = campaignsRes.data || [];
      const calls = callsRes.data || [];
      const activeCampaigns = campaigns.filter(c => c.status === "running" || c.status === "scheduled").length;
      const answered = calls.filter(c => c.status === "answered" || c.status === "completed").length;
      const totalDur = calls.reduce((s, c) => s + (c.duration_seconds || 0), 0);

      setOverview({
        totalCampaigns: campaigns.length,
        activeCampaigns,
        totalCalls: calls.length,
        answeredCalls: answered,
        avgDuration: calls.length > 0 ? Math.round(totalDur / calls.length) : 0,
      });

      // Client stats
      const campByClient = new Map<string, { total: number; active: number }>();
      campaigns.forEach(c => {
        const e = campByClient.get(c.client_id) || { total: 0, active: 0 };
        e.total++;
        if (c.status === "running" || c.status === "scheduled") e.active++;
        campByClient.set(c.client_id, e);
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
        const camp = campByClient.get(cl.id) || { total: 0, active: 0 };
        const c = callMap.get(cl.id) || { total: 0, answered: 0, dur: 0 };
        return {
          clientId: cl.id,
          companyName: cl.company_name,
          totalCampaigns: camp.total,
          activeCampaigns: camp.active,
          totalCalls: c.total,
          answeredCalls: c.answered,
          avgDuration: c.total > 0 ? Math.round(c.dur / c.total) : 0,
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
  const answerRate = overview.totalCalls > 0 ? Math.round((overview.answeredCalls / overview.totalCalls) * 100) : 0;
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
          <Phone className="h-6 w-6" style={{ color: primaryColor }} />
          AI Voice Telecaller
        </h1>
        <p className="text-sm text-muted-foreground">Monitor outbound calling campaigns across your clients</p>
      </div>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10"><Target className="h-5 w-5 text-primary" /></div>
          <div><p className="text-sm text-muted-foreground">Active Campaigns</p><p className="text-2xl font-bold">{overview.activeCampaigns}</p><p className="text-xs text-muted-foreground">of {overview.totalCampaigns} total</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary/10"><Phone className="h-5 w-5 text-secondary" /></div>
          <div><p className="text-sm text-muted-foreground">Total Outbound Calls</p><p className="text-2xl font-bold">{overview.totalCalls}</p><p className="text-xs text-muted-foreground">{overview.answeredCalls} answered</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent"><TrendingUp className="h-5 w-5 text-accent-foreground" /></div>
          <div><p className="text-sm text-muted-foreground">Answer Rate</p><p className="text-2xl font-bold">{answerRate}%</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10"><Clock className="h-5 w-5 text-primary" /></div>
          <div><p className="text-sm text-muted-foreground">Avg Duration</p><p className="text-2xl font-bold">{fmtDur(overview.avgDuration)}</p></div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-lg">Outbound Call Volume (Last 14 Days)</CardTitle></CardHeader>
        <CardContent>
          {dailyCalls.some(d => d.calls > 0) ? (
            <ChartContainer config={chartConfig} className="h-[260px] w-full">
              <AreaChart data={dailyCalls} margin={{ left: 10, right: 10 }}>
                <defs>
                  <linearGradient id="tcCallsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={primaryColor} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => format(new Date(v), "MMM d")} />
                <YAxis tick={{ fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} labelFormatter={v => format(new Date(v), "MMM d, yyyy")} />
                <Area type="monotone" dataKey="calls" stroke={primaryColor} fill="url(#tcCallsGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="answered" stroke="hsl(var(--secondary))" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
              </AreaChart>
            </ChartContainer>
          ) : (
            <p className="text-sm text-muted-foreground py-10 text-center">No outbound call data yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-lg">Client Telecaller Overview</CardTitle></CardHeader>
        <CardContent className="p-0">
          {clientStats.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Campaigns</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Answered</TableHead>
                  <TableHead className="text-right">Avg Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientStats.map(cs => (
                  <TableRow key={cs.clientId}>
                    <TableCell className="font-medium">{cs.companyName}</TableCell>
                    <TableCell className="text-right">{cs.totalCampaigns}</TableCell>
                    <TableCell className="text-right">
                      {cs.activeCampaigns > 0 ? <Badge variant="default">{cs.activeCampaigns}</Badge> : <span className="text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell className="text-right font-medium">{cs.totalCalls}</TableCell>
                    <TableCell className="text-right">{cs.answeredCalls}</TableCell>
                    <TableCell className="text-right">{fmtDur(cs.avgDuration)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground py-10 text-center">No clients with telecaller campaigns.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

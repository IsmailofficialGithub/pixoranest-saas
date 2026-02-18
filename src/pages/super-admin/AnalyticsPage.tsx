import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  DollarSign, PhoneCall, MessageSquare, Users, TrendingUp, TrendingDown,
  RefreshCw, Download, CalendarIcon,
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay, differenceInDays } from "date-fns";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type DateRange = { from: Date; to: Date };

function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

const presets = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [preset, setPreset] = useState("30");
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const dateRange = useMemo<DateRange>(() => {
    if (customRange) return customRange;
    const days = Number(preset);
    return { from: startOfDay(subDays(new Date(), days)), to: endOfDay(new Date()) };
  }, [preset, customRange]);

  const prevRange = useMemo<DateRange>(() => {
    const span = differenceInDays(dateRange.to, dateRange.from);
    return { from: subDays(dateRange.from, span), to: subDays(dateRange.from, 1) };
  }, [dateRange]);

  // Data states
  const [metrics, setMetrics] = useState({ revenue: 0, prevRevenue: 0, calls: 0, prevCalls: 0, messages: 0, prevMessages: 0, activeClients: 0, prevActiveClients: 0 });
  const [revenueChart, setRevenueChart] = useState<{ date: string; revenue: number }[]>([]);
  const [usageChart, setUsageChart] = useState<{ category: string; count: number }[]>([]);
  const [topAdmins, setTopAdmins] = useState<any[]>([]);
  const [topClients, setTopClients] = useState<any[]>([]);

  const isoFrom = (d: Date) => d.toISOString();
  const dateFrom = (d: Date) => format(d, "yyyy-MM-dd");

  const fetchMetrics = useCallback(async () => {
    const [from, to] = [isoFrom(dateRange.from), isoFrom(dateRange.to)];
    const [pFrom, pTo] = [isoFrom(prevRange.from), isoFrom(prevRange.to)];

    // Revenue
    const [revCur, revPrev] = await Promise.all([
      supabase.from("invoices").select("total_amount").eq("status", "paid").gte("invoice_date", dateFrom(dateRange.from)).lte("invoice_date", dateFrom(dateRange.to)),
      supabase.from("invoices").select("total_amount").eq("status", "paid").gte("invoice_date", dateFrom(prevRange.from)).lte("invoice_date", dateFrom(prevRange.to)),
    ]);
    const revenue = (revCur.data ?? []).reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
    const prevRevenue = (revPrev.data ?? []).reduce((s, r) => s + Number(r.total_amount ?? 0), 0);

    // Calls
    const [callsCur, callsPrev] = await Promise.all([
      supabase.from("call_logs").select("id", { count: "exact", head: true }).gte("executed_at", from).lte("executed_at", to),
      supabase.from("call_logs").select("id", { count: "exact", head: true }).gte("executed_at", pFrom).lte("executed_at", pTo),
    ]);

    // Messages
    const [msgCur, msgPrev] = await Promise.all([
      supabase.from("whatsapp_messages").select("id", { count: "exact", head: true }).gte("sent_at", from).lte("sent_at", to),
      supabase.from("whatsapp_messages").select("id", { count: "exact", head: true }).gte("sent_at", pFrom).lte("sent_at", pTo),
    ]);

    // Active clients
    const [callClients, msgClients, postClients] = await Promise.all([
      supabase.from("call_logs").select("client_id").gte("executed_at", from).lte("executed_at", to),
      supabase.from("whatsapp_messages").select("client_id").gte("sent_at", from).lte("sent_at", to),
      supabase.from("social_media_posts").select("client_id").gte("created_at", from).lte("created_at", to),
    ]);
    const activeSet = new Set([
      ...(callClients.data ?? []).map((r) => r.client_id),
      ...(msgClients.data ?? []).map((r) => r.client_id),
      ...(postClients.data ?? []).map((r) => r.client_id),
    ]);

    const [pCallClients, pMsgClients, pPostClients] = await Promise.all([
      supabase.from("call_logs").select("client_id").gte("executed_at", pFrom).lte("executed_at", pTo),
      supabase.from("whatsapp_messages").select("client_id").gte("sent_at", pFrom).lte("sent_at", pTo),
      supabase.from("social_media_posts").select("client_id").gte("created_at", pFrom).lte("created_at", pTo),
    ]);
    const prevActiveSet = new Set([
      ...(pCallClients.data ?? []).map((r) => r.client_id),
      ...(pMsgClients.data ?? []).map((r) => r.client_id),
      ...(pPostClients.data ?? []).map((r) => r.client_id),
    ]);

    setMetrics({
      revenue, prevRevenue,
      calls: callsCur.count ?? 0, prevCalls: callsPrev.count ?? 0,
      messages: msgCur.count ?? 0, prevMessages: msgPrev.count ?? 0,
      activeClients: activeSet.size, prevActiveClients: prevActiveSet.size,
    });
  }, [dateRange, prevRange]);

  const fetchRevenueChart = useCallback(async () => {
    const { data } = await supabase
      .from("invoices")
      .select("invoice_date, total_amount")
      .eq("status", "paid")
      .gte("invoice_date", dateFrom(dateRange.from))
      .lte("invoice_date", dateFrom(dateRange.to))
      .order("invoice_date", { ascending: true });

    const byDate: Record<string, number> = {};
    for (const r of data ?? []) {
      const d = r.invoice_date;
      byDate[d] = (byDate[d] ?? 0) + Number(r.total_amount ?? 0);
    }
    setRevenueChart(Object.entries(byDate).map(([date, revenue]) => ({ date, revenue })));
  }, [dateRange]);

  const fetchUsageChart = useCallback(async () => {
    const [from, to] = [isoFrom(dateRange.from), isoFrom(dateRange.to)];

    const [callsRes, msgsRes, postsRes] = await Promise.all([
      supabase.from("call_logs").select("id", { count: "exact", head: true }).gte("executed_at", from).lte("executed_at", to),
      supabase.from("whatsapp_messages").select("id", { count: "exact", head: true }).gte("sent_at", from).lte("sent_at", to),
      supabase.from("social_media_posts").select("id", { count: "exact", head: true }).gte("created_at", from).lte("created_at", to),
    ]);

    setUsageChart([
      { category: "Voice", count: callsRes.count ?? 0 },
      { category: "Messaging", count: msgsRes.count ?? 0 },
      { category: "Social Media", count: postsRes.count ?? 0 },
    ]);
  }, [dateRange]);

  const fetchTopAdmins = useCallback(async () => {
    const { data: admins } = await supabase.from("admins").select("id, company_name, commission_rate").eq("is_active", true);

    const enriched = await Promise.all(
      (admins ?? []).map(async (a) => {
        const [clientRes, invoiceRes] = await Promise.all([
          supabase.from("clients").select("id", { count: "exact", head: true }).eq("admin_id", a.id),
          supabase.from("invoices").select("total_amount").eq("admin_id", a.id).eq("status", "paid")
            .gte("invoice_date", dateFrom(dateRange.from)).lte("invoice_date", dateFrom(dateRange.to)),
        ]);
        const totalRevenue = (invoiceRes.data ?? []).reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
        return {
          ...a,
          client_count: clientRes.count ?? 0,
          total_revenue: totalRevenue,
          commission_earned: totalRevenue * (Number(a.commission_rate ?? 0) / 100),
        };
      })
    );

    enriched.sort((a, b) => b.total_revenue - a.total_revenue);
    setTopAdmins(enriched.slice(0, 10));
  }, [dateRange]);

  const fetchTopClients = useCallback(async () => {
    const [from, to] = [isoFrom(dateRange.from), isoFrom(dateRange.to)];

    const [calls, msgs, posts] = await Promise.all([
      supabase.from("call_logs").select("client_id").gte("executed_at", from).lte("executed_at", to),
      supabase.from("whatsapp_messages").select("client_id").gte("sent_at", from).lte("sent_at", to),
      supabase.from("social_media_posts").select("client_id").gte("created_at", from).lte("created_at", to),
    ]);

    const counts: Record<string, number> = {};
    for (const r of [...(calls.data ?? []), ...(msgs.data ?? []), ...(posts.data ?? [])]) {
      counts[r.client_id] = (counts[r.client_id] ?? 0) + 1;
    }

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);

    const enriched = await Promise.all(
      sorted.map(async ([clientId, total_usage]) => {
        const { data: client } = await supabase.from("clients").select("company_name, admin_id").eq("id", clientId).single();
        const { data: admin } = await supabase.from("admins").select("company_name").eq("id", client?.admin_id ?? "").maybeSingle();
        return {
          id: clientId,
          company_name: client?.company_name ?? "Unknown",
          admin_company: admin?.company_name ?? "—",
          total_usage,
        };
      })
    );

    setTopClients(enriched);
  }, [dateRange]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchMetrics(), fetchRevenueChart(), fetchUsageChart(), fetchTopAdmins(), fetchTopClients()]);
    setLoading(false);
  }, [fetchMetrics, fetchRevenueChart, fetchUsageChart, fetchTopAdmins, fetchTopClients]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
    toast({ title: "Data refreshed" });
  };

  const trendPct = (cur: number, prev: number) => {
    if (prev === 0) return cur > 0 ? 100 : 0;
    return ((cur - prev) / prev) * 100;
  };

  const TrendBadge = ({ current, previous }: { current: number; previous: number }) => {
    const pct = trendPct(current, previous);
    const up = pct >= 0;
    return (
      <div className={`flex items-center gap-1 text-xs font-medium ${up ? "text-green-600" : "text-red-600"}`}>
        {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {Math.abs(pct).toFixed(1)}%
      </div>
    );
  };

  const handleExport = () => {
    const lines: string[] = [];
    lines.push("Platform Analytics Report");
    lines.push(`Period: ${format(dateRange.from, "MMM d, yyyy")} - ${format(dateRange.to, "MMM d, yyyy")}`);
    lines.push("");
    lines.push("Key Metrics");
    lines.push(`Total Revenue,${metrics.revenue}`);
    lines.push(`Total Calls,${metrics.calls}`);
    lines.push(`Total Messages,${metrics.messages}`);
    lines.push(`Active Clients,${metrics.activeClients}`);
    lines.push("");
    lines.push("Revenue by Date");
    lines.push("Date,Revenue");
    revenueChart.forEach((r) => lines.push(`${r.date},${r.revenue}`));
    lines.push("");
    lines.push("Usage by Category");
    lines.push("Category,Count");
    usageChart.forEach((u) => lines.push(`${u.category},${u.count}`));
    lines.push("");
    lines.push("Top Admins");
    lines.push("Company,Clients,Revenue,Commission Rate,Commission Earned");
    topAdmins.forEach((a) => lines.push(`${a.company_name},${a.client_count},${a.total_revenue},${a.commission_rate}%,${a.commission_earned.toFixed(2)}`));
    lines.push("");
    lines.push("Top Clients");
    lines.push("Company,Admin,Total Usage");
    topClients.forEach((c) => lines.push(`${c.company_name},${c.admin_company},${c.total_usage}`));

    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${format(dateRange.from, "yyyy-MM-dd")}-to-${format(dateRange.to, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Report exported" });
  };

  const barColors: Record<string, string> = {
    Voice: "hsl(217, 91%, 60%)",
    Messaging: "hsl(142, 71%, 45%)",
    "Social Media": "hsl(271, 91%, 65%)",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Platform Analytics</h1>
          <p className="text-sm text-muted-foreground">
            {format(dateRange.from, "MMM d, yyyy")} — {format(dateRange.to, "MMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={customRange ? "custom" : preset}
            onValueChange={(v) => {
              if (v !== "custom") { setCustomRange(null); setPreset(v); }
            }}
          >
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {presets.map((p) => (
                <SelectItem key={p.days} value={String(p.days)}>{p.label}</SelectItem>
              ))}
              {customRange && <SelectItem value="custom">Custom Range</SelectItem>}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon"><CalendarIcon className="h-4 w-4" /></Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    setCustomRange({ from: startOfDay(range.from), to: endOfDay(range.to) });
                  }
                }}
                numberOfMonths={2}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <DollarSign className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold text-foreground">{formatINR(metrics.revenue)}</p>
                <TrendBadge current={metrics.revenue} previous={metrics.prevRevenue} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <PhoneCall className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Calls</p>
                <p className="text-2xl font-bold text-foreground">{metrics.calls.toLocaleString()}</p>
                <TrendBadge current={metrics.calls} previous={metrics.prevCalls} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-50 text-green-600">
                <MessageSquare className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Messages</p>
                <p className="text-2xl font-bold text-foreground">{metrics.messages.toLocaleString()}</p>
                <TrendBadge current={metrics.messages} previous={metrics.prevMessages} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Clients</p>
                <p className="text-2xl font-bold text-foreground">{metrics.activeClients}</p>
                <TrendBadge current={metrics.activeClients} previous={metrics.prevActiveClients} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      {loading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
          <Card><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Revenue Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trend</CardTitle>
              <CardDescription>Daily paid invoice revenue</CardDescription>
            </CardHeader>
            <CardContent>
              {revenueChart.length === 0 ? (
                <p className="py-12 text-center text-muted-foreground">No revenue data for this period.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={revenueChart}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d), "MMM d")} className="text-xs" />
                    <YAxis tickFormatter={(v) => `₹${v}`} className="text-xs" />
                    <Tooltip
                      formatter={(value: number) => [formatINR(value), "Revenue"]}
                      labelFormatter={(d) => format(new Date(d), "MMM d, yyyy")}
                      contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }}
                    />
                    <Line type="monotone" dataKey="revenue" stroke="hsl(217, 91%, 60%)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Usage Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Service Usage by Category</CardTitle>
              <CardDescription>Total interactions per category</CardDescription>
            </CardHeader>
            <CardContent>
              {usageChart.every((u) => u.count === 0) ? (
                <p className="py-12 text-center text-muted-foreground">No usage data for this period.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={usageChart}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="category" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }} />
                    <Bar dataKey="count" name="Usage" radius={[4, 4, 0, 0]} fill="hsl(217, 91%, 60%)">
                      {usageChart.map((entry, index) => (
                        <rect key={index} fill={barColors[entry.category] ?? "hsl(217, 91%, 60%)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tables */}
      {loading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card><CardContent className="p-6"><Skeleton className="h-48 w-full" /></CardContent></Card>
          <Card><CardContent className="p-6"><Skeleton className="h-48 w-full" /></CardContent></Card>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top Admins */}
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Admins</CardTitle>
              <CardDescription>By revenue in selected period</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {topAdmins.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted-foreground">No admin revenue data.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead className="text-center">Clients</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topAdmins.map((a, i) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{a.company_name}</TableCell>
                        <TableCell className="text-center"><Badge variant="secondary">{a.client_count}</Badge></TableCell>
                        <TableCell className="text-right">{formatINR(a.total_revenue)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatINR(a.commission_earned)} ({a.commission_rate}%)
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Top Clients */}
          <Card>
            <CardHeader>
              <CardTitle>Most Active Clients</CardTitle>
              <CardDescription>By total usage in selected period</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {topClients.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted-foreground">No client usage data.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Admin</TableHead>
                      <TableHead className="text-right">Total Usage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topClients.map((c, i) => (
                      <TableRow
                        key={c.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/super-admin/clients/${c.id}`)}
                      >
                        <TableCell className="font-medium text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{c.company_name}</TableCell>
                        <TableCell className="text-muted-foreground">{c.admin_company}</TableCell>
                        <TableCell className="text-right"><Badge variant="secondary">{c.total_usage}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

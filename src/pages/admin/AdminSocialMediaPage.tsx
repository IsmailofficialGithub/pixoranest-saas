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
  Share2, Users, FileText, CheckCircle, TrendingUp, Clock,
} from "lucide-react";
import { format } from "date-fns";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";

interface ClientStats {
  clientId: string;
  companyName: string;
  totalPosts: number;
  published: number;
  scheduled: number;
  failed: number;
}

interface DailyData {
  date: string;
  posts: number;
  published: number;
}

export default function AdminSocialMediaPage() {
  const { admin, primaryColor } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState({ totalPosts: 0, published: 0, scheduled: 0, failed: 0, activeClients: 0 });
  const [clientStats, setClientStats] = useState<ClientStats[]>([]);
  const [dailyPosts, setDailyPosts] = useState<DailyData[]>([]);

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

      const { data: posts } = await supabase
        .from("social_media_posts")
        .select("client_id, status, created_at, posted_at")
        .in("client_id", clientIds);

      const allPosts = posts || [];
      const published = allPosts.filter(p => p.status === "posted").length;
      const scheduled = allPosts.filter(p => p.status === "scheduled").length;
      const failed = allPosts.filter(p => p.status === "failed").length;
      const clientsWithPosts = new Set(allPosts.map(p => p.client_id));

      setOverview({
        totalPosts: allPosts.length,
        published,
        scheduled,
        failed,
        activeClients: clientsWithPosts.size,
      });

      // Client stats
      const byClient = new Map<string, { total: number; published: number; scheduled: number; failed: number }>();
      allPosts.forEach(p => {
        const e = byClient.get(p.client_id) || { total: 0, published: 0, scheduled: 0, failed: 0 };
        e.total++;
        if (p.status === "posted") e.published++;
        if (p.status === "scheduled") e.scheduled++;
        if (p.status === "failed") e.failed++;
        byClient.set(p.client_id, e);
      });

      setClientStats(clients.map(cl => {
        const s = byClient.get(cl.id) || { total: 0, published: 0, scheduled: 0, failed: 0 };
        return { clientId: cl.id, companyName: cl.company_name, totalPosts: s.total, published: s.published, scheduled: s.scheduled, failed: s.failed };
      }));

      // Daily trend
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      const byDate = new Map<string, { posts: number; published: number }>();
      allPosts.forEach(p => {
        const d = (p.posted_at || p.created_at)?.split("T")[0];
        if (!d || new Date(d) < fourteenDaysAgo) return;
        const e = byDate.get(d) || { posts: 0, published: 0 };
        e.posts++;
        if (p.status === "posted") e.published++;
        byDate.set(d, e);
      });
      const trend: DailyData[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const key = d.toISOString().split("T")[0];
        trend.push({ date: key, ...(byDate.get(key) || { posts: 0, published: 0 }) });
      }
      setDailyPosts(trend);
    } finally {
      setLoading(false);
    }
  }

  const publishRate = overview.totalPosts > 0 ? Math.round((overview.published / overview.totalPosts) * 100) : 0;
  const chartConfig = {
    posts: { label: "Total Posts", color: primaryColor },
    published: { label: "Published", color: "hsl(var(--secondary))" },
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
          <Share2 className="h-6 w-6" style={{ color: primaryColor }} />
          Social Media Automation
        </h1>
        <p className="text-sm text-muted-foreground">Monitor social media posting across your clients</p>
      </div>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
          <div><p className="text-sm text-muted-foreground">Active Clients</p><p className="text-2xl font-bold">{overview.activeClients}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary/10"><FileText className="h-5 w-5 text-secondary" /></div>
          <div><p className="text-sm text-muted-foreground">Total Posts</p><p className="text-2xl font-bold">{overview.totalPosts}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent"><CheckCircle className="h-5 w-5 text-accent-foreground" /></div>
          <div><p className="text-sm text-muted-foreground">Publish Rate</p><p className="text-2xl font-bold">{publishRate}%</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10"><Clock className="h-5 w-5 text-primary" /></div>
          <div><p className="text-sm text-muted-foreground">Scheduled</p><p className="text-2xl font-bold">{overview.scheduled}</p></div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-lg">Post Volume (Last 14 Days)</CardTitle></CardHeader>
        <CardContent>
          {dailyPosts.some(d => d.posts > 0) ? (
            <ChartContainer config={chartConfig} className="h-[260px] w-full">
              <AreaChart data={dailyPosts} margin={{ left: 10, right: 10 }}>
                <defs>
                  <linearGradient id="smPostsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={primaryColor} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => format(new Date(v), "MMM d")} />
                <YAxis tick={{ fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} labelFormatter={v => format(new Date(v), "MMM d, yyyy")} />
                <Area type="monotone" dataKey="posts" stroke={primaryColor} fill="url(#smPostsGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="published" stroke="hsl(var(--secondary))" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
              </AreaChart>
            </ChartContainer>
          ) : (
            <p className="text-sm text-muted-foreground py-10 text-center">No post data yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-lg">Client Social Media Overview</CardTitle></CardHeader>
        <CardContent className="p-0">
          {clientStats.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Total Posts</TableHead>
                  <TableHead className="text-right">Published</TableHead>
                  <TableHead className="text-right">Scheduled</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientStats.map(cs => (
                  <TableRow key={cs.clientId}>
                    <TableCell className="font-medium">{cs.companyName}</TableCell>
                    <TableCell className="text-right font-medium">{cs.totalPosts}</TableCell>
                    <TableCell className="text-right">{cs.published}</TableCell>
                    <TableCell className="text-right">{cs.scheduled}</TableCell>
                    <TableCell className="text-right">
                      {cs.failed > 0 ? <span className="text-destructive">{cs.failed}</span> : "0"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground py-10 text-center">No social media data yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

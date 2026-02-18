import { useEffect, useState, useCallback } from "react";
import { useClient } from "@/contexts/ClientContext";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Calendar, CheckCircle, Heart, TrendingUp, PlusCircle,
  MoreVertical, Eye, Trash2, Copy, Edit, ChevronLeft,
  ChevronRight, LayoutGrid, List, Clock, Image, Video,
  FileText, Send, X, Globe, RefreshCw, AlertCircle,
} from "lucide-react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth,
  addMonths, subMonths, startOfWeek, endOfWeek, isToday, isBefore, parseISO,
} from "date-fns";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, Legend,
} from "recharts";

/* ─── Types ─── */
interface SocialPost {
  id: string;
  platform: string;
  post_type: string | null;
  content: string;
  media_urls: string[] | null;
  hashtags: string[] | null;
  status: string;
  scheduled_at: string | null;
  posted_at: string | null;
  engagement_stats: any;
  error_message: string | null;
  created_at: string;
}

interface Stats {
  scheduled: number;
  published: number;
  totalEngagement: number;
  topPost: SocialPost | null;
}

const PLATFORMS = [
  { key: "facebook", label: "Facebook", icon: "📘", color: "#1877F2" },
  { key: "instagram", label: "Instagram", icon: "📸", color: "#E4405F" },
  { key: "linkedin", label: "LinkedIn", icon: "💼", color: "#0A66C2" },
  { key: "twitter", label: "Twitter/X", icon: "🐦", color: "#1DA1F2" },
] as const;

const CHAR_LIMITS: Record<string, number> = {
  facebook: 63206,
  instagram: 2200,
  linkedin: 3000,
  twitter: 280,
};

const POST_TYPES = [
  { key: "text", label: "Text Only", icon: <FileText className="h-4 w-4" /> },
  { key: "image", label: "Image Post", icon: <Image className="h-4 w-4" /> },
  { key: "video", label: "Video Post", icon: <Video className="h-4 w-4" /> },
  { key: "carousel", label: "Carousel", icon: <LayoutGrid className="h-4 w-4" /> },
];

/* ─── Main Component ─── */
export default function SocialMediaPage() {
  const { client, assignedServices, isLoading: contextLoading } = useClient();
  const { toast } = useToast();

  const [stats, setStats] = useState<Stats | null>(null);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"calendar" | "list" | "analytics">("calendar");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null);
  const [detailPost, setDetailPost] = useState<SocialPost | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const smService = assignedServices.find(s => s.service_slug === "social-media-automation");

  const fetchAll = useCallback(async () => {
    if (!client) return;
    setIsLoading(true);
    await Promise.all([fetchStats(), fetchPosts()]);
    setIsLoading(false);
  }, [client]);

  async function fetchStats() {
    if (!client) return;
    const monthStart = startOfMonth(new Date()).toISOString();

    const [scheduledRes, publishedRes, engagementRes, topRes] = await Promise.all([
      supabase.from("social_media_posts").select("id", { count: "exact", head: true }).eq("client_id", client.id).eq("status", "scheduled"),
      supabase.from("social_media_posts").select("id", { count: "exact", head: true }).eq("client_id", client.id).eq("status", "posted").gte("posted_at", monthStart),
      supabase.from("social_media_posts").select("engagement_stats").eq("client_id", client.id).eq("status", "posted").gte("posted_at", monthStart),
      supabase.from("social_media_posts").select("*").eq("client_id", client.id).eq("status", "posted").order("posted_at", { ascending: false }).limit(1),
    ]);

    let totalEng = 0;
    engagementRes.data?.forEach(p => {
      const s = p.engagement_stats as any;
      if (s) {
        totalEng += (parseInt(s.likes) || 0) + (parseInt(s.comments) || 0) + (parseInt(s.shares) || 0);
      }
    });

    // Find top post by engagement
    let topPost: SocialPost | null = null;
    if (topRes.data && topRes.data.length > 0) {
      topPost = topRes.data[0] as SocialPost;
    }

    setStats({
      scheduled: scheduledRes.count || 0,
      published: publishedRes.count || 0,
      totalEngagement: totalEng,
      topPost,
    });
  }

  async function fetchPosts() {
    if (!client) return;
    const { data } = await supabase
      .from("social_media_posts")
      .select("*")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(200);
    setPosts((data as SocialPost[]) || []);
  }

  useEffect(() => {
    if (!client || contextLoading || !smService) return;
    fetchAll();
  }, [client, contextLoading, smService]);

  if (contextLoading || isLoading) return <LoadingSkeleton />;
  if (!smService) return <Navigate to="/client" replace />;

  const formatEngagement = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Social Media Automation</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage and schedule posts across all platforms</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" onClick={() => { setEditingPost(null); setCreateModalOpen(true); }}>
            <PlusCircle className="h-4 w-4 mr-1" /> Create Post
          </Button>
        </div>
      </div>

      {/* Connected Platforms */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {PLATFORMS.map(p => (
          <Card key={p.key} className="min-w-[160px] shrink-0">
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <span className="text-2xl">{p.icon}</span>
              <div>
                <p className="text-sm font-medium text-foreground">{p.label}</p>
                <Badge variant="outline" className="text-[10px] mt-0.5">Not Connected</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatsCard icon={<Calendar className="h-5 w-5" />} color="#3b82f6" label="Scheduled" value={stats?.scheduled ?? 0} sub="Upcoming posts" />
        <StatsCard icon={<CheckCircle className="h-5 w-5" />} color="#22c55e" label="Published" value={stats?.published ?? 0} sub="This month" />
        <StatsCard icon={<Heart className="h-5 w-5" />} color="#ef4444" label="Engagement" value={formatEngagement(stats?.totalEngagement ?? 0)} sub="Likes, comments, shares" />
        <StatsCard icon={<TrendingUp className="h-5 w-5" />} color="#f59e0b" label="Top Post" value={stats?.topPost ? "View →" : "—"} sub={stats?.topPost?.content?.slice(0, 30) || "No posts yet"} onClick={stats?.topPost ? () => setDetailPost(stats.topPost) : undefined} />
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-2">
        <Button variant={viewMode === "calendar" ? "default" : "outline"} size="sm" onClick={() => setViewMode("calendar")}><Calendar className="h-4 w-4 mr-1" /> Calendar</Button>
        <Button variant={viewMode === "list" ? "default" : "outline"} size="sm" onClick={() => setViewMode("list")}><List className="h-4 w-4 mr-1" /> List</Button>
        <Button variant={viewMode === "analytics" ? "default" : "outline"} size="sm" onClick={() => setViewMode("analytics")}><TrendingUp className="h-4 w-4 mr-1" /> Analytics</Button>
      </div>

      {viewMode === "calendar" && <CalendarView posts={posts} month={calendarMonth} setMonth={setCalendarMonth} onDayClick={(day) => {}} onPostClick={setDetailPost} />}
      {viewMode === "list" && <ListView posts={posts} onEdit={p => { setEditingPost(p); setCreateModalOpen(true); }} onView={setDetailPost} onDelete={async (id) => { await supabase.from("social_media_posts").delete().eq("id", id); fetchPosts(); fetchStats(); }} />}
      {viewMode === "analytics" && <AnalyticsView posts={posts} />}

      {/* Empty State */}
      {posts.length === 0 && !isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-5 mb-4"><Globe className="h-10 w-10 text-muted-foreground" /></div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Start building your social media presence</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">Create and schedule posts across all your platforms</p>
            <Button onClick={() => setCreateModalOpen(true)}><PlusCircle className="h-4 w-4 mr-2" /> Create First Post</Button>
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      <CreatePostModal open={createModalOpen} onOpenChange={setCreateModalOpen} clientId={client?.id || ""} existingPost={editingPost} onSaved={() => { fetchPosts(); fetchStats(); setEditingPost(null); }} />
      <PostDetailModal post={detailPost} onClose={() => setDetailPost(null)} onEdit={p => { setDetailPost(null); setEditingPost(p); setCreateModalOpen(true); }} />
    </div>
  );
}

/* ─── Stats Card ─── */
function StatsCard({ icon, color, label, value, sub, onClick }: { icon: React.ReactNode; color: string; label: string; value: string | number; sub: string; onClick?: () => void }) {
  return (
    <Card className={onClick ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""} onClick={onClick}>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg p-2.5" style={{ backgroundColor: `${color}15` }}><div style={{ color }}>{icon}</div></div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold text-foreground">{value}</p>
            <p className="text-[10px] text-muted-foreground truncate">{sub}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Calendar View ─── */
function CalendarView({ posts, month, setMonth, onDayClick, onPostClick }: {
  posts: SocialPost[]; month: Date; setMonth: (d: Date) => void; onDayClick: (d: Date) => void; onPostClick: (p: SocialPost) => void;
}) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const getPostsForDay = (day: Date) => posts.filter(p => {
    const d = p.scheduled_at || p.posted_at || p.created_at;
    return d && isSameDay(parseISO(d), day);
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth(subMonths(month, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <CardTitle className="text-base">{format(month, "MMMM yyyy")}</CardTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setMonth(new Date())}>Today</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-px">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
          ))}
          {days.map((day, i) => {
            const dayPosts = getPostsForDay(day);
            const inMonth = isSameMonth(day, month);
            return (
              <div
                key={i}
                className={`min-h-[80px] border rounded-md p-1 cursor-pointer hover:bg-muted/50 transition-colors ${!inMonth ? "opacity-40" : ""} ${isToday(day) ? "ring-2 ring-primary" : ""}`}
                onClick={() => onDayClick(day)}
              >
                <p className={`text-xs font-medium mb-1 ${isToday(day) ? "text-primary" : "text-foreground"}`}>{format(day, "d")}</p>
                <div className="space-y-0.5">
                  {dayPosts.slice(0, 3).map(p => (
                    <div
                      key={p.id}
                      className="text-[9px] rounded px-1 py-0.5 truncate cursor-pointer"
                      style={{ backgroundColor: getPlatformColor(p.platform) + "20", color: getPlatformColor(p.platform) }}
                      onClick={e => { e.stopPropagation(); onPostClick(p); }}
                    >
                      {getPlatformIcon(p.platform)} {p.content.slice(0, 20)}
                    </div>
                  ))}
                  {dayPosts.length > 3 && <p className="text-[9px] text-muted-foreground">+{dayPosts.length - 3} more</p>}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── List View ─── */
function ListView({ posts, onEdit, onView, onDelete }: {
  posts: SocialPost[]; onEdit: (p: SocialPost) => void; onView: (p: SocialPost) => void; onDelete: (id: string) => void;
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        {posts.length > 0 ? (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Content</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Engagement</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {posts.map(p => (
                    <TableRow key={p.id} className="cursor-pointer" onClick={() => onView(p)}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {p.media_urls && p.media_urls.length > 0 && <Image className="h-4 w-4 text-muted-foreground shrink-0" />}
                          <p className="text-sm truncate max-w-[250px]">{p.content}</p>
                        </div>
                      </TableCell>
                      <TableCell><PlatformBadge platform={p.platform} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.posted_at ? format(parseISO(p.posted_at), "MMM d, h:mm a") : p.scheduled_at ? format(parseISO(p.scheduled_at), "MMM d, h:mm a") : "—"}</TableCell>
                      <TableCell><PostStatusBadge status={p.status} /></TableCell>
                      <TableCell>{p.status === "posted" ? <EngagementMini stats={p.engagement_stats} /> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => e.stopPropagation()}><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={e => { e.stopPropagation(); onView(p); }}><Eye className="h-3 w-3 mr-2" /> View</DropdownMenuItem>
                            {(p.status === "draft" || p.status === "scheduled") && <DropdownMenuItem onClick={e => { e.stopPropagation(); onEdit(p); }}><Edit className="h-3 w-3 mr-2" /> Edit</DropdownMenuItem>}
                            <DropdownMenuItem onClick={e => { e.stopPropagation(); onEdit({ ...p, id: "" }); }}><Copy className="h-3 w-3 mr-2" /> Duplicate</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={e => { e.stopPropagation(); onDelete(p.id); }}><Trash2 className="h-3 w-3 mr-2" /> Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="space-y-3 md:hidden">
              {posts.map(p => (
                <div key={p.id} className="rounded-lg border p-3 space-y-2 cursor-pointer" onClick={() => onView(p)}>
                  <div className="flex items-center justify-between">
                    <PlatformBadge platform={p.platform} />
                    <PostStatusBadge status={p.status} />
                  </div>
                  <p className="text-sm line-clamp-2">{p.content}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    {p.status === "posted" && <EngagementMini stats={p.engagement_stats} />}
                    <span>{p.posted_at || p.scheduled_at ? formatDistanceToNow(parseISO(p.posted_at || p.scheduled_at!), { addSuffix: true }) : ""}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-10"><p className="text-sm text-muted-foreground">No posts yet</p></div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Analytics View ─── */
function AnalyticsView({ posts }: { posts: SocialPost[] }) {
  const publishedPosts = posts.filter(p => p.status === "posted");

  // Posts by platform
  const platformCounts = PLATFORMS.map(pl => ({
    name: pl.label,
    count: publishedPosts.filter(p => p.platform === pl.key).length,
    fill: pl.color,
  }));

  // Engagement over time
  const engagementByDay = new Map<string, number>();
  publishedPosts.forEach(p => {
    if (!p.posted_at) return;
    const day = format(parseISO(p.posted_at), "MMM dd");
    const s = p.engagement_stats as any;
    const eng = s ? (parseInt(s.likes) || 0) + (parseInt(s.comments) || 0) + (parseInt(s.shares) || 0) : 0;
    engagementByDay.set(day, (engagementByDay.get(day) || 0) + eng);
  });
  const engagementData = Array.from(engagementByDay.entries()).map(([day, value]) => ({ day, engagement: value }));

  // Content performance
  const typePerf = POST_TYPES.map(t => {
    const typePosts = publishedPosts.filter(p => p.post_type === t.key);
    const totalEng = typePosts.reduce((sum, p) => {
      const s = p.engagement_stats as any;
      return sum + (s ? (parseInt(s.likes) || 0) + (parseInt(s.comments) || 0) + (parseInt(s.shares) || 0) : 0);
    }, 0);
    return { name: t.label, avg: typePosts.length > 0 ? Math.round(totalEng / typePosts.length) : 0 };
  });

  const totalEng = publishedPosts.reduce((sum, p) => {
    const s = p.engagement_stats as any;
    return sum + (s ? (parseInt(s.likes) || 0) + (parseInt(s.comments) || 0) + (parseInt(s.shares) || 0) : 0);
  }, 0);

  return (
    <div className="space-y-4">
      {/* Overview */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Total Published" value={publishedPosts.length} />
        <MiniStat label="Total Engagement" value={totalEng} />
        <MiniStat label="Avg per Post" value={publishedPosts.length > 0 ? Math.round(totalEng / publishedPosts.length) : 0} />
        <MiniStat label="Platforms Used" value={new Set(publishedPosts.map(p => p.platform)).size} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Posts by Platform</CardTitle></CardHeader>
          <CardContent>
            {platformCounts.some(p => p.count > 0) ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={platformCounts}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Posts">
                    {platformCounts.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center py-10">No data yet</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Engagement Over Time</CardTitle></CardHeader>
          <CardContent>
            {engagementData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={engagementData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="engagement" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center py-10">No data yet</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Content Type Performance (Avg Engagement)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={typePerf} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
              <Tooltip />
              <Bar dataKey="avg" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 text-center">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

/* ─── Create/Edit Post Modal ─── */
function CreatePostModal({ open, onOpenChange, clientId, existingPost, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; clientId: string; existingPost: SocialPost | null; onSaved: () => void;
}) {
  const { toast } = useToast();
  const isEdit = existingPost && existingPost.id;

  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(existingPost ? [existingPost.platform] : []);
  const [postType, setPostType] = useState(existingPost?.post_type || "text");
  const [content, setContent] = useState(existingPost?.content || "");
  const [hashtags, setHashtags] = useState(existingPost?.hashtags?.join(", ") || "");
  const [scheduleType, setScheduleType] = useState<"now" | "later" | "draft">(existingPost?.status === "draft" ? "draft" : existingPost?.scheduled_at ? "later" : "now");
  const [scheduledAt, setScheduledAt] = useState(existingPost?.scheduled_at ? format(parseISO(existingPost.scheduled_at), "yyyy-MM-dd'T'HH:mm") : "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existingPost) {
      setSelectedPlatforms([existingPost.platform]);
      setPostType(existingPost.post_type || "text");
      setContent(existingPost.content);
      setHashtags(existingPost.hashtags?.join(", ") || "");
      setScheduleType(existingPost.status === "draft" ? "draft" : existingPost.scheduled_at ? "later" : "now");
      setScheduledAt(existingPost.scheduled_at ? format(parseISO(existingPost.scheduled_at), "yyyy-MM-dd'T'HH:mm") : "");
    } else {
      setSelectedPlatforms([]);
      setPostType("text");
      setContent("");
      setHashtags("");
      setScheduleType("now");
      setScheduledAt("");
    }
  }, [existingPost, open]);

  const togglePlatform = (key: string) => {
    setSelectedPlatforms(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]);
  };

  const charWarnings = selectedPlatforms.filter(p => content.length > (CHAR_LIMITS[p] || Infinity));

  const handleSave = async () => {
    if (selectedPlatforms.length === 0 || !content.trim()) {
      toast({ title: "Missing fields", description: "Select at least one platform and enter content.", variant: "destructive" });
      return;
    }
    setSaving(true);

    const hashtagsArr = hashtags.split(",").map(h => h.trim()).filter(Boolean);
    const status = scheduleType === "draft" ? "draft" : scheduleType === "later" ? "scheduled" : "scheduled";

    if (isEdit) {
      await supabase.from("social_media_posts").update({
        platform: selectedPlatforms[0] as any,
        post_type: postType as any,
        content: content.trim(),
        hashtags: hashtagsArr,
        status: status as any,
        scheduled_at: scheduleType === "later" ? scheduledAt : null,
      }).eq("id", existingPost!.id);
    } else {
      // Create one record per platform
      const records = selectedPlatforms.map(pl => ({
        client_id: clientId,
        platform: pl as any,
        post_type: postType as any,
        content: content.trim(),
        hashtags: hashtagsArr,
        status: status as any,
        scheduled_at: scheduleType === "later" ? scheduledAt : null,
      }));
      await supabase.from("social_media_posts").insert(records);
    }

    setSaving(false);
    toast({ title: isEdit ? "Post updated" : "Post created!", description: scheduleType === "draft" ? "Saved as draft." : scheduleType === "later" ? "Post scheduled." : "Post queued." });
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Post" : "Create Post"}</DialogTitle>
          <DialogDescription>Compose and schedule your social media post</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Left: Editor */}
          <div className="lg:col-span-3 space-y-4">
            {/* Platform Selection */}
            <div>
              <Label className="text-xs font-semibold">Platforms</Label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {PLATFORMS.map(p => (
                  <Button
                    key={p.key}
                    variant={selectedPlatforms.includes(p.key) ? "default" : "outline"}
                    size="sm"
                    className="text-xs"
                    onClick={() => togglePlatform(p.key)}
                  >
                    <span className="mr-1">{p.icon}</span> {p.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Post Type */}
            <div>
              <Label className="text-xs font-semibold">Content Type</Label>
              <div className="flex gap-2 mt-1">
                {POST_TYPES.map(t => (
                  <Button key={t.key} variant={postType === t.key ? "default" : "outline"} size="sm" className="text-xs" onClick={() => setPostType(t.key)}>
                    {t.icon} <span className="ml-1">{t.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div>
              <Label className="text-xs font-semibold">Content</Label>
              <Textarea placeholder="What do you want to share?" value={content} onChange={e => setContent(e.target.value)} rows={6} className="mt-1" />
              <div className="flex flex-wrap gap-2 mt-1">
                {selectedPlatforms.map(p => {
                  const limit = CHAR_LIMITS[p] || 0;
                  const over = content.length > limit;
                  return (
                    <span key={p} className={`text-[10px] ${over ? "text-destructive" : "text-muted-foreground"}`}>
                      {getPlatformIcon(p)} {content.length}/{limit}
                    </span>
                  );
                })}
              </div>
              {charWarnings.length > 0 && <p className="text-[10px] text-destructive mt-1">⚠️ Content exceeds limit for: {charWarnings.join(", ")}</p>}
            </div>

            {/* Hashtags */}
            <div>
              <Label className="text-xs font-semibold">Hashtags</Label>
              <Input placeholder="#marketing, #business, #ai" value={hashtags} onChange={e => setHashtags(e.target.value)} className="mt-1" />
              <p className="text-[10px] text-muted-foreground mt-1">Comma-separated</p>
            </div>

            {/* Schedule */}
            <div>
              <Label className="text-xs font-semibold">Publish</Label>
              <div className="flex gap-2 mt-1">
                <Button variant={scheduleType === "now" ? "default" : "outline"} size="sm" onClick={() => setScheduleType("now")}>Post Now</Button>
                <Button variant={scheduleType === "later" ? "default" : "outline"} size="sm" onClick={() => setScheduleType("later")}>Schedule</Button>
                <Button variant={scheduleType === "draft" ? "default" : "outline"} size="sm" onClick={() => setScheduleType("draft")}>Save Draft</Button>
              </div>
              {scheduleType === "later" && <Input type="datetime-local" className="mt-2" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />}
            </div>
          </div>

          {/* Right: Preview */}
          <div className="lg:col-span-2 space-y-4">
            <Label className="text-xs font-semibold">Preview</Label>
            {content ? (
              <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">U</div>
                  <div>
                    <p className="text-xs font-semibold">Your Page</p>
                    <p className="text-[10px] text-muted-foreground">{scheduleType === "now" ? "Just now" : scheduleType === "later" && scheduledAt ? format(new Date(scheduledAt), "MMM d, h:mm a") : "Draft"}</p>
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap">{content}</p>
                {hashtags && (
                  <p className="text-xs text-primary">{hashtags.split(",").map(h => h.trim()).filter(Boolean).map(h => h.startsWith("#") ? h : `#${h}`).join(" ")}</p>
                )}
                <Separator />
                <div className="flex justify-around text-xs text-muted-foreground">
                  <span>👍 Like</span>
                  <span>💬 Comment</span>
                  <span>🔄 Share</span>
                </div>
              </div>
            ) : (
              <div className="border rounded-lg p-8 text-center border-dashed">
                <p className="text-xs text-muted-foreground">Your post preview will appear here</p>
              </div>
            )}

            {selectedPlatforms.length > 1 && (
              <p className="text-[10px] text-muted-foreground">📌 {selectedPlatforms.length} platforms selected — one post will be created per platform</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={saving || selectedPlatforms.length === 0 || !content.trim()} onClick={handleSave}>
            {saving ? "Saving..." : scheduleType === "draft" ? "Save Draft" : scheduleType === "later" ? "Schedule Post" : "Publish Now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Post Detail Modal ─── */
function PostDetailModal({ post, onClose, onEdit }: { post: SocialPost | null; onClose: () => void; onEdit: (p: SocialPost) => void }) {
  if (!post) return null;

  const eng = post.engagement_stats as any;
  const likes = eng ? parseInt(eng.likes) || 0 : 0;
  const comments = eng ? parseInt(eng.comments) || 0 : 0;
  const shares = eng ? parseInt(eng.shares) || 0 : 0;
  const reach = eng ? parseInt(eng.reach) || 0 : 0;

  return (
    <Dialog open={!!post} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlatformBadge platform={post.platform} />
            <PostStatusBadge status={post.status} />
          </DialogTitle>
          <DialogDescription>
            {post.posted_at ? `Posted ${formatDistanceToNow(parseISO(post.posted_at), { addSuffix: true })}` :
             post.scheduled_at ? `Scheduled for ${format(parseISO(post.scheduled_at), "PPp")}` :
             `Created ${formatDistanceToNow(parseISO(post.created_at), { addSuffix: true })}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm whitespace-pre-wrap">{post.content}</p>

          {post.hashtags && post.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {post.hashtags.map((h, i) => <Badge key={i} variant="secondary" className="text-[10px]">#{h}</Badge>)}
            </div>
          )}

          {post.status === "posted" && (
            <div>
              <Label className="text-xs font-semibold">Engagement</Label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                <div className="text-center border rounded-md p-2"><p className="text-lg font-bold">{likes}</p><p className="text-[10px] text-muted-foreground">Likes</p></div>
                <div className="text-center border rounded-md p-2"><p className="text-lg font-bold">{comments}</p><p className="text-[10px] text-muted-foreground">Comments</p></div>
                <div className="text-center border rounded-md p-2"><p className="text-lg font-bold">{shares}</p><p className="text-[10px] text-muted-foreground">Shares</p></div>
                <div className="text-center border rounded-md p-2"><p className="text-lg font-bold">{reach}</p><p className="text-[10px] text-muted-foreground">Reach</p></div>
              </div>
            </div>
          )}

          {post.status === "failed" && post.error_message && (
            <div className="border border-destructive/30 rounded-md p-3 bg-destructive/5">
              <div className="flex items-center gap-2 text-destructive text-sm font-medium mb-1"><AlertCircle className="h-4 w-4" /> Failed</div>
              <p className="text-xs text-muted-foreground">{post.error_message}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          {(post.status === "draft" || post.status === "scheduled") && (
            <Button variant="outline" onClick={() => onEdit(post)}><Edit className="h-4 w-4 mr-1" /> Edit</Button>
          )}
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Helpers ─── */
function getPlatformColor(platform: string): string {
  return PLATFORMS.find(p => p.key === platform)?.color || "#666";
}

function getPlatformIcon(platform: string): string {
  return PLATFORMS.find(p => p.key === platform)?.icon || "📝";
}

function PlatformBadge({ platform }: { platform: string }) {
  const p = PLATFORMS.find(pl => pl.key === platform);
  return <Badge variant="outline" className="text-[10px]" style={{ borderColor: p?.color, color: p?.color }}>{p?.icon} {p?.label || platform}</Badge>;
}

function PostStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    draft: { label: "Draft", variant: "secondary" },
    scheduled: { label: "Scheduled", variant: "outline" },
    publishing: { label: "Publishing", variant: "default" },
    posted: { label: "Posted", variant: "default" },
    failed: { label: "Failed", variant: "destructive" },
  };
  const info = map[status] || { label: status, variant: "secondary" as const };
  return <Badge variant={info.variant} className={status === "publishing" ? "animate-pulse" : ""}>{info.label}</Badge>;
}

function EngagementMini({ stats }: { stats: any }) {
  if (!stats) return <span className="text-xs text-muted-foreground">—</span>;
  const likes = parseInt(stats.likes) || 0;
  const comments = parseInt(stats.comments) || 0;
  const shares = parseInt(stats.shares) || 0;
  return <span className="text-xs text-muted-foreground">👍{likes} 💬{comments} 🔄{shares}</span>;
}

/* ─── Loading ─── */
function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between"><Skeleton className="h-8 w-56" /><Skeleton className="h-9 w-36" /></div>
      <div className="flex gap-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-40" />)}</div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}</div>
      <Skeleton className="h-96" />
    </div>
  );
}

import { useEffect, useState, useCallback, useMemo } from "react";
import { useClient } from "@/contexts/ClientContext";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  MessageCircle, CheckCircle, CheckCheck, Zap, MessageSquare,
  Users, FileText, BarChart3, MoreVertical, Plus, Send,
  Clock, X, ArrowRight, Upload, Eye, RefreshCw, Trash2,
  Copy, Pause, Play,
} from "lucide-react";
import { formatDistanceToNow, format, startOfMonth } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import Papa from "papaparse";

/* ─── Types ─── */
interface WACampaign {
  id: string;
  campaign_name: string;
  status: string;
  total_contacts: number;
  messages_sent: number;
  messages_delivered: number;
  scheduled_at: string | null;
  completed_at: string | null;
  created_at: string;
  message_template: string;
}

interface WAMessage {
  id: string;
  phone_number: string;
  message_content: string;
  message_type: string;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  campaign_id: string | null;
  media_url: string | null;
  template_name: string | null;
  error_message: string | null;
  campaign_name?: string;
}

interface Stats {
  messagesSent: number;
  deliveryRate: number;
  delivered: number;
  total: number;
  readRate: number;
  readCount: number;
  activeCampaigns: number;
}

/* ─── Main Component ─── */
export default function WhatsAppPage() {
  const { client, assignedServices, isLoading: contextLoading, primaryColor } = useClient();
  const { toast } = useToast();

  const [stats, setStats] = useState<Stats | null>(null);
  const [campaigns, setCampaigns] = useState<WACampaign[]>([]);
  const [recentMessages, setRecentMessages] = useState<WAMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [campaignTab, setCampaignTab] = useState("all");
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [campaignWizardOpen, setCampaignWizardOpen] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<any[]>([]);

  const waService = assignedServices.find(s => s.service_slug === "whatsapp-automation");

  const fetchAll = useCallback(async () => {
    if (!client) return;
    setIsLoading(true);
    await Promise.all([fetchStats(), fetchCampaigns(), fetchRecentMessages(), fetchAnalytics()]);
    setIsLoading(false);
  }, [client]);

  async function fetchStats() {
    if (!client) return;
    const monthStart = startOfMonth(new Date()).toISOString();

    const [msgsRes, campaignsRes] = await Promise.all([
      supabase
        .from("whatsapp_messages")
        .select("status")
        .eq("client_id", client.id)
        .gte("sent_at", monthStart),
      supabase
        .from("whatsapp_campaigns")
        .select("id", { count: "exact", head: true })
        .eq("client_id", client.id)
        .eq("status", "sending"),
    ]);

    const msgs = msgsRes.data || [];
    const total = msgs.length;
    const delivered = msgs.filter(m => m.status === "delivered" || m.status === "read").length;
    const readCount = msgs.filter(m => m.status === "read").length;

    setStats({
      messagesSent: total,
      deliveryRate: total > 0 ? Math.round((delivered / total) * 100) : 0,
      delivered,
      total,
      readRate: total > 0 ? Math.round((readCount / total) * 100) : 0,
      readCount,
      activeCampaigns: campaignsRes.count || 0,
    });
  }

  async function fetchCampaigns() {
    if (!client) return;
    const { data } = await supabase
      .from("whatsapp_campaigns")
      .select("*")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false });
    setCampaigns((data as WACampaign[]) || []);
  }

  async function fetchRecentMessages() {
    if (!client) return;
    const { data } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("client_id", client.id)
      .order("sent_at", { ascending: false })
      .limit(10);

    if (!data) { setRecentMessages([]); return; }

    // Get campaign names
    const campaignIds = [...new Set(data.filter(m => m.campaign_id).map(m => m.campaign_id!))];
    let campaignMap = new Map<string, string>();
    if (campaignIds.length > 0) {
      const { data: camps } = await supabase
        .from("whatsapp_campaigns")
        .select("id, campaign_name")
        .in("id", campaignIds);
      camps?.forEach(c => campaignMap.set(c.id, c.campaign_name));
    }

    setRecentMessages(data.map(m => ({
      ...m,
      campaign_name: m.campaign_id ? campaignMap.get(m.campaign_id) : undefined,
    })) as WAMessage[]);
  }

  async function fetchAnalytics() {
    if (!client) return;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data } = await supabase
      .from("whatsapp_messages")
      .select("status, sent_at")
      .eq("client_id", client.id)
      .gte("sent_at", thirtyDaysAgo.toISOString());

    if (!data || data.length === 0) {
      setAnalyticsData([]);
      setStatusDistribution([]);
      return;
    }

    // Group by day
    const dayMap = new Map<string, { sent: number; delivered: number; read: number }>();
    data.forEach(m => {
      if (!m.sent_at) return;
      const day = format(new Date(m.sent_at), "MMM dd");
      const entry = dayMap.get(day) || { sent: 0, delivered: 0, read: 0 };
      entry.sent++;
      if (m.status === "delivered" || m.status === "read") entry.delivered++;
      if (m.status === "read") entry.read++;
      dayMap.set(day, entry);
    });
    setAnalyticsData(Array.from(dayMap.entries()).map(([day, v]) => ({ day, ...v })));

    // Status distribution
    const statusMap = new Map<string, number>();
    data.forEach(m => {
      statusMap.set(m.status || "queued", (statusMap.get(m.status || "queued") || 0) + 1);
    });
    setStatusDistribution(Array.from(statusMap.entries()).map(([name, value]) => ({ name, value })));
  }

  useEffect(() => {
    if (!client || contextLoading) return;
    if (!waService) return;
    fetchAll();
  }, [client, contextLoading, waService]);

  // Realtime for campaigns
  useEffect(() => {
    if (!client) return;
    const channel = supabase
      .channel("wa-campaigns")
      .on("postgres_changes", {
        event: "*", schema: "public", table: "whatsapp_campaigns",
        filter: `client_id=eq.${client.id}`,
      }, () => { fetchCampaigns(); fetchStats(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [client]);

  if (contextLoading || isLoading) return <LoadingSkeleton />;
  if (!waService) return <Navigate to="/client" replace />;

  const filteredCampaigns = campaignTab === "all"
    ? campaigns
    : campaigns.filter(c => c.status === campaignTab);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-6 w-6" style={{ color: "#25D366" }} />
            <h1 className="text-xl md:text-2xl font-bold text-foreground">WhatsApp Automation</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Send bulk messages and automate conversations</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Badge variant="outline" className="text-xs py-1 px-3">
            {waService.usage_consumed} / {waService.usage_limit} messages used
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setCampaignWizardOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Campaign
          </Button>
          <Button size="sm" style={{ backgroundColor: "#25D366", color: "white" }} onClick={() => setSendModalOpen(true)}>
            <Send className="h-4 w-4 mr-1" /> Send Message
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatsCard icon={<MessageCircle className="h-5 w-5" />} color="#25D366" label="Messages Sent" value={stats?.messagesSent ?? 0} subtext="This month" />
        <StatsCard icon={<CheckCircle className="h-5 w-5" />} color="#22c55e" label="Delivery Rate" value={`${stats?.deliveryRate ?? 0}%`} subtext={`${stats?.delivered ?? 0} of ${stats?.total ?? 0}`} />
        <StatsCard icon={<CheckCheck className="h-5 w-5" />} color="#3b82f6" label="Read Rate" value={`${stats?.readRate ?? 0}%`} subtext="Recipients opened" />
        <StatsCard icon={<Zap className="h-5 w-5" />} color="#f59e0b" label="Active Campaigns" value={stats?.activeCampaigns ?? 0} subtext="Running now" />
      </div>

      {/* Quick Actions */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <QuickAction icon={<MessageSquare className="h-5 w-5" />} label="Send Single Message" sub="Send to one contact" onClick={() => setSendModalOpen(true)} />
        <QuickAction icon={<Users className="h-5 w-5" />} label="Bulk Campaign" sub="Send to multiple contacts" onClick={() => setCampaignWizardOpen(true)} />
        <QuickAction icon={<FileText className="h-5 w-5" />} label="Message Templates" sub="Pre-approved templates" onClick={() => {}} />
        <QuickAction icon={<BarChart3 className="h-5 w-5" />} label="Analytics" sub="Message performance" onClick={() => document.getElementById("wa-analytics")?.scrollIntoView({ behavior: "smooth" })} />
      </div>

      {/* Campaigns */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-foreground">My Campaigns</h2>
        </div>
        <Tabs value={campaignTab} onValueChange={setCampaignTab}>
          <TabsList className="mb-3">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="sending">Sending</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
          </TabsList>
          <TabsContent value={campaignTab}>
            {filteredCampaigns.length > 0 ? (
              <div className="space-y-3">
                {filteredCampaigns.map(c => <CampaignCard key={c.id} campaign={c} onRefresh={fetchCampaigns} />)}
              </div>
            ) : campaigns.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="rounded-full bg-muted p-5 mb-4">
                    <MessageCircle className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">No campaigns yet</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mb-6">Create your first WhatsApp campaign to start engaging with customers.</p>
                  <Button style={{ backgroundColor: "#25D366", color: "white" }} onClick={() => setCampaignWizardOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Create Campaign
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card><CardContent className="py-10 text-center"><p className="text-sm text-muted-foreground">No {campaignTab} campaigns.</p></CardContent></Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Recent Messages */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Recent Messages</CardTitle>
          <Button variant="ghost" size="sm" className="text-xs" onClick={fetchRecentMessages}>
            <RefreshCw className="h-3 w-3 mr-1" /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {recentMessages.length > 0 ? (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Phone</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentMessages.map(m => (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono text-sm">{maskPhone(m.phone_number)}</TableCell>
                        <TableCell><p className="text-xs text-muted-foreground truncate max-w-[200px]">{m.message_content.slice(0, 50)}{m.message_content.length > 50 ? "..." : ""}</p></TableCell>
                        <TableCell>{m.campaign_name ? <Badge variant="outline" className="text-[10px]">{m.campaign_name}</Badge> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                        <TableCell><MessageStatusBadge status={m.status} /></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{m.sent_at ? formatDistanceToNow(new Date(m.sent_at), { addSuffix: true }) : "—"}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem><Eye className="h-3 w-3 mr-2" /> View Full Message</DropdownMenuItem>
                              {m.status === "failed" && <DropdownMenuItem><RefreshCw className="h-3 w-3 mr-2" /> Resend</DropdownMenuItem>}
                              <DropdownMenuItem className="text-destructive"><Trash2 className="h-3 w-3 mr-2" /> Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-3 md:hidden">
                {recentMessages.map(m => (
                  <div key={m.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm">{maskPhone(m.phone_number)}</span>
                      <MessageStatusBadge status={m.status} />
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{m.message_content}</p>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      {m.campaign_name && <Badge variant="outline" className="text-[10px]">{m.campaign_name}</Badge>}
                      <span>{m.sent_at ? formatDistanceToNow(new Date(m.sent_at), { addSuffix: true }) : ""}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-10">
              <MessageCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No messages sent yet</p>
              <p className="text-xs text-muted-foreground mt-1">Start sending messages to engage with your customers</p>
              <Button className="mt-4" size="sm" style={{ backgroundColor: "#25D366", color: "white" }} onClick={() => setSendModalOpen(true)}>
                <Send className="h-4 w-4 mr-1" /> Send First Message
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analytics */}
      <div id="wa-analytics" className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Analytics</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Messages Over Last 30 Days</CardTitle></CardHeader>
            <CardContent>
              {analyticsData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={analyticsData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="day" className="text-xs" tick={{ fontSize: 10 }} />
                    <YAxis className="text-xs" tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="sent" stroke="#25D366" strokeWidth={2} name="Sent" dot={false} />
                    <Line type="monotone" dataKey="delivered" stroke="#22c55e" strokeWidth={2} name="Delivered" dot={false} />
                    <Line type="monotone" dataKey="read" stroke="#3b82f6" strokeWidth={2} name="Read" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-muted-foreground text-center py-10">No data yet</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Status Distribution</CardTitle></CardHeader>
            <CardContent>
              {statusDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={statusDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {statusDistribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-muted-foreground text-center py-10">No data yet</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modals */}
      <SendMessageModal open={sendModalOpen} onOpenChange={setSendModalOpen} clientId={client?.id || ""} onSent={() => { fetchRecentMessages(); fetchStats(); }} />
      <CreateCampaignWizardWA open={campaignWizardOpen} onOpenChange={setCampaignWizardOpen} clientId={client?.id || ""} usageLimit={waService.usage_limit} usageConsumed={waService.usage_consumed} onCreated={() => { fetchCampaigns(); fetchStats(); }} />
    </div>
  );
}

const PIE_COLORS = ["#25D366", "#22c55e", "#3b82f6", "#ef4444", "#a3a3a3"];

/* ─── Sub Components ─── */

function StatsCard({ icon, color, label, value, subtext }: { icon: React.ReactNode; color: string; label: string; value: string | number; subtext: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg p-2.5" style={{ backgroundColor: `${color}15` }}>
            <div style={{ color }}>{icon}</div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold text-foreground">{value}</p>
            <p className="text-[10px] text-muted-foreground">{subtext}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickAction({ icon, label, sub, onClick }: { icon: React.ReactNode; label: string; sub: string; onClick: () => void }) {
  return (
    <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={onClick}>
      <CardContent className="pt-5 pb-4 flex items-start gap-3">
        <div className="rounded-lg bg-muted p-2">{icon}</div>
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function CampaignCard({ campaign, onRefresh }: { campaign: WACampaign; onRefresh: () => void }) {
  const progress = campaign.total_contacts > 0 ? Math.round((campaign.messages_sent / campaign.total_contacts) * 100) : 0;
  const deliveredPct = campaign.messages_sent > 0 ? Math.round((campaign.messages_delivered / campaign.messages_sent) * 100) : 0;

  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-foreground">{campaign.campaign_name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true })}</p>
          </div>
          <div className="flex items-center gap-2">
            <CampaignStatusBadge status={campaign.status} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem><Eye className="h-3 w-3 mr-2" /> View Details</DropdownMenuItem>
                <DropdownMenuItem><Copy className="h-3 w-3 mr-2" /> Clone</DropdownMenuItem>
                {campaign.status === "sending" && <DropdownMenuItem><Pause className="h-3 w-3 mr-2" /> Pause</DropdownMenuItem>}
                <DropdownMenuItem className="text-destructive"><Trash2 className="h-3 w-3 mr-2" /> Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {(campaign.status === "sending" || campaign.status === "completed") && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>{campaign.messages_sent} / {campaign.total_contacts} sent</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>Sent: <strong className="text-foreground">{campaign.messages_sent}</strong></span>
          <span>Delivered: <strong className="text-foreground">{campaign.messages_delivered}</strong> ({deliveredPct}%)</span>
          <span>Contacts: <strong className="text-foreground">{campaign.total_contacts}</strong></span>
        </div>
      </CardContent>
    </Card>
  );
}

function CampaignStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    draft: { label: "Draft", variant: "secondary" },
    scheduled: { label: "Scheduled", variant: "outline" },
    sending: { label: "Sending", variant: "default" },
    completed: { label: "Completed", variant: "default" },
    cancelled: { label: "Cancelled", variant: "destructive" },
  };
  const info = map[status] || { label: status, variant: "secondary" as const };
  return (
    <Badge variant={info.variant} className={status === "sending" ? "animate-pulse" : ""}>
      {info.label}
    </Badge>
  );
}

function MessageStatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: React.ReactNode; label: string; cls: string }> = {
    queued: { icon: <Clock className="h-3 w-3" />, label: "Queued", cls: "text-muted-foreground" },
    sent: { icon: <CheckCircle className="h-3 w-3" />, label: "Sent", cls: "text-muted-foreground" },
    delivered: { icon: <CheckCheck className="h-3 w-3" />, label: "Delivered", cls: "text-muted-foreground" },
    read: { icon: <CheckCheck className="h-3 w-3" />, label: "Read", cls: "text-blue-500" },
    failed: { icon: <X className="h-3 w-3" />, label: "Failed", cls: "text-destructive" },
  };
  const c = config[status] || config.queued;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${c.cls}`}>
      {c.icon} {c.label}
    </span>
  );
}

function maskPhone(phone: string): string {
  if (phone.length <= 6) return phone;
  return phone.slice(0, -4).replace(/.(?=.{4})/g, (c, i) => i > phone.length - 8 ? "*" : c).slice(0, -4) + " " + phone.slice(-4);
}

/* ─── Send Message Modal ─── */
function SendMessageModal({ open, onOpenChange, clientId, onSent }: { open: boolean; onOpenChange: (v: boolean) => void; clientId: string; onSent: () => void }) {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [messageType, setMessageType] = useState("text");
  const [content, setContent] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [sending, setSending] = useState(false);

  const reset = () => { setPhone(""); setContent(""); setMessageType("text"); setTemplateName(""); };

  const handleSend = async () => {
    if (!phone.trim() || !content.trim()) {
      toast({ title: "Missing fields", description: "Phone number and message are required.", variant: "destructive" });
      return;
    }
    setSending(true);
    const { error } = await supabase.from("whatsapp_messages").insert({
      client_id: clientId,
      phone_number: phone.trim(),
      message_type: messageType as any,
      message_content: content.trim(),
      template_name: messageType === "template" ? templateName : null,
      status: "queued",
    });
    setSending(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Message queued", description: "Message has been queued for sending." });
      reset();
      onOpenChange(false);
      onSent();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Send className="h-5 w-5" style={{ color: "#25D366" }} /> Send WhatsApp Message</DialogTitle>
          <DialogDescription>Send a message to a single contact</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Phone Number</Label>
            <Input placeholder="+91 9876543210" value={phone} onChange={e => setPhone(e.target.value)} />
            <p className="text-[10px] text-muted-foreground mt-1">Include country code</p>
          </div>
          <div>
            <Label>Message Type</Label>
            <Select value={messageType} onValueChange={setMessageType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text Message</SelectItem>
                <SelectItem value="template">Template Message</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {messageType === "template" && (
            <div>
              <Label>Template Name</Label>
              <Input placeholder="e.g., welcome_message" value={templateName} onChange={e => setTemplateName(e.target.value)} />
            </div>
          )}
          <div>
            <Label>Message</Label>
            <Textarea placeholder="Type your message..." value={content} onChange={e => setContent(e.target.value)} rows={4} maxLength={4096} />
            <p className="text-[10px] text-muted-foreground mt-1 text-right">{content.length} / 4096</p>
          </div>
          {/* Preview */}
          {content && (
            <div>
              <Label className="text-xs">Preview</Label>
              <div className="bg-[#dcf8c6] rounded-lg p-3 ml-auto max-w-[80%] text-sm mt-1 shadow-sm">
                <p className="whitespace-pre-wrap text-foreground">{content}</p>
                <p className="text-[9px] text-muted-foreground text-right mt-1">{format(new Date(), "h:mm a")}</p>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={sending} style={{ backgroundColor: "#25D366", color: "white" }} onClick={handleSend}>
            {sending ? "Sending..." : "Send Message"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Campaign Wizard ─── */
function CreateCampaignWizardWA({ open, onOpenChange, clientId, usageLimit, usageConsumed, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void; clientId: string;
  usageLimit: number; usageConsumed: number; onCreated: () => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [scheduleType, setScheduleType] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [contacts, setContacts] = useState<{ phone: string; name?: string }[]>([]);
  const [messageContent, setMessageContent] = useState("");
  const [creating, setCreating] = useState(false);
  const [manualPhone, setManualPhone] = useState("");

  const remaining = usageLimit - usageConsumed;
  const canLaunch = contacts.length > 0 && contacts.length <= remaining && name.trim() && messageContent.trim();

  const reset = () => { setStep(1); setName(""); setScheduleType("now"); setScheduledAt(""); setContacts([]); setMessageContent(""); setManualPhone(""); };

  const handleCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = results.data.map((row: any) => ({
          phone: row.phone || row.Phone || row.phone_number || "",
          name: row.name || row.Name || row.contact_name || undefined,
        })).filter((c: any) => c.phone);
        setContacts(parsed);
        toast({ title: `${parsed.length} contacts imported` });
      },
    });
  };

  const addManual = () => {
    if (manualPhone.trim()) {
      setContacts(prev => [...prev, { phone: manualPhone.trim() }]);
      setManualPhone("");
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    const { data, error } = await supabase.from("whatsapp_campaigns").insert({
      client_id: clientId,
      campaign_name: name.trim(),
      message_template: messageContent.trim(),
      total_contacts: contacts.length,
      status: scheduleType === "now" ? "sending" : "scheduled",
      scheduled_at: scheduleType === "later" ? scheduledAt : null,
    }).select("id").single();

    if (error || !data) {
      toast({ title: "Error", description: error?.message || "Failed to create campaign", variant: "destructive" });
      setCreating(false);
      return;
    }

    // Insert messages for each contact
    const messages = contacts.map(c => ({
      client_id: clientId,
      campaign_id: data.id,
      phone_number: c.phone,
      message_content: messageContent.trim(),
      message_type: "text" as const,
      status: "queued" as const,
    }));

    // Batch insert in chunks
    for (let i = 0; i < messages.length; i += 100) {
      await supabase.from("whatsapp_messages").insert(messages.slice(i, i + 100));
    }

    setCreating(false);
    toast({ title: "Campaign created!", description: `${contacts.length} messages queued.` });
    reset();
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create WhatsApp Campaign</DialogTitle>
          <DialogDescription>Step {step} of 4</DialogDescription>
        </DialogHeader>
        <div className="flex gap-1 mb-4">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? "bg-[#25D366]" : "bg-muted"}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div><Label>Campaign Name</Label><Input placeholder="e.g., Summer Sale" value={name} onChange={e => setName(e.target.value)} /></div>
            <div>
              <Label>Schedule</Label>
              <div className="flex gap-3 mt-1">
                <Button variant={scheduleType === "now" ? "default" : "outline"} size="sm" onClick={() => setScheduleType("now")}>Send Immediately</Button>
                <Button variant={scheduleType === "later" ? "default" : "outline"} size="sm" onClick={() => setScheduleType("later")}>Schedule</Button>
              </div>
              {scheduleType === "later" && <Input type="datetime-local" className="mt-2" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label>Upload CSV</Label>
              <Input type="file" accept=".csv" onChange={handleCSV} className="mt-1" />
              <p className="text-[10px] text-muted-foreground mt-1">CSV must have a "phone" column. Optional: "name"</p>
            </div>
            <div className="text-center text-xs text-muted-foreground">— or add manually —</div>
            <div className="flex gap-2">
              <Input placeholder="+91 9876543210" value={manualPhone} onChange={e => setManualPhone(e.target.value)} onKeyDown={e => e.key === "Enter" && addManual()} />
              <Button variant="outline" size="sm" onClick={addManual}><Plus className="h-4 w-4" /></Button>
            </div>
            {contacts.length > 0 && (
              <div className="border rounded-md p-3 max-h-32 overflow-y-auto">
                <p className="text-xs font-medium mb-2">{contacts.length} contacts</p>
                <div className="space-y-1">
                  {contacts.slice(0, 5).map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span>{c.name ? `${c.name} — ` : ""}{c.phone}</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setContacts(prev => prev.filter((_, j) => j !== i))}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {contacts.length > 5 && <p className="text-[10px] text-muted-foreground">...and {contacts.length - 5} more</p>}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <Label>Message</Label>
              <Textarea placeholder="Type your message..." value={messageContent} onChange={e => setMessageContent(e.target.value)} rows={5} maxLength={4096} />
              <p className="text-[10px] text-muted-foreground mt-1 text-right">{messageContent.length} / 4096</p>
            </div>
            {messageContent && (
              <div>
                <Label className="text-xs">Preview</Label>
                <div className="bg-[#dcf8c6] rounded-lg p-3 ml-auto max-w-[80%] text-sm mt-1 shadow-sm">
                  <p className="whitespace-pre-wrap text-foreground">{messageContent}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Review</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Campaign</span><span className="font-medium">{name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Contacts</span><span className="font-medium">{contacts.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Schedule</span><span className="font-medium">{scheduleType === "now" ? "Immediately" : format(new Date(scheduledAt), "PPp")}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Remaining quota</span><span className="font-medium">{remaining} messages</span></div>
              {contacts.length > remaining && <p className="text-xs text-destructive">⚠️ Not enough message quota. You need {contacts.length - remaining} more.</p>}
            </div>
            <div className="border rounded-lg p-3 bg-muted/50">
              <p className="text-xs font-medium mb-1">Message Preview</p>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{messageContent.slice(0, 200)}{messageContent.length > 200 ? "..." : ""}</p>
            </div>
          </div>
        )}

        <DialogFooter className="flex-row justify-between">
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep(s => s - 1)}>Back</Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          )}
          {step < 4 ? (
            <Button onClick={() => setStep(s => s + 1)} disabled={step === 1 && !name.trim() || step === 2 && contacts.length === 0 || step === 3 && !messageContent.trim()}>
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button disabled={!canLaunch || creating} style={{ backgroundColor: "#25D366", color: "white" }} onClick={handleCreate}>
              {creating ? "Creating..." : "Launch Campaign"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Loading Skeleton ─── */
function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between"><Skeleton className="h-8 w-48" /><Skeleton className="h-9 w-36" /></div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-48" />
      <Skeleton className="h-64" />
    </div>
  );
}

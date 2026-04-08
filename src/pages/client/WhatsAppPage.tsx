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
  WHATSAPP_API_URL,
  getWhatsAppTemplates,
  updateMessageStatus,
  sendWhatsAppMessage,
  syncWhatsAppTemplates,
  createWhatsAppTemplate,
} from "@/utils/whatsapp";
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
  Copy, Pause, Play, Video, Headset
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

const PIE_COLORS = ["#25D366", "#22c55e", "#3b82f6", "#ef4444", "#a3a3a3"];

/* ─── Main Component ─── */
export default function WhatsAppPage() {
  const { client, assignedServices, isLoading: contextLoading, primaryColor, refetchClient } = useClient();
  const { toast } = useToast();

  const [stats, setStats] = useState<Stats | null>(null);
  const [campaigns, setCampaigns] = useState<WACampaign[]>([]);
  const [recentMessages, setRecentMessages] = useState<WAMessage[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingTemplates, setIsRefreshingTemplates] = useState(false);
  const [campaignTab, setCampaignTab] = useState("all");
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [campaignWizardOpen, setCampaignWizardOpen] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<any[]>([]);
  const [workflowInstance, setWorkflowInstance] = useState<any>(null);
  const [assignedBots, setAssignedBots] = useState<any[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  // Message Sending State
  const [phone, setPhone] = useState("");
  const [messageType, setMessageType] = useState("text");
  const [content, setContent] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("en_US");

  const waService = assignedServices.find(s => s.service_slug === "whatsapp-automation");

  const fetchStats = useCallback(async () => {
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
  }, [client]);

  const fetchCampaigns = useCallback(async () => {
    if (!client) return;
    const { data } = await supabase
      .from("whatsapp_campaigns")
      .select("*")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false });
    setCampaigns((data as WACampaign[]) || []);
  }, [client]);

  const fetchWorkflow = useCallback(async () => {
    if (!client || !waService) return;
    const { data } = await supabase
      .from("client_workflow_instances")
      .select("*")
      .eq("client_id", client.id)
      .eq("service_id", waService.service_id)
      .maybeSingle();
    setWorkflowInstance(data);
  }, [client, waService]);

  const fetchAssignedBots = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data, error } = await (supabase.from("whatsapp_user_access" as any) as any)
      .select("application_id, whatsapp_applications(*)")
      .eq("user_id", user.id);
    
    if (!error && data) {
      const bots = data.map((d: any) => d.whatsapp_applications);
      setAssignedBots(bots);
      if (bots.length > 0 && !selectedAppId) {
        setSelectedAppId(bots[0].id);
      }
    }
  }, [selectedAppId]);

  const fetchRecentMessages = useCallback(async () => {
    if (!client) return;
    const { data } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("client_id", client.id)
      .order("sent_at", { ascending: false })
      .limit(10);

    if (!data) { setRecentMessages([]); return; }

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
  }, [client]);

  const fetchAnalytics = useCallback(async () => {
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

    const statusMap = new Map<string, number>();
    data.forEach(m => {
      statusMap.set(m.status || "queued", (statusMap.get(m.status || "queued") || 0) + 1);
    });
    setStatusDistribution(Array.from(statusMap.entries()).map(([name, value]) => ({ name, value })));
  }, [client]);

  const fetchTemplates = useCallback(async (appId: string) => {
    try {
      setIsRefreshingTemplates(true);
      const bot = assignedBots.find(b => b.id === appId);
      if (bot && bot.provider_type === 'api') {
        try {
          await syncWhatsAppTemplates(appId);
        } catch (syncErr) {
          console.warn("API Sync failed, showing local templates only:", syncErr);
        }
      }
      const data = await getWhatsAppTemplates(appId);
      setTemplates(data);
    } catch (error) {
      console.error("Failed to fetch templates:", error);
    } finally {
      setIsRefreshingTemplates(false);
    }
  }, [assignedBots]);

  const fetchAll = useCallback(async () => {
    if (!client) return;
    setIsLoading(true);
    await Promise.all([
      fetchStats(), 
      fetchCampaigns(), 
      fetchRecentMessages(), 
      fetchAnalytics(), 
      fetchWorkflow(),
      fetchAssignedBots()
    ]);
    setIsLoading(false);
  }, [client, fetchStats, fetchCampaigns, fetchRecentMessages, fetchAnalytics, fetchWorkflow, fetchAssignedBots]);

  useEffect(() => {
    if (selectedAppId) {
      fetchTemplates(selectedAppId);
    }
  }, [selectedAppId, fetchTemplates]);

  useEffect(() => {
    if (!client || contextLoading) return;
    if (!waService) return;
    fetchAll();
  }, [client, contextLoading, waService, fetchAll]);

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
  }, [client, fetchCampaigns, fetchStats]);

  if (contextLoading || isLoading) return <LoadingSkeleton />;
  if (!waService) return <Navigate to="/client" replace />;

  const filteredCampaigns = campaignTab === "all"
    ? campaigns
    : campaigns.filter(c => c.status === campaignTab);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-6 w-6" style={{ color: "#25D366" }} />
            <h1 className="text-xl md:text-2xl font-bold text-foreground">LeadNest</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Send bulk messages and automate conversations</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {assignedBots.length > 1 && (
            <Select value={selectedAppId || ""} onValueChange={setSelectedAppId}>
              <SelectTrigger className="w-[180px] h-9 bg-background border-muted-foreground/20">
                <SelectValue placeholder="Select Bot" />
              </SelectTrigger>
              <SelectContent>
                {assignedBots.map(bot => (
                  <SelectItem key={bot.id} value={bot.id}>{bot.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Badge variant="outline" className="text-xs py-1 px-3">
            {Math.max(stats?.total || 0, waService?.usage_consumed || 0)} / {waService?.usage_limit || 0} messages used
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setCampaignWizardOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Campaign
          </Button>
          <Button size="sm" style={{ backgroundColor: "#25D366", color: "white" }} onClick={() => setSendModalOpen(true)}>
            <Send className="h-4 w-4 mr-1" /> Send Message
          </Button>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatsCard icon={<MessageCircle className="h-5 w-5" />} color="#25D366" label="Messages Sent" value={stats?.messagesSent ?? 0} subtext="This month" />
        <StatsCard icon={<CheckCircle className="h-5 w-5" />} color="#22c55e" label="Delivery Rate" value={`${stats?.deliveryRate ?? 0}%`} subtext={`${stats?.delivered ?? 0} of ${stats?.total ?? 0}`} />
        <StatsCard icon={<CheckCheck className="h-5 w-5" />} color="#3b82f6" label="Read Rate" value={`${stats?.readRate ?? 0}%`} subtext="Recipients opened" />
        <StatsCard icon={<Zap className="h-5 w-5" />} color="#f59e0b" label="Active Campaigns" value={stats?.activeCampaigns ?? 0} subtext="Running now" />
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <QuickAction icon={<MessageSquare className="h-5 w-5" />} label="Send Single Message" sub="Send to one contact" onClick={() => setSendModalOpen(true)} />
        <QuickAction icon={<Users className="h-5 w-5" />} label="Bulk Campaign" sub="Send to multiple contacts" onClick={() => setCampaignWizardOpen(true)} />
        <QuickAction icon={<FileText className="h-5 w-5" />} label="Message Templates" sub="Pre-approved templates" onClick={() => document.getElementById("wa-templates")?.scrollIntoView({ behavior: "smooth" })} />
        <QuickAction icon={<BarChart3 className="h-5 w-5" />} label="Analytics" sub="Message performance" onClick={() => document.getElementById("wa-analytics")?.scrollIntoView({ behavior: "smooth" })} />
      </div>

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
            ) : (
              <Card><CardContent className="py-10 text-center"><p className="text-sm text-muted-foreground">No {campaignTab} campaigns.</p></CardContent></Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Recent Messages</CardTitle>
          <Button variant="ghost" size="sm" className="text-xs" onClick={fetchRecentMessages}>
            <RefreshCw className="h-3 w-3 mr-1" /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {recentMessages.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phone</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentMessages.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-sm">{m.phone_number}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs">{m.message_content}</TableCell>
                    <TableCell><MessageStatusBadge status={m.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.sent_at ? formatDistanceToNow(new Date(m.sent_at), { addSuffix: true }) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-10"><p className="text-sm text-muted-foreground">No messages sent yet</p></div>
          )}
        </CardContent>
      </Card>

      <Card id="wa-templates">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Message Templates</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setTemplateModalOpen(true)}><Plus className="h-4 w-4 mr-1" /> Create</Button>
            <Button variant="outline" size="sm" onClick={() => selectedAppId && fetchTemplates(selectedAppId)} disabled={isRefreshingTemplates}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshingTemplates ? "animate-spin" : ""}`} /> Sync
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {templates.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {templates.map((tpl: any, i) => (
                <div key={i} className="border rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <Badge variant="outline" className="text-[10px]">{tpl.category}</Badge>
                    <Badge className="text-[10px] bg-green-100 text-green-700">{tpl.status}</Badge>
                  </div>
                  <h4 className="font-semibold text-sm">{tpl.name}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-3">{tpl.components?.find((c: any) => c.type === 'BODY')?.text || tpl.body}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground">No templates found. Sync to fetch from WhatsApp.</div>
          )}
        </CardContent>
      </Card>

      <div id="wa-analytics" className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Messages Over Time</CardTitle></CardHeader>
          <CardContent>
            {analyticsData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={analyticsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="sent" stroke="#25D366" />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-center py-10 text-muted-foreground">No analytics data</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Delivery Distribution</CardTitle></CardHeader>
          <CardContent>
            {statusDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={statusDistribution} dataKey="value" innerRadius={60} outerRadius={80}>
                    {statusDistribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-center py-10 text-muted-foreground">No distribution data</p>}
          </CardContent>
        </Card>
      </div>

      <SendMessageModal 
        open={sendModalOpen} 
        onOpenChange={setSendModalOpen} 
        clientId={client?.id || ""} 
        onSent={() => { fetchRecentMessages(); fetchStats(); refetchClient(); }} 
        webhookUrl={workflowInstance?.webhook_url}
        assignedBots={assignedBots}
        selectedAppId={selectedAppId}
        onAppChange={setSelectedAppId}
        phone={phone}
        setPhone={setPhone}
        messageType={messageType}
        setMessageType={setMessageType}
        content={content}
        setContent={setContent}
        templateName={templateName}
        setTemplateName={setTemplateName}
        templates={templates}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
      />
      
      <CreateTemplateModalWA
        open={templateModalOpen}
        onOpenChange={setTemplateModalOpen}
        selectedAppId={selectedAppId}
        onCreated={() => selectedAppId && fetchTemplates(selectedAppId)}
      />

      <CreateCampaignWizardWA 
        open={campaignWizardOpen} 
        onOpenChange={setCampaignWizardOpen} 
        clientId={client?.id || ""} 
        onCreated={() => { fetchCampaigns(); fetchStats(); refetchClient(); }} 
        selectedAppId={selectedAppId}
        templates={templates}
      />
    </div>
  );
}

/* ─── Sub-Components ─── */

function StatsCard({ icon, color, label, value, subtext }: { icon: React.ReactNode; color: string; label: string; value: string | number; subtext: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg p-2.5" style={{ backgroundColor: `${color}15` }}>
            <div style={{ color }}>{icon}</div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold">{value}</p>
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
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function CampaignCard({ campaign, onRefresh }: { campaign: WACampaign; onRefresh: () => void }) {
  const progress = campaign.total_contacts > 0 ? Math.round((campaign.messages_sent / campaign.total_contacts) * 100) : 0;
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-semibold">{campaign.campaign_name}</h3>
            <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true })}</p>
          </div>
          <CampaignStatusBadge status={campaign.status} />
        </div>
        <Progress value={progress} className="h-2 mb-2" />
        <div className="flex gap-4 text-[10px] text-muted-foreground">
          <span>Sent: {campaign.messages_sent}</span>
          <span>Delivered: {campaign.messages_delivered}</span>
          <span>Total: {campaign.total_contacts}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function CampaignStatusBadge({ status }: { status: string }) {
  const variants: any = { sending: "default", completed: "secondary", scheduled: "outline", draft: "secondary" };
  return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
}

function MessageStatusBadge({ status }: { status: string }) {
  const icons: any = { 
    read: <CheckCheck className="h-3 w-3 text-blue-500" />, 
    delivered: <CheckCheck className="h-3 w-3 text-muted-foreground" />,
    sent: <CheckCircle className="h-3 w-3 text-muted-foreground" />,
    failed: <X className="h-3 w-3 text-destructive" />,
    queued: <Clock className="h-3 w-3 text-muted-foreground" />
  };
  return <span className="flex items-center gap-1 text-[10px] font-medium uppercase">{icons[status]} {status}</span>;
}

/* ─── Send Message Modal ─── */
function SendMessageModal({ 
  open, onOpenChange, clientId, onSent, assignedBots, selectedAppId, onAppChange,
  phone, setPhone, messageType, setMessageType, content, setContent, templateName, setTemplateName, templates,
  selectedLanguage, setSelectedLanguage
}: any) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [mediaUrl, setMediaUrl] = useState("");

  const selectedTemplate = templates.find((t: any) => (t.name || t.template_name) === templateName);
  const requiresMedia = selectedTemplate?.components?.some((c: any) => 
    c.type === "HEADER" && ["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"].includes(c.format)
  );
  const headerFormat = selectedTemplate?.components?.find((c: any) => c.type === "HEADER")?.format;

  const reset = () => { 
    setPhone(""); setContent(""); setMessageType("text"); setTemplateName(""); 
    setVariables({}); setMediaUrl("");
  };

  const detectedVariables = useMemo(() => {
    if (messageType !== "template") return [];
    const matches = content.match(/{{(\d+)}}/g) || [];
    return [...new Set(matches)].sort() as string[];
  }, [content, messageType]);

  const previewContent = useMemo(() => {
    let text = content;
    Object.entries(variables).forEach(([key, val]) => {
      text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val || `{{${key}}}`);
    });
    return text;
  }, [content, variables]);

  const handleSend = async () => {
    if (!phone.trim()) return toast({ title: "Phone required", variant: "destructive" });
    if (requiresMedia && !mediaUrl.trim()) return toast({ title: `${headerFormat} URL required`, variant: "destructive" });
    
    setSending(true);
    const bot = assignedBots.find((b: any) => b.id === selectedAppId);
    try {
      if (bot?.provider_type === 'api') {
        const bodyParams = detectedVariables.map((v: string) => variables[v.replace(/[{}]/g, '')] || "");
        await sendWhatsAppMessage({
          to: phone.trim(),
          body: previewContent,
          application_id: bot.id,
          client_id: clientId,
          phoneNoId: bot.api_config?.phone_id,
          baseUrl: bot.api_config?.panel_url,
          type: (requiresMedia ? headerFormat?.toLowerCase() : messageType) as any,
          name: templateName,
          language: selectedLanguage,
          mediaUrl: mediaUrl.trim() || undefined,
          bodyParams
        }, bot.api_config?.api_key);
        toast({ title: "Message sent!" });
      } else {
        await supabase.from("whatsapp_messages").insert({
          client_id: clientId, application_id: selectedAppId, phone_number: phone.trim(),
          message_type: messageType, message_content: previewContent,
          template_name: messageType === "template" ? templateName : null, status: "queued",
          sent_at: new Date().toISOString(), media_url: mediaUrl || null
        });
        toast({ title: "Message queued" });
      }
      onSent(); reset(); onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-green-500" /> Send Message</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div><Label>Bot</Label>
            <Select value={selectedAppId || ""} onValueChange={onAppChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{assignedBots.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Phone</Label><Input placeholder="+1234567890" value={phone} onChange={e => setPhone(e.target.value)} /></div>
          <div><Label>Type</Label>
            <Select value={messageType} onValueChange={setMessageType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="template">Template</SelectItem>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="audio">Audio</SelectItem>
                <SelectItem value="document">Document</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(requiresMedia || ["image", "video", "audio", "document"].includes(messageType)) && (
            <div><Label>{(headerFormat || messageType).toUpperCase()} URL</Label>
              <Input placeholder="https://..." value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} />
            </div>
          )}
          {messageType === "template" && (
            <div><Label>Template</Label>
              <Select value={templateName} onValueChange={(val) => {
                setTemplateName(val); setVariables({});
                const tpl = templates.find((t: any) => (t.name || t.template_name) === val);
                if (tpl) {
                  const body = tpl.components?.find((c: any) => c.type === 'BODY')?.text || tpl.body || "";
                  setContent(body);
                  setSelectedLanguage(tpl.language || tpl.language_code || "en_US");
                }
              }}>
                <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                <SelectContent>{templates.map((t: any, i: number) => <SelectItem key={i} value={t.name || t.template_name}>{t.name || t.template_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {messageType === "template" && detectedVariables.map((v: string, i: number) => (
            <div key={i} className="flex items-center gap-2">
              <Label className="w-12 text-right font-mono text-[10px]">{v}</Label>
              <Input className="h-8 text-xs" placeholder={`Value for ${v}`} onChange={e => setVariables(prev => ({ ...prev, [(v as string).replace(/[{}]/g, '')]: e.target.value }))} />
            </div>
          ))}
          <div><Label>Message</Label>
            <Textarea value={content} onChange={e => setContent(e.target.value)} readOnly={messageType === "template"} className="text-xs" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={sending || !phone.trim()} onClick={handleSend} className="bg-green-500 text-white hover:bg-green-600">
            {sending ? "Sending..." : "Send Message"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Create Template Modal ─── */
function CreateTemplateModalWA({ open, onOpenChange, selectedAppId, onCreated }: any) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("MARKETING");
  const [language, setLanguage] = useState("en_US");
  const [headerType, setHeaderType] = useState("NONE");
  const [headerText, setHeaderText] = useState("");
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = () => { setName(""); setCategory("MARKETING"); setLanguage("en_US"); setHeaderType("NONE"); setHeaderText(""); setBody(""); };

  const handleSubmit = async () => {
    if (!name.trim() || !body.trim()) return toast({ title: "Name and Body required", variant: "destructive" });
    setIsSubmitting(true);
    try {
      const components: any[] = [{ type: "BODY", text: body.trim() }];
      if (headerType !== "NONE") {
        const header: any = { type: "HEADER", format: headerType };
        if (headerType === "TEXT") header.text = headerText.trim();
        else header.example = { header_handle: [headerText.trim()] };
        components.unshift(header);
      }
      await createWhatsAppTemplate(selectedAppId!, {
        name: name.trim().toLowerCase().replace(/\s+/g, '_'),
        category, language, components
      });
      toast({ title: "Template submitted!" });
      onCreated(); onOpenChange(false); reset();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Create Template</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div><Label>Name</Label><Input placeholder="welcome_msg" value={name} onChange={e => setName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MARKETING">Marketing</SelectItem>
                  <SelectItem value="UTILITY">Utility</SelectItem>
                  <SelectItem value="AUTHENTICATION">Auth</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en_US">English (US)</SelectItem>
                  <SelectItem value="hi">Hindi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="p-3 bg-muted/30 rounded border border-dashed">
            <Label className="text-[10px] uppercase">Header</Label>
            <Select value={headerType} onValueChange={setHeaderType}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">None</SelectItem>
                <SelectItem value="TEXT">Text</SelectItem>
                <SelectItem value="IMAGE">Image</SelectItem>
                <SelectItem value="VIDEO">Video</SelectItem>
                <SelectItem value="AUDIO">Audio</SelectItem>
                <SelectItem value="DOCUMENT">Doc</SelectItem>
              </SelectContent>
            </Select>
            {headerType !== "NONE" && <Input className="h-8 text-xs mt-1" placeholder="Header text or Media URL" value={headerText} onChange={e => setHeaderText(e.target.value)} />}
          </div>
          <div><Label>Body</Label><Textarea value={body} onChange={e => setBody(e.target.value)} rows={4} placeholder="Hello {{1}}..." /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={isSubmitting} onClick={handleSubmit} className="bg-green-500 text-white">
            {isSubmitting ? "Submitting..." : "Create Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Campaign Wizard ─── */
function CreateCampaignWizardWA({ open, onOpenChange, clientId, onCreated, selectedAppId }: any) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [contacts, setContacts] = useState<any[]>([]);
  const [messageContent, setMessageContent] = useState("");
  const [creating, setCreating] = useState(false);

  const reset = () => { setStep(1); setName(""); setContacts([]); setMessageContent(""); };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const { data: campaign } = await supabase.from("whatsapp_campaigns").insert({
        client_id: clientId, campaign_name: name.trim(), message_template: messageContent.trim(),
        total_contacts: contacts.length, status: "sending"
      }).select("id").single();

        const msgs = contacts.map(c => ({
          client_id: clientId, 
          application_id: selectedAppId, 
          campaign_id: campaign.id,
          phone_number: c.phone, 
          message_content: messageContent, 
          message_type: "text" as const,
          template_name: null, 
          status: "queued" as const
        }));
        await supabase.from("whatsapp_messages").insert(msgs);
      toast({ title: "Campaign Launched!" });
      onCreated(); onOpenChange(false); reset();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>WhatsApp Campaign (Step {step})</DialogTitle></DialogHeader>
        {step === 1 && (
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <Button className="w-full" onClick={() => setStep(2)} disabled={!name.trim()}>Next</Button>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <Label>Import CSV (Mock import for now)</Label>
            <Input type="file" onChange={() => setContacts([{ phone: "12345" }, { phone: "67890" }])} />
            <Button className="w-full" onClick={() => setStep(3)} disabled={contacts.length === 0}>Next</Button>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-4">
            <div><Label>Message</Label><Textarea value={messageContent} onChange={e => setMessageContent(e.target.value)} /></div>
            <Button className="w-full bg-green-500 text-white" onClick={handleCreate} disabled={creating || !messageContent.trim()}>
              {creating ? "Launching..." : "Launch"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

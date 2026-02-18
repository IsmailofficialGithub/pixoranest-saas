import { useEffect, useState } from "react";
import { useClient } from "@/contexts/ClientContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import {
  Package, Activity, Users, Zap, MessageCircle, Phone,
  Share2, MessageSquare, AlertTriangle, XCircle, ArrowRight,
  PhoneIncoming, Headphones,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ServiceCard } from "@/components/services/ServiceCard";
import { useClientServices } from "@/hooks/useClientServices";
import { getServicePath } from "@/lib/service-routes";

interface DashboardStats {
  activeServices: number;
  totalUsage: number;
  leadsThisMonth: number;
  activeCampaigns: number;
}

interface ActivityItem {
  id: string;
  type: "call" | "campaign" | "whatsapp";
  description: string;
  status: string;
  timestamp: string;
}

export default function ClientDashboardHome() {
  const { profile } = useAuth();
  const { client, admin, assignedServices, isLoading: contextLoading, primaryColor } = useClient();
  const navigate = useNavigate();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!client || contextLoading) return;
    fetchDashboardData();
  }, [client, contextLoading]);

  async function fetchDashboardData() {
    if (!client) return;
    setIsLoading(true);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [leadsRes, campaignsRes, callsRes, waCampaignsRes, waMessagesRes] = await Promise.all([
      supabase.from("leads").select("id", { count: "exact", head: true })
        .eq("client_id", client.id).gte("created_at", monthStart),
      supabase.from("voice_campaigns").select("id", { count: "exact", head: true })
        .eq("client_id", client.id).in("status", ["running", "scheduled"]),
      supabase.from("call_logs").select("id, executed_at, status, phone_number, call_type, service_id")
        .eq("client_id", client.id).order("executed_at", { ascending: false }).limit(5),
      supabase.from("voice_campaigns").select("id, started_at, status, campaign_name")
        .eq("client_id", client.id).order("created_at", { ascending: false }).limit(5),
      supabase.from("whatsapp_messages").select("id, sent_at, status, phone_number")
        .eq("client_id", client.id).order("sent_at", { ascending: false }).limit(5),
    ]);

    const totalUsage = assignedServices.reduce((sum, s) => sum + s.usage_consumed, 0);

    setStats({
      activeServices: assignedServices.length,
      totalUsage,
      leadsThisMonth: leadsRes.count || 0,
      activeCampaigns: campaignsRes.count || 0,
    });

    // Build activity timeline
    const items: ActivityItem[] = [];
    callsRes.data?.forEach(c => {
      items.push({
        id: c.id,
        type: "call",
        description: `${c.call_type === "inbound" ? "Inbound" : "Outbound"} call ${c.call_type === "inbound" ? "from" : "to"} ${c.phone_number}`,
        status: c.status || "completed",
        timestamp: c.executed_at || new Date().toISOString(),
      });
    });
    waCampaignsRes.data?.forEach(c => {
      items.push({
        id: c.id,
        type: "campaign",
        description: `Campaign "${c.campaign_name}" ${c.status}`,
        status: c.status || "draft",
        timestamp: c.started_at || new Date().toISOString(),
      });
    });
    waMessagesRes.data?.forEach(m => {
      items.push({
        id: m.id,
        type: "whatsapp",
        description: `WhatsApp message sent to ${m.phone_number}`,
        status: m.status || "sent",
        timestamp: m.sent_at || new Date().toISOString(),
      });
    });

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setActivities(items.slice(0, 10));
    setIsLoading(false);
  }

  if (contextLoading || isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  // No services assigned state
  if (assignedServices.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">
            Welcome, {profile?.full_name || profile?.email}!
          </h1>
          <p className="text-sm text-muted-foreground">{client?.company_name}</p>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="rounded-full bg-muted p-6 mb-6">
            <Package className="h-12 w-12 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            No services have been assigned yet
          </h2>
          <p className="text-muted-foreground max-w-md mb-6">
            Contact {admin?.company_name || "your admin"} to get started with AI services.
          </p>
          <Button style={{ backgroundColor: primaryColor, color: "white" }}>
            <MessageCircle className="h-4 w-4 mr-2" />
            Contact Admin
          </Button>
        </div>
      </div>
    );
  }

  // Usage alerts
  const nearLimitServices = assignedServices.filter(s => {
    const pct = s.usage_limit > 0 ? (s.usage_consumed / s.usage_limit) * 100 : 0;
    return pct >= 80;
  });

  const hasService = (slug: string) => assignedServices.some(s => s.service_slug === slug || s.service_slug === `ai-${slug}`);

  const getUsageColor = (pct: number) => {
    if (pct >= 90) return "text-destructive";
    if (pct >= 70) return "text-yellow-600";
    return "text-emerald-600";
  };

  const getProgressColor = (pct: number) => {
    if (pct >= 90) return "[&>div]:bg-destructive";
    if (pct >= 70) return "[&>div]:bg-yellow-500";
    return "[&>div]:bg-emerald-500";
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "completed": case "success": case "delivered": case "read": return "default";
      case "running": case "sending": case "ringing": case "answered": return "secondary";
      case "failed": case "error": case "cancelled": return "destructive";
      default: return "outline";
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "call": return <Phone className="h-4 w-4" />;
      case "campaign": return <Zap className="h-4 w-4" />;
      case "whatsapp": return <MessageSquare className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Usage Alerts */}
      {nearLimitServices.length > 0 && (
        <div className="space-y-2">
          {nearLimitServices.map(svc => {
            const pct = Math.round((svc.usage_consumed / svc.usage_limit) * 100);
            const isOver = pct >= 100;
            return (
              <Alert key={svc.id} className={isOver ? "border-destructive/50 bg-destructive/5" : "border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20"}>
                {isOver ? <XCircle className="h-4 w-4 text-destructive" /> : <AlertTriangle className="h-4 w-4 text-yellow-600" />}
                <AlertDescription className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-sm">
                    {isOver
                      ? `🚫 You've reached your ${svc.service_name} limit`
                      : `⚠️ You're using ${pct}% of your ${svc.service_name} limit`
                    }
                  </span>
                  <Button variant="outline" size="sm" onClick={() => navigate("/client/usage")}>
                    View Usage
                  </Button>
                </AlertDescription>
              </Alert>
            );
          })}
        </div>
      )}

      {/* Welcome Banner */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-foreground truncate">
            Welcome back, {profile?.full_name || profile?.email}!
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            {client?.company_name}
          </p>
        </div>
        <p className="text-sm text-muted-foreground hidden sm:block shrink-0">
          {format(new Date(), "EEEE, MMMM d, yyyy")}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          icon={<Package className="h-5 w-5" />}
          color={primaryColor}
          label="Active Services"
          value={stats?.activeServices ?? 0}
          linkText="Manage"
          onLinkClick={() => navigate("/client/usage")}
        />
        <StatsCard
          icon={<Activity className="h-5 w-5" />}
          color={primaryColor}
          label="This Month Usage"
          value={`${(stats?.totalUsage ?? 0).toLocaleString()} units`}
          subtext="Across all services"
        />
        <StatsCard
          icon={<Users className="h-5 w-5" />}
          color={primaryColor}
          label="Leads This Month"
          value={stats?.leadsThisMonth ?? 0}
          linkText="View Leads"
          onLinkClick={() => navigate("/client/leads")}
        />
        <StatsCard
          icon={<Zap className="h-5 w-5" />}
          color={primaryColor}
          label="Active Campaigns"
          value={stats?.activeCampaigns ?? 0}
          subtext="Running now"
        />
      </div>

      {/* My Services */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">My Services</h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {assignedServices.map((svc) => {
            const pct = svc.usage_limit > 0 ? Math.round((svc.usage_consumed / svc.usage_limit) * 100) : 0;
            const isOverLimit = pct >= 100;
            const isNearLimit = pct >= 90 && !isOverLimit;

            return (
              <Card key={svc.id} className="flex flex-col">
                <CardContent className="pt-6 flex-1 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="rounded-lg p-2" style={{ backgroundColor: `${primaryColor}15` }}>
                        <ServiceIcon slug={svc.service_slug} color={primaryColor} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{svc.service_name}</p>
                        <Badge variant="outline" className="text-[10px] capitalize mt-0.5">{svc.service_category}</Badge>
                      </div>
                    </div>
                    {isOverLimit && (
                      <Badge variant="destructive" className="text-[10px] shrink-0">🚫 Limit Reached</Badge>
                    )}
                    {isNearLimit && (
                      <Badge className="text-[10px] shrink-0 bg-yellow-500 text-white hover:bg-yellow-600">⚠️ Near Limit</Badge>
                    )}
                  </div>

                  {/* Usage bar */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">
                        {svc.usage_consumed.toLocaleString()} / {svc.usage_limit.toLocaleString()} used
                      </span>
                      <span className={`font-medium ${getUsageColor(pct)}`}>{pct}%</span>
                    </div>
                    <Progress value={Math.min(pct, 100)} className={`h-2 ${getProgressColor(pct)}`} />
                    <p className="text-[11px] text-muted-foreground mt-1 capitalize">
                      Resets: {svc.reset_period || "never"}
                    </p>
                  </div>

                  {isOverLimit && (
                    <p className="text-[11px] text-destructive">Contact admin to increase your limit</p>
                  )}
                  {isNearLimit && (
                    <p className="text-[11px] text-yellow-600">Contact admin to increase limit</p>
                  )}
                </CardContent>
                <div className="px-6 pb-4">
                  {isOverLimit ? (
                    <Button variant="outline" size="sm" className="w-full">
                      Request Increase
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full text-white"
                      style={{ backgroundColor: primaryColor }}
                      onClick={() => navigate(getServicePath(svc.service_slug))}
                    >
                      Open
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* All Available Services (with lock state) */}
      <ClientAllServices primaryColor={primaryColor} />

      {/* Bottom Row: Activity + Quick Actions */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Recent Activity</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs">
              View All <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {activities.length > 0 ? (
              <div className="space-y-3">
                {activities.map((item) => (
                  <div key={`${item.type}-${item.id}`} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                    <div className="rounded-full p-2 bg-muted shrink-0 mt-0.5">
                      {getActivityIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{item.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                    <Badge variant={getStatusVariant(item.status)} className="text-[10px] shrink-0 capitalize">
                      {item.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <Activity className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">No activity yet</p>
                <p className="text-xs text-muted-foreground">Get started by using one of your services!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {hasService("voice-telecaller") && (
              <QuickActionButton
                icon={<Phone className="h-4 w-4" />}
                label="Start Calling Campaign"
                description="Launch voice telecaller"
                color={primaryColor}
                onClick={() => navigate(getServicePath("voice-telecaller"))}
              />
            )}
            {hasService("voice-receptionist") && (
              <QuickActionButton
                icon={<PhoneIncoming className="h-4 w-4" />}
                label="Voice Receptionist"
                description="Manage inbound calls"
                color={primaryColor}
                onClick={() => navigate(getServicePath("voice-receptionist"))}
              />
            )}
            {hasService("voice-agent") && (
              <QuickActionButton
                icon={<Headphones className="h-4 w-4" />}
                label="Voice Agent"
                description="AI voice conversations"
                color={primaryColor}
                onClick={() => navigate(getServicePath("voice-agent"))}
              />
            )}
            {hasService("whatsapp") && (
              <QuickActionButton
                icon={<MessageCircle className="h-4 w-4" />}
                label="Send WhatsApp Campaign"
                description="Bulk messaging"
                color={primaryColor}
                onClick={() => navigate(getServicePath("whatsapp"))}
              />
            )}
            {hasService("social-media") && (
              <QuickActionButton
                icon={<Share2 className="h-4 w-4" />}
                label="Schedule Post"
                description="Social media management"
                color={primaryColor}
                onClick={() => navigate(getServicePath("social-media"))}
              />
            )}
            <QuickActionButton
              icon={<Users className="h-4 w-4" />}
              label="View All Leads"
              description="Manage captured leads"
              color={primaryColor}
              onClick={() => navigate("/client/leads")}
            />
            <QuickActionButton
              icon={<MessageSquare className="h-4 w-4" />}
              label="Contact Support"
              description="Message your admin"
              color={primaryColor}
              onClick={() => {}}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ─── All Services with Lock State ─── */

function ClientAllServices({ primaryColor }: { primaryColor: string }) {
  const { services, loading } = useClientServices();

  // Only show locked services here (unlocked are shown in "My Services" above)
  const lockedServices = services.filter((s) => s.is_locked);

  if (loading) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Other Services</h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  if (lockedServices.length === 0) return null;

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground mb-4">
        Other Services
        <Badge variant="outline" className="ml-2 text-xs">{lockedServices.length} locked</Badge>
      </h2>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {lockedServices.map((s) => (
          <ServiceCard key={s.id} service={s} primaryColor={primaryColor} />
        ))}
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

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

function QuickActionButton({
  icon, label, description, color, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full rounded-lg border p-3 text-left transition-colors hover:border-transparent"
      style={{ ["--hover-bg" as string]: `${color}10` }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = `${color}10`; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = ""; }}
    >
      <div className="rounded-md p-2" style={{ backgroundColor: `${color}15`, color }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}

function ServiceIcon({ slug, color }: { slug: string; color: string }) {
  const props = { className: "h-4 w-4", style: { color } };
  switch (slug) {
    case "voice-telecaller": return <Phone {...props} />;
    case "voice-receptionist": return <PhoneIncoming {...props} />;
    case "voice-agent": return <Headphones {...props} />;
    case "whatsapp": return <MessageCircle {...props} />;
    case "social-media": return <Share2 {...props} />;
    default: return <Package {...props} />;
  }
}

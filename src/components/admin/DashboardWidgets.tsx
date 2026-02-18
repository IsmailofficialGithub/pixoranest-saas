import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAdmin } from "@/contexts/AdminContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Target, AlertTriangle, FileText, Clock, UserPlus, Activity,
  ArrowRight, MessageSquare, ChevronUp, ChevronDown, GripVertical, Eye, EyeOff,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

/* ============ Types ============ */
export interface WidgetConfig {
  id: string;
  position: number;
  size: "small" | "medium" | "large";
  visible: boolean;
}

interface WidgetProps {
  adminId: string;
  primaryColor: string;
}

const WIDGET_META: Record<string, { title: string; description: string }> = {
  revenue_goal: { title: "Revenue Goal", description: "Track monthly revenue progress" },
  clients_near_limit: { title: "Usage Alerts", description: "Clients near usage limits" },
  pending_invoices: { title: "Pending Invoices", description: "Unpaid invoice summary" },
  recent_activity: { title: "Recent Activity", description: "Latest platform events" },
  pending_actions: { title: "Pending Actions", description: "Items needing attention" },
};

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: "revenue_goal", position: 0, size: "medium", visible: true },
  { id: "pending_actions", position: 1, size: "medium", visible: true },
  { id: "clients_near_limit", position: 2, size: "medium", visible: true },
  { id: "pending_invoices", position: 3, size: "medium", visible: true },
  { id: "recent_activity", position: 4, size: "large", visible: true },
];

const STORAGE_KEY = "admin_dashboard_widgets";

/* ============ Main Component ============ */
export default function DashboardWidgets() {
  const { admin, primaryColor } = useAdmin();
  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_WIDGETS;
    } catch {
      return DEFAULT_WIDGETS;
    }
  });
  const [customizing, setCustomizing] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
  }, [widgets]);

  const visibleWidgets = useMemo(
    () => widgets.filter((w) => w.visible).sort((a, b) => a.position - b.position),
    [widgets]
  );

  function toggleVisibility(id: string) {
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w))
    );
  }

  function moveWidget(id: string, dir: -1 | 1) {
    setWidgets((prev) => {
      const sorted = [...prev].sort((a, b) => a.position - b.position);
      const idx = sorted.findIndex((w) => w.id === id);
      const targetIdx = idx + dir;
      if (targetIdx < 0 || targetIdx >= sorted.length) return prev;
      const temp = sorted[idx].position;
      sorted[idx].position = sorted[targetIdx].position;
      sorted[targetIdx].position = temp;
      return [...sorted];
    });
  }

  if (!admin) return null;

  return (
    <div className="space-y-4">
      {/* Customize toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Dashboard Widgets</h2>
        <Button
          variant={customizing ? "default" : "outline"}
          size="sm"
          onClick={() => setCustomizing((c) => !c)}
        >
          {customizing ? "Done" : "Customize"}
        </Button>
      </div>

      {/* Customization panel */}
      {customizing && (
        <Card className="border-dashed">
          <CardContent className="py-4 space-y-2">
            <p className="text-xs text-muted-foreground mb-2">
              Toggle widgets on/off and reorder them using arrows.
            </p>
            {widgets
              .sort((a, b) => a.position - b.position)
              .map((w) => {
                const meta = WIDGET_META[w.id];
                return (
                  <div
                    key={w.id}
                    className="flex items-center gap-3 rounded-md border px-3 py-2"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{meta?.title ?? w.id}</p>
                      <p className="text-xs text-muted-foreground">{meta?.description}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveWidget(w.id, -1)}>
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveWidget(w.id, 1)}>
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleVisibility(w.id)}>
                        {w.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      )}

      {/* Widget grid */}
      <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
        {visibleWidgets.map((w) => {
          const Widget = WIDGET_COMPONENTS[w.id];
          if (!Widget) return null;
          return (
            <div key={w.id} className={w.size === "large" ? "md:col-span-2" : ""}>
              <Widget adminId={admin.id} primaryColor={primaryColor} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============ Widget Components ============ */

function RevenueGoalWidget({ adminId, primaryColor }: WidgetProps) {
  const [goal, setGoal] = useState(() => {
    try { return Number(localStorage.getItem("revenue_goal")) || 100000; } catch { return 100000; }
  });
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const { data } = await supabase
        .from("invoices")
        .select("total_amount")
        .eq("admin_id", adminId)
        .eq("status", "paid")
        .gte("invoice_date", start);
      setCurrent(data?.reduce((s, i) => s + Number(i.total_amount), 0) || 0);
      setLoading(false);
    })();
  }, [adminId]);

  const pct = goal > 0 ? Math.min(Math.round((current / goal) * 100), 100) : 0;
  const daysLeft = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();
  const status = pct >= 80 ? "Ahead of schedule" : pct >= 50 ? "On track" : "Behind schedule";

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Target className="h-4 w-4" style={{ color: primaryColor }} />
          Revenue Goal
        </CardTitle>
        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setEditing(!editing)}>
          {editing ? "Done" : "Edit Goal"}
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <div className="space-y-3">
            {editing && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">₹</span>
                <input
                  type="number"
                  value={goal}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setGoal(v);
                    localStorage.setItem("revenue_goal", String(v));
                  }}
                  className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
            )}
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold">₹{current.toLocaleString("en-IN")}</p>
                <p className="text-xs text-muted-foreground">of ₹{goal.toLocaleString("en-IN")} goal</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold" style={{ color: primaryColor }}>{pct}%</p>
                <p className="text-xs text-muted-foreground">{daysLeft} days left</p>
              </div>
            </div>
            <Progress value={pct} className="h-2" />
            <p className={`text-xs font-medium ${pct >= 50 ? "text-emerald-600" : "text-amber-600"}`}>
              {status}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ClientsNearLimitWidget({ adminId, primaryColor }: WidgetProps) {
  const navigate = useNavigate();
  const [clients, setClients] = useState<{ clientName: string; serviceName: string; pct: number; clientId: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: clientIds } = await supabase.from("clients").select("id, company_name").eq("admin_id", adminId);
      if (!clientIds?.length) { setLoading(false); return; }

      const { data: cs } = await supabase
        .from("client_services")
        .select("client_id, service_id, usage_consumed, usage_limit")
        .in("client_id", clientIds.map((c) => c.id))
        .eq("is_active", true);

      const nearLimit = (cs || []).filter(
        (s) => s.usage_limit > 0 && (s.usage_consumed || 0) >= s.usage_limit * 0.8
      );

      if (!nearLimit.length) { setClients([]); setLoading(false); return; }

      const serviceIds = [...new Set(nearLimit.map((s) => s.service_id))];
      const { data: services } = await supabase.from("services").select("id, name").in("id", serviceIds);
      const sMap = new Map(services?.map((s) => [s.id, s.name]));
      const cMap = new Map(clientIds.map((c) => [c.id, c.company_name]));

      setClients(
        nearLimit.map((s) => ({
          clientName: cMap.get(s.client_id) || "Unknown",
          serviceName: sMap.get(s.service_id) || "Unknown",
          pct: Math.round(((s.usage_consumed || 0) / s.usage_limit) * 100),
          clientId: s.client_id,
        })).sort((a, b) => b.pct - a.pct).slice(0, 5)
      );
      setLoading(false);
    })();
  }, [adminId]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          Usage Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : clients.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">All clients within limits ✓</p>
        ) : (
          <div className="space-y-3">
            {clients.map((c, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{c.clientName}</p>
                  <p className="text-xs text-muted-foreground">{c.serviceName}</p>
                </div>
                <Badge variant={c.pct >= 100 ? "destructive" : "secondary"} className="shrink-0">
                  {c.pct}%
                </Badge>
                <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0" onClick={() => navigate(`/admin/clients/${c.clientId}`)}>
                  View
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PendingInvoicesWidget({ adminId, primaryColor }: WidgetProps) {
  const navigate = useNavigate();
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("invoices")
        .select("total_amount, status, due_date")
        .eq("admin_id", adminId)
        .in("status", ["sent", "overdue", "draft"]);

      const invoices = data || [];
      setCount(invoices.length);
      setTotal(invoices.reduce((s, i) => s + Number(i.total_amount), 0));
      setOverdueCount(invoices.filter((i) => i.status === "overdue").length);
      setLoading(false);
    })();
  }, [adminId]);

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" style={{ color: primaryColor }} />
          Pending Invoices
        </CardTitle>
        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate("/admin/billing")}>
          View All <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-16 w-full" />
        ) : count === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No pending invoices ✓</p>
        ) : (
          <div className="space-y-2">
            <p className="text-2xl font-bold">₹{total.toLocaleString("en-IN")}</p>
            <div className="flex gap-3">
              <Badge variant="secondary">{count} pending</Badge>
              {overdueCount > 0 && (
                <Badge variant="destructive">{overdueCount} overdue</Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PendingActionsWidget({ adminId, primaryColor }: WidgetProps) {
  const navigate = useNavigate();
  const [data, setData] = useState({ pendingSetup: 0, unpaidInvoices: 0, unreadMessages: 0 });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      const { data: clientIds } = await supabase.from("clients").select("id").eq("admin_id", adminId);
      const ids = clientIds?.map((c) => c.id) || [];

      const [setupRes, invoiceRes, msgRes] = await Promise.all([
        ids.length
          ? supabase.from("client_workflow_instances").select("id", { count: "exact", head: true }).in("client_id", ids).eq("status", "pending")
          : Promise.resolve({ count: 0 }),
        supabase.from("invoices").select("id", { count: "exact", head: true }).eq("admin_id", adminId).in("status", ["sent", "overdue"]),
        user
          ? supabase.from("messages").select("id", { count: "exact", head: true }).eq("receiver_id", user.id).eq("is_read", false)
          : Promise.resolve({ count: 0 }),
      ]);

      setData({
        pendingSetup: setupRes.count || 0,
        unpaidInvoices: invoiceRes.count || 0,
        unreadMessages: msgRes.count || 0,
      });
      setLoading(false);
    })();
  }, [adminId, user]);

  const items = [
    { label: "Service setups pending", count: data.pendingSetup, route: "/admin/clients", icon: Clock },
    { label: "Invoices awaiting payment", count: data.unpaidInvoices, route: "/admin/billing", icon: FileText },
    { label: "Unread messages", count: data.unreadMessages, route: null, icon: MessageSquare },
  ].filter((i) => i.count > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4" style={{ color: primaryColor }} />
          Pending Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-20 w-full" />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">All caught up! ✓</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => item.route && navigate(item.route)}
              >
                <div className="flex items-center gap-2">
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{item.label}</span>
                </div>
                <Badge variant="secondary">{item.count}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecentActivityWidget({ adminId, primaryColor }: WidgetProps) {
  const [events, setEvents] = useState<{ text: string; time: string; type: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const timeline: { text: string; time: string; type: string }[] = [];

      const [clientsRes, invoicesRes] = await Promise.all([
        supabase.from("clients").select("company_name, created_at")
          .eq("admin_id", adminId).order("created_at", { ascending: false }).limit(3),
        supabase.from("invoices").select("invoice_number, status, created_at, paid_at")
          .eq("admin_id", adminId).order("created_at", { ascending: false }).limit(3),
      ]);

      clientsRes.data?.forEach((c) => {
        timeline.push({
          text: `${c.company_name} joined`,
          time: c.created_at,
          type: "client",
        });
      });

      invoicesRes.data?.forEach((inv) => {
        if (inv.status === "paid" && inv.paid_at) {
          timeline.push({ text: `${inv.invoice_number} paid`, time: inv.paid_at, type: "payment" });
        } else {
          timeline.push({ text: `${inv.invoice_number} created`, time: inv.created_at, type: "invoice" });
        }
      });

      timeline.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setEvents(timeline.slice(0, 6));
      setLoading(false);
    })();
  }, [adminId]);

  const iconForType = (type: string) => {
    if (type === "client") return <UserPlus className="h-3 w-3" />;
    if (type === "payment") return <FileText className="h-3 w-3 text-emerald-500" />;
    return <FileText className="h-3 w-3" />;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4" style={{ color: primaryColor }} />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-28 w-full" />
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {events.map((ev, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted shrink-0">
                  {iconForType(ev.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{ev.text}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(ev.time), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const WIDGET_COMPONENTS: Record<string, React.FC<WidgetProps>> = {
  revenue_goal: RevenueGoalWidget,
  clients_near_limit: ClientsNearLimitWidget,
  pending_invoices: PendingInvoicesWidget,
  pending_actions: PendingActionsWidget,
  recent_activity: RecentActivityWidget,
};

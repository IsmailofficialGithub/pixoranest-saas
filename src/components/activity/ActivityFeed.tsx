import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Phone, MessageSquare, UserPlus, Zap, Activity, Bell,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

type ActivityType = "call" | "lead" | "campaign" | "whatsapp";

interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: string;
  status?: string;
}

const TYPE_CONFIG: Record<ActivityType, { icon: typeof Phone; label: string }> = {
  call: { icon: Phone, label: "Calls" },
  lead: { icon: UserPlus, label: "Leads" },
  campaign: { icon: Zap, label: "Campaigns" },
  whatsapp: { icon: MessageSquare, label: "WhatsApp" },
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  completed: "default",
  answered: "default",
  delivered: "default",
  read: "default",
  running: "secondary",
  sending: "secondary",
  new: "secondary",
  failed: "destructive",
  error: "destructive",
};

interface ActivityFeedProps {
  clientId: string;
  /** Maximum items to show */
  limit?: number;
  /** Show type filter chips */
  showFilters?: boolean;
  /** Card wrapper or bare list */
  asCard?: boolean;
  className?: string;
}

export function ActivityFeed({
  clientId,
  limit = 30,
  showFilters = true,
  asCard = true,
  className,
}: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | ActivityType>("all");

  const fetchActivities = useCallback(async () => {
    setLoading(true);

    const [callsRes, leadsRes, campaignsRes, waRes] = await Promise.all([
      supabase
        .from("call_logs")
        .select("id, phone_number, status, duration_seconds, executed_at, call_type")
        .eq("client_id", clientId)
        .order("executed_at", { ascending: false })
        .limit(10),
      supabase
        .from("leads")
        .select("id, name, phone, lead_score, status, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("voice_campaigns")
        .select("id, campaign_name, status, contacts_called, total_contacts, created_at, started_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("whatsapp_messages")
        .select("id, phone_number, status, sent_at")
        .eq("client_id", clientId)
        .order("sent_at", { ascending: false })
        .limit(10),
    ]);

    const items: ActivityItem[] = [];

    (callsRes.data ?? []).forEach((c) =>
      items.push({
        id: `call-${c.id}`,
        type: "call",
        title: c.status === "answered" ? "Call Answered" : `Call ${c.call_type === "inbound" ? "Received" : "Made"}`,
        description: `${c.phone_number}${c.duration_seconds ? ` • ${c.duration_seconds}s` : ""}`,
        timestamp: c.executed_at ?? new Date().toISOString(),
        status: c.status ?? undefined,
      })
    );

    (leadsRes.data ?? []).forEach((l) =>
      items.push({
        id: `lead-${l.id}`,
        type: "lead",
        title: (l.lead_score ?? 0) >= 80 ? "🔥 Hot Lead" : "New Lead",
        description: `${l.name || l.phone} • Score ${l.lead_score ?? 0}/100`,
        timestamp: l.created_at,
        status: l.status ?? undefined,
      })
    );

    (campaignsRes.data ?? []).forEach((c) =>
      items.push({
        id: `camp-${c.id}`,
        type: "campaign",
        title: c.status === "completed" ? "Campaign Completed" : `Campaign ${c.status}`,
        description: `${c.campaign_name} • ${c.contacts_called ?? 0}/${c.total_contacts ?? 0}`,
        timestamp: c.started_at ?? c.created_at,
        status: c.status ?? undefined,
      })
    );

    (waRes.data ?? []).forEach((m) =>
      items.push({
        id: `wa-${m.id}`,
        type: "whatsapp",
        title: "WhatsApp Message",
        description: m.phone_number,
        timestamp: m.sent_at ?? new Date().toISOString(),
        status: m.status ?? undefined,
      })
    );

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setActivities(items.slice(0, limit));
    setLoading(false);
  }, [clientId, limit]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`activity-feed-${clientId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "call_logs",
        filter: `client_id=eq.${clientId}`,
      }, () => fetchActivities())
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "leads",
        filter: `client_id=eq.${clientId}`,
      }, () => fetchActivities())
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "whatsapp_messages",
        filter: `client_id=eq.${clientId}`,
      }, () => fetchActivities())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId, fetchActivities]);

  const filtered = filter === "all" ? activities : activities.filter((a) => a.type === filter);

  const content = (
    <>
      {showFilters && (
        <div className="flex flex-wrap gap-1 mb-4">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" />
          {(Object.keys(TYPE_CONFIG) as ActivityType[]).map((t) => (
            <FilterChip
              key={t}
              active={filter === t}
              onClick={() => setFilter(t)}
              label={TYPE_CONFIG[t].label}
            />
          ))}
        </div>
      )}

      <ScrollArea className="max-h-[500px]">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10">
            <Bell className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No activity yet</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((item) => {
              const cfg = TYPE_CONFIG[item.type];
              const Icon = cfg.icon;
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-md p-2 hover:bg-muted/50 transition-colors"
                >
                  <div className="rounded-full bg-muted p-2 shrink-0 mt-0.5">
                    <Icon className="h-3.5 w-3.5 text-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground truncate">
                        {item.title}
                      </p>
                      {item.status && (
                        <Badge
                          variant={STATUS_VARIANT[item.status] ?? "outline"}
                          className="text-[10px] shrink-0 capitalize"
                        >
                          {item.status}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.description}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </>
  );

  if (!asCard) return <div className={className}>{content}</div>;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Activity Feed</CardTitle>
        </div>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-xs px-3 py-1 rounded-full transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted/80"
      )}
    >
      {label}
    </button>
  );
}

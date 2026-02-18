import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Info, CheckCircle, AlertTriangle, AlertCircle, Trash2, MailOpen, Loader2,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  is_read: boolean;
  action_url: string | null;
  created_at: string;
  read_at: string | null;
}

const typeConfig: Record<string, { icon: typeof Info; color: string; bg: string }> = {
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-50" },
  success: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-50" },
  warning: { icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-50" },
  error: { icon: AlertCircle, color: "text-destructive", bg: "bg-red-50" },
};

const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [readFilter, setReadFilter] = useState<"all" | "unread" | "read">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    let query = supabase
      .from("notifications")
      .select("id, title, message, type, is_read, action_url, created_at, read_at", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (readFilter === "unread") query = query.eq("is_read", false);
    if (readFilter === "read") query = query.eq("is_read", true);
    if (typeFilter !== "all") query = query.eq("type", typeFilter as any);

    const { data, count, error } = await query;
    if (!error && data) {
      setNotifications(data as Notification[]);
      setTotalCount(count ?? 0);
    }
    setSelected(new Set());
    setLoading(false);
  }, [user, page, readFilter, typeFilter]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);
  useEffect(() => { setPage(0); }, [readFilter, typeFilter]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === notifications.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(notifications.map((n) => n.id)));
    }
  };

  const bulkMarkRead = async () => {
    if (selected.size === 0) return;
    setActionLoading(true);
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in("id", Array.from(selected));
    if (!error) {
      toast({ title: `${selected.size} notification(s) marked as read` });
      fetchNotifications();
    }
    setActionLoading(false);
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    setActionLoading(true);
    const { error } = await supabase
      .from("notifications")
      .delete()
      .in("id", Array.from(selected));
    if (!error) {
      toast({ title: `${selected.size} notification(s) deleted` });
      fetchNotifications();
    } else {
      toast({ title: "Error deleting", description: error.message, variant: "destructive" });
    }
    setActionLoading(false);
  };

  const deleteOne = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    fetchNotifications();
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">All Notifications</h1>
        <p className="mt-1 text-muted-foreground">View and manage all your notifications</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <Tabs value={readFilter} onValueChange={(v) => setReadFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
            <TabsTrigger value="read">Read</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-muted-foreground">{selected.size} selected</span>
            <Button variant="outline" size="sm" onClick={bulkMarkRead} disabled={actionLoading}>
              <MailOpen className="h-4 w-4" />Mark Read
            </Button>
            <Button variant="destructive" size="sm" onClick={bulkDelete} disabled={actionLoading}>
              <Trash2 className="h-4 w-4" />Delete
            </Button>
          </div>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No notifications found
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {/* Select all */}
          <div className="flex items-center gap-2 px-2">
            <Checkbox
              checked={selected.size === notifications.length && notifications.length > 0}
              onCheckedChange={toggleAll}
            />
            <span className="text-xs text-muted-foreground">Select all</span>
          </div>

          {notifications.map((notif) => {
            const cfg = typeConfig[notif.type] || typeConfig.info;
            const Icon = cfg.icon;
            return (
              <Card
                key={notif.id}
                className={`transition-colors ${!notif.is_read ? "border-primary/30 bg-primary/5" : ""}`}
              >
                <CardContent className="flex items-start gap-3 p-4">
                  <Checkbox
                    checked={selected.has(notif.id)}
                    onCheckedChange={() => toggleSelect(notif.id)}
                    className="mt-1"
                  />
                  {!notif.is_read && (
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                  <div className={`mt-0.5 rounded-full p-1.5 ${cfg.bg}`}>
                    <Icon className={`h-4 w-4 ${cfg.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">{notif.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{notif.message}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {notif.action_url && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={notif.action_url}>View</a>
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteOne(notif.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-[10px]">{notif.type}</Badge>
                      <span>{format(new Date(notif.created_at), "PPp")}</span>
                      <span>({formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })})</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
              Next<ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

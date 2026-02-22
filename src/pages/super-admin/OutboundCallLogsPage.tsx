// Outbound Call Logs Page for Super Admin
import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Phone, Search, MoreHorizontal, Eye, Trash2, RefreshCw, Filter, X, PhoneCall, PhoneOff, PhoneMissed, CheckCircle, AlertTriangle, Calendar as CalendarIcon, Bot, User, List
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

interface CallLog {
  id: string;
  phone: string;
  name: string | null;
  call_status: string | null;
  duration: number | null;
  transcript: string | null;
  agent: string | null;
  started_at: string | null;
  created_at: string;
  bot_id: string | null;
  owner_user_id: string;
  // Enriched
  owner_email?: string;
  bot_name?: string;
}

const STATUS_CONFIG: Record<string, { icon: any, color: string, label: string }> = {
  completed: { icon: CheckCircle, color: "text-green-600 bg-green-50", label: "Completed" },
  answered: { icon: PhoneCall, color: "text-green-600 bg-green-50", label: "Answered" },
  busy: { icon: PhoneOff, color: "text-yellow-600 bg-yellow-50", label: "Busy" },
  no_answer: { icon: PhoneMissed, color: "text-muted-foreground bg-muted/50", label: "No Answer" },
  failed: { icon: AlertTriangle, color: "text-destructive bg-red-50", label: "Failed" },
};

export default function OutboundCallLogsPage() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const listIdParam = searchParams.get("listId");
  
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLog, setSelectedLog] = useState<CallLog | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Logs
      let query = supabase
        .from("outbound_call_logs" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("call_status", statusFilter);
      }

      if (listIdParam) {
        query = query.eq("list_id", listIdParam);
      }

      const { data, error } = await query;
      if (error) throw error;

      // 2. Enrich with owner and bot info
      const enriched = await Promise.all((data || []).map(async (log: any) => {
        const [profileRes, botRes] = await Promise.all([
          supabase.from("profiles").select("email").eq("user_id", log.owner_user_id).single(),
          log.bot_id ? supabase.from("outboundagents" as any).select("name").eq("id", log.bot_id).maybeSingle() : Promise.resolve({ data: null })
        ]);

        return {
          ...log,
          owner_email: profileRes.data?.email || "Unknown",
          bot_name: botRes.data?.name || "No Bot",
        };
      }));

      setLogs(enriched);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, statusFilter, listIdParam]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filtered = useMemo(() => {
    return logs.filter(l => 
      l.phone.includes(search) || 
      (l.name && l.name.toLowerCase().includes(search.toLowerCase())) ||
      (l.owner_email && l.owner_email.toLowerCase().includes(search.toLowerCase()))
    );
  }, [logs, search]);

  const paged = useMemo(() => {
    return filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  }, [filtered, page]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this call log?")) return;
    const { error } = await supabase.from("outbound_call_logs" as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Log removed successfully." });
      fetchLogs();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Outbound Call Logs</h1>
          <p className="text-muted-foreground">Monitor all automated outbound calls</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          <Button variant={showFilters ? "secondary" : "outline"} onClick={() => setShowFilters(!showFilters)}>
            <Filter className="mr-2 h-4 w-4" /> Filters
          </Button>
        </div>
      </div>

      {listIdParam && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-primary font-medium">
            <List className="h-4 w-4" />
            Filtering call logs for specific list
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSearchParams({})} className="h-8 text-xs">
            Show All Logs <X className="ml-2 h-3 w-3" />
          </Button>
        </div>
      )}

      {showFilters && (
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="answered">Answered</SelectItem>
                  <SelectItem value="busy">Busy</SelectItem>
                  <SelectItem value="no_answer">No Answer</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 flex items-end">
              <Button variant="ghost" size="sm" onClick={() => { setStatusFilter("all"); setSearch(""); }} className="text-xs">
                <X className="mr-1 h-3 w-3" /> Clear All Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by phone, name or owner email..."
          className="pl-9"
          value={search}
          onChange={(e) => {setSearch(e.target.value); setPage(0);}}
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Phone className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-foreground">No call logs found</h3>
            <p className="text-sm text-muted-foreground">Adjust filters or check for new activity.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Owner / Bot</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((log) => {
                  const status = STATUS_CONFIG[log.call_status || ""] || { icon: Phone, color: "text-muted-foreground", label: log.call_status || "Unknown" };
                  const StatusIcon = status.icon;
                  
                  return (
                    <TableRow key={log.id} className="group">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{log.phone}</span>
                          {log.name && <span className="text-xs text-muted-foreground">{log.name}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col space-y-1">
                          <div className="flex items-center text-[10px] text-muted-foreground">
                            <User className="mr-1 h-3 w-3" /> {log.owner_email}
                          </div>
                          <div className="flex items-center text-[10px] text-primary font-medium">
                            <Bot className="mr-1 h-3 w-3" /> {log.bot_name}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-[10px] px-2 py-0 h-5 gap-1 border-none", status.color)}>
                          <StatusIcon className="h-3 w-3" /> {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {log.duration ? `${Math.floor(log.duration / 60)}m ${Math.floor(log.duration % 60)}s` : "—"}
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">
                        {log.created_at ? format(new Date(log.created_at), "MMM d, HH:mm") : "—"}
                        <div className="text-[9px] opacity-60">
                          {log.created_at ? formatDistanceToNow(new Date(log.created_at), { addSuffix: true }) : ""}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedLog(log)}>
                              <Eye className="mr-2 h-4 w-4" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(log.id)} className="text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between mt-4">
             <div className="text-sm text-muted-foreground">
               Showing {paged.length} of {filtered.length} logs
             </div>
             {totalPages > 1 && (
               <div className="flex gap-2">
                 <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                   Prev
                 </Button>
                 <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                   Next
                 </Button>
               </div>
             )}
          </div>
        </>
      )}

      {/* Details Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Call Details: {selectedLog?.phone}</DialogTitle>
            <DialogDescription>
              {selectedLog?.created_at && format(new Date(selectedLog.created_at), "PPPP 'at' HH:mm:ss")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-4">
              <div>
                <Label className="text-[10px] uppercase text-muted-foreground">Call Status</Label>
                <p className="text-sm font-semibold capitalize">{selectedLog?.call_status || "Unknown"}</p>
              </div>
              <div>
                <Label className="text-[10px] uppercase text-muted-foreground">Duration</Label>
                <p className="text-sm">{selectedLog?.duration ? `${selectedLog.duration} seconds` : "—"}</p>
              </div>
              <div>
                <Label className="text-[10px] uppercase text-muted-foreground">Bot Handled</Label>
                <p className="text-sm">{selectedLog?.bot_name}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label className="text-[10px] uppercase text-muted-foreground">Owner Account</Label>
                <p className="text-sm">{selectedLog?.owner_email}</p>
              </div>
              <div>
                <Label className="text-[10px] uppercase text-muted-foreground">Agent Name</Label>
                <p className="text-sm">{selectedLog?.agent || "N/A"}</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] uppercase text-muted-foreground">Transcript</Label>
            <div className="p-4 bg-muted rounded-md max-h-[300px] overflow-y-auto text-sm italic border">
              {selectedLog?.transcript || "No transcript available for this call."}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedLog(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

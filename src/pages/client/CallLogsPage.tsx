import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useClient } from "@/contexts/ClientContext";
import { supabase } from "@/integrations/supabase/client";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { format, formatDistanceToNow, subDays, startOfDay, endOfDay } from "date-fns";
import {
  Phone, Play, Pause, Download, FileText, Users, Search, Filter, X,
  MoreVertical, Volume2, ChevronLeft, ChevronRight, Loader2, PhoneCall,
  PhoneOff, PhoneMissed, AlertTriangle, CheckCircle, Trash2, StickyNote,
  Share2, SkipForward, SkipBack,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useIsMobile } from "@/hooks/use-mobile";

// ─── Types ───
interface CallLogEntry {
  id: string;
  phone_number: string;
  status: string | null;
  duration_seconds: number | null;
  ai_summary: string | null;
  recording_url: string | null;
  transcript: string | null;
  executed_at: string | null;
  call_type: string | null;
  cost: number | null;
  contact_name?: string | null;
  campaign_name?: string | null;
  campaign_id?: string | null;
  lead_id?: string | null;
  lead_score?: number | null;
}

interface CampaignOption {
  id: string;
  campaign_name: string;
}

const CALL_STATUS_CONFIG: Record<string, { icon: typeof Phone; color: string; label: string }> = {
  completed: { icon: CheckCircle, color: "text-green-600", label: "Completed" },
  answered: { icon: PhoneCall, color: "text-green-600", label: "Answered" },
  busy: { icon: PhoneOff, color: "text-yellow-600", label: "Busy" },
  no_answer: { icon: PhoneMissed, color: "text-muted-foreground", label: "No Answer" },
  failed: { icon: AlertTriangle, color: "text-destructive", label: "Failed" },
  initiated: { icon: Phone, color: "text-blue-500", label: "Initiated" },
  ringing: { icon: Phone, color: "text-blue-500", label: "Ringing" },
};

const DATE_PRESETS = [
  { label: "Today", days: 0 },
  { label: "Yesterday", days: 1 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
];

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "0s";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const PAGE_SIZE = 50;

export default function CallLogsPage() {
  const { client, assignedServices, isLoading: ctxLoading, primaryColor } = useClient();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();

  const telecallerService = assignedServices.find(s => s.service_slug === "voice-telecaller" || s.service_slug === "ai-voice-telecaller");

  const [callLogs, setCallLogs] = useState<CallLogEntry[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [campaignFilter, setCampaignFilter] = useState(searchParams.get("campaign") || "all");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [datePreset, setDatePreset] = useState("30");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(subDays(new Date(), 30));
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());
  const [leadsOnly, setLeadsOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Modals
  const [playerCall, setPlayerCall] = useState<CallLogEntry | null>(null);
  const [transcriptCall, setTranscriptCall] = useState<CallLogEntry | null>(null);
  const [leadModal, setLeadModal] = useState<CallLogEntry | null>(null);

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Fetch campaigns list
  useEffect(() => {
    if (!client) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("outbound_scheduled_calls")
        .select("id, list_id, outbound_contact_lists(name)")
        .eq("owner_user_id", client.user_id)
        .order("created_at", { ascending: false });
      
      const mapped = (data || []).map((d: any) => ({
        id: d.id,
        campaign_name: d.outbound_contact_lists?.name || 'Outbound Campaign'
      }));
      setCampaigns(mapped);
    })();
  }, [client]);

  // Fetch call logs
  const fetchCallLogs = useCallback(async () => {
    if (!client) return;
    setLoading(true);

    // Build query
    let query: any = (supabase as any)
      .from("outbound_call_logs")
      .select("*", { count: "exact" })
      .eq("owner_user_id", client.user_id)
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (dateFrom) query = query.gte("created_at", startOfDay(dateFrom).toISOString());
    if (dateTo) query = query.lte("created_at", endOfDay(dateTo).toISOString());
    if (debouncedSearch) {
      query = query.or(`phone.ilike.%${debouncedSearch}%,transcript.ilike.%${debouncedSearch}%`);
    }
    if (statusFilters.length > 0) {
      query = query.in("call_status", statusFilters);
    }

    const { data: logs, count, error } = await query;
    if (error) {
      console.error("Error fetching call logs:", error);
      setLoading(false);
      return;
    }

    setTotalCount(count || 0);

    // Enrich with contact names, campaign names, and lead info
    const logIds = (logs || []).map((l: any) => l.id);
    if (logIds.length === 0) {
      setCallLogs([]);
      setLoading(false);
      return;
    }

    const campaignMap = new Map(campaigns.map(c => [c.id, c.campaign_name]));

    let enriched: CallLogEntry[] = (logs || []).map((l: any) => {
      return {
        id: l.id,
        phone_number: l.phone,
        status: l.call_status,
        duration_seconds: l.duration,
        ai_summary: l.transcript,
        recording_url: l.call_url,
        transcript: l.transcript,
        executed_at: l.created_at,
        call_type: l.call_type,
        cost: 0,
        contact_name: l.name || null,
        campaign_id: l.scheduled_call_id || null,
        campaign_name: l.scheduled_call_id ? campaignMap.get(l.scheduled_call_id) || null : null,
        lead_id: null, // Logic for getting lead ID from `leads` table if necessary can be added here
        lead_score: null, 
      };
    });

    // Client-side filters that can't easily be done server-side
    if (campaignFilter !== "all") {
      enriched = enriched.filter(l => l.campaign_id === campaignFilter);
    }
    if (leadsOnly) {
      enriched = enriched.filter(l => l.lead_id);
    }

    setCallLogs(enriched);
    setLoading(false);
  }, [client, page, debouncedSearch, statusFilters, dateFrom, dateTo, campaignFilter, leadsOnly, campaigns]);

  useEffect(() => {
    fetchCallLogs();
  }, [fetchCallLogs]);

  // Reset page on filter change
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, statusFilters, dateFrom, dateTo, campaignFilter, leadsOnly]);

  function handleDatePreset(days: string) {
    setDatePreset(days);
    if (days === "custom") return;
    const d = parseInt(days);
    if (d === 0) {
      setDateFrom(startOfDay(new Date()));
      setDateTo(new Date());
    } else if (d === 1) {
      const y = subDays(new Date(), 1);
      setDateFrom(startOfDay(y));
      setDateTo(endOfDay(y));
    } else {
      setDateFrom(subDays(new Date(), d));
      setDateTo(new Date());
    }
  }

  function toggleStatus(status: string) {
    setStatusFilters(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  }

  function clearFilters() {
    setSearchQuery("");
    setCampaignFilter("all");
    setStatusFilters([]);
    setDatePreset("30");
    setDateFrom(subDays(new Date(), 30));
    setDateTo(new Date());
    setLeadsOnly(false);
  }

  function exportCsv() {
    const headers = "Phone,Name,Campaign,Status,Duration,AI Summary,Lead Score,Timestamp\n";
    const rows = callLogs.map(l =>
      [
        l.phone_number,
        l.contact_name || "",
        l.campaign_name || "",
        l.status || "",
        formatDuration(l.duration_seconds),
        (l.ai_summary || "").replace(/,/g, ";").replace(/\n/g, " "),
        l.lead_score ?? "",
        l.executed_at ? format(new Date(l.executed_at), "yyyy-MM-dd HH:mm") : "",
      ].join(",")
    ).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `call_logs_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleSelectAll() {
    if (selected.size === callLogs.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(callLogs.map(l => l.id)));
    }
  }

  function toggleSelect(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hasActiveFilters = debouncedSearch || campaignFilter !== "all" || statusFilters.length > 0 || leadsOnly;

  if (!ctxLoading && !telecallerService) return <Navigate to="/client" replace />;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Call Logs</h1>
          <p className="text-sm text-muted-foreground">All your outbound calls</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="h-4 w-4 mr-2" /> Export
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by phone number, name, or summary..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant={showFilters ? "default" : "outline"}
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            style={showFilters ? { backgroundColor: primaryColor, color: "white" } : undefined}
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        {showFilters && (
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {/* Campaign filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Campaign</Label>
                  <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Campaigns</SelectItem>
                      {campaigns.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.campaign_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date range */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Date Range</Label>
                  <Select value={datePreset} onValueChange={handleDatePreset}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DATE_PRESETS.map(p => (
                        <SelectItem key={p.days} value={String(p.days)}>{p.label}</SelectItem>
                      ))}
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {datePreset === "custom" && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs">From</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal text-sm">
                            {dateFrom ? format(dateFrom, "PP") : "Pick date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">To</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal text-sm">
                            {dateTo ? format(dateTo, "PP") : "Pick date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={dateTo} onSelect={setDateTo} className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </>
                )}
              </div>

              {/* Status filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <div className="flex flex-wrap gap-2">
                  {["answered", "completed", "busy", "no_answer", "failed"].map(s => (
                    <button
                      key={s}
                      onClick={() => toggleStatus(s)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        statusFilters.includes(s)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-foreground border-border hover:bg-muted"
                      }`}
                    >
                      {CALL_STATUS_CONFIG[s]?.label || s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Leads only */}
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={leadsOnly}
                  onCheckedChange={(v) => setLeadsOnly(!!v)}
                  id="leads-only"
                />
                <Label htmlFor="leads-only" className="text-xs cursor-pointer">Show only calls that became leads</Label>
              </div>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
                  <X className="h-3 w-3 mr-1" /> Clear Filters
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted">
          <span className="text-xs text-muted-foreground">{selected.size} selected</span>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setSelected(new Set())}>
            Deselect All
          </Button>
          <Button variant="outline" size="sm" className="text-xs" onClick={exportCsv}>
            <Download className="h-3 w-3 mr-1" /> Export Selected
          </Button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : callLogs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-5 mb-4">
              <Phone className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No calls yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              {hasActiveFilters
                ? "No calls match your filters. Try adjusting your search criteria."
                : "Create a campaign to start calling"}
            </p>
            {!hasActiveFilters && (
              <Button style={{ backgroundColor: primaryColor, color: "white" }}
                onClick={() => navigate("/client/voice-telecaller")}>
                Create Campaign
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table */}
          {!isMobile ? (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selected.size === callLogs.length && callLogs.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>AI Summary</TableHead>
                      <TableHead>Lead</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {callLogs.map(call => (
                      <TableRow key={call.id}>
                        <TableCell>
                          <Checkbox
                            checked={selected.has(call.id)}
                            onCheckedChange={() => toggleSelect(call.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            {call.contact_name && (
                              <p className="text-xs text-muted-foreground">{call.contact_name}</p>
                            )}
                            <p className="font-mono text-sm font-medium">{call.phone_number}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {call.campaign_name ? (
                            <Badge variant="secondary" className="text-xs cursor-pointer"
                              onClick={() => call.campaign_id && navigate(`/client/voice-telecaller/campaigns/${call.campaign_id}`)}>
                              {call.campaign_name}
                            </Badge>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell><CallStatusBadge status={call.status} /></TableCell>
                        <TableCell className={`text-sm ${call.status !== "answered" && call.status !== "completed" ? "text-muted-foreground" : ""}`}>
                          {formatDuration(call.duration_seconds)}
                        </TableCell>
                        <TableCell>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]" title={call.ai_summary || ""}>
                            {call.ai_summary || "—"}
                          </p>
                        </TableCell>
                        <TableCell>
                          {call.lead_score != null ? (
                            <Badge className={`text-xs ${
                              call.lead_score > 70 ? "bg-green-100 text-green-700" :
                              call.lead_score > 40 ? "bg-yellow-100 text-yellow-700" :
                              "bg-red-100 text-red-700"
                            } border-0`}>
                              {call.lead_score}/100
                            </Badge>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {call.executed_at
                            ? formatDistanceToNow(new Date(call.executed_at), { addSuffix: true })
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <CallActions call={call} onPlay={setPlayerCall} onTranscript={setTranscriptCall} onMarkLead={setLeadModal} navigate={navigate} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            /* Mobile Cards */
            <div className="space-y-3">
              {callLogs.map(call => (
                <Card key={call.id} className="overflow-hidden">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        {call.contact_name && <p className="text-xs text-muted-foreground">{call.contact_name}</p>}
                        <p className="font-mono text-sm font-medium">{call.phone_number}</p>
                      </div>
                      <CallStatusBadge status={call.status} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatDuration(call.duration_seconds)}</span>
                      {call.campaign_name && (
                        <Badge variant="secondary" className="text-[10px]">{call.campaign_name}</Badge>
                      )}
                    </div>
                    {call.lead_score != null && (
                      <div className="flex items-center gap-1">
                        <Badge className={`text-[10px] ${
                          call.lead_score > 70 ? "bg-green-100 text-green-700" :
                          call.lead_score > 40 ? "bg-yellow-100 text-yellow-700" :
                          "bg-red-100 text-red-700"
                        } border-0`}>
                          🎯 {call.lead_score}/100
                        </Badge>
                      </div>
                    )}
                    {call.ai_summary && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{call.ai_summary}</p>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-muted-foreground">
                        {call.executed_at ? formatDistanceToNow(new Date(call.executed_at), { addSuffix: true }) : ""}
                      </span>
                      <div className="flex gap-1">
                        {call.recording_url && (
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setPlayerCall(call)}>
                            <Play className="h-3 w-3 mr-1" /> Play
                          </Button>
                        )}
                        {call.lead_id ? (
                          <Button variant="outline" size="sm" className="h-7 text-xs"
                            onClick={() => navigate("/client/leads")}>
                            View Lead
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" className="h-7 text-xs"
                            onClick={() => setLeadModal(call)}>
                            <Users className="h-3 w-3 mr-1" /> Lead
                          </Button>
                        )}
                        <CallActions call={call} onPlay={setPlayerCall} onTranscript={setTranscriptCall} onMarkLead={setLeadModal} navigate={navigate} compact />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount} calls
            </p>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Audio Player Modal */}
      {playerCall && (
        <AudioPlayerModal
          call={playerCall}
          onClose={() => setPlayerCall(null)}
          onMarkLead={() => { setPlayerCall(null); setLeadModal(playerCall); }}
          primaryColor={primaryColor}
        />
      )}

      {/* Transcript Modal */}
      {transcriptCall && (
        <TranscriptModal
          call={transcriptCall}
          onClose={() => setTranscriptCall(null)}
        />
      )}

      {/* Mark as Lead Modal */}
      {leadModal && (
        <MarkAsLeadModal
          call={leadModal}
          clientId={client?.id || ""}
          onClose={() => setLeadModal(null)}
          onCreated={() => { setLeadModal(null); fetchCallLogs(); toast.success("Lead created!"); }}
        />
      )}
    </div>
  );
}

/* ─── Sub Components ─── */

function CallStatusBadge({ status }: { status: string | null }) {
  const cfg = CALL_STATUS_CONFIG[status || ""] || { icon: Phone, color: "text-muted-foreground", label: status || "Unknown" };
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`text-xs gap-1 ${cfg.color}`}>
      <Icon className="h-3 w-3" /> {cfg.label}
    </Badge>
  );
}

function CallActions({
  call, onPlay, onTranscript, onMarkLead, navigate, compact,
}: {
  call: CallLogEntry;
  onPlay: (c: CallLogEntry) => void;
  onTranscript: (c: CallLogEntry) => void;
  onMarkLead: (c: CallLogEntry) => void;
  navigate: (path: string) => void;
  compact?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={compact ? "h-7 w-7" : "h-8 w-8"}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {call.recording_url && (
          <DropdownMenuItem onClick={() => onPlay(call)}>
            <Play className="h-3 w-3 mr-2" /> Play Recording
          </DropdownMenuItem>
        )}
        {call.transcript && (
          <DropdownMenuItem onClick={() => onTranscript(call)}>
            <FileText className="h-3 w-3 mr-2" /> View Transcript
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {call.lead_id ? (
          <DropdownMenuItem onClick={() => navigate("/client/leads")}>
            <Users className="h-3 w-3 mr-2" /> View Lead
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => onMarkLead(call)}>
            <Users className="h-3 w-3 mr-2" /> Mark as Lead
          </DropdownMenuItem>
        )}
        {call.recording_url && (
          <DropdownMenuItem asChild>
            <a href={call.recording_url} download>
              <Download className="h-3 w-3 mr-2" /> Download Recording
            </a>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ─── Audio Player Modal ─── */
function AudioPlayerModal({
  call, onClose, onMarkLead, primaryColor,
}: {
  call: CallLogEntry;
  onClose: () => void;
  onMarkLead: () => void;
  primaryColor: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState([80]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(audio.duration);
    const onEnd = () => setIsPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume[0] / 100;
  }, [volume]);

  function togglePlay() {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
    setIsPlaying(!isPlaying);
  }

  function seek(pct: number[]) {
    if (audioRef.current && duration) {
      audioRef.current.currentTime = (pct[0] / 100) * duration;
    }
  }

  function changeRate(rate: number) {
    setPlaybackRate(rate);
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }

  function skip(seconds: number) {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
    }
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  }

  // Parse transcript into timestamped lines
  const transcriptLines = useMemo(() => {
    if (!call.transcript) return [];
    return call.transcript.split("\n").filter(Boolean).map(line => {
      const match = line.match(/^\[(\d{2}:\d{2})\]\s*(.*?):\s*(.*)/);
      if (match) {
        const [, time, speaker, text] = match;
        const [m, s] = time.split(":").map(Number);
        return { time: m * 60 + s, timeStr: time, speaker, text };
      }
      return { time: 0, timeStr: "", speaker: "", text: line };
    });
  }, [call.transcript]);

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                {call.contact_name || call.phone_number}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2 mt-1">
                {call.phone_number}
                {call.executed_at && <span>• {format(new Date(call.executed_at), "PPp")}</span>}
                <CallStatusBadge status={call.status} />
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <audio ref={audioRef} src={call.recording_url || ""} preload="metadata" />

        {/* Player Controls */}
        <div className="space-y-4 py-4">
          {/* Progress */}
          <div className="space-y-1">
            <Slider value={[progressPct]} max={100} step={0.1} onValueChange={seek} className="cursor-pointer" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Controls row */}
          <div className="flex items-center justify-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => skip(-10)}>
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              className="h-12 w-12 rounded-full"
              style={{ backgroundColor: primaryColor, color: "white" }}
              onClick={togglePlay}
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => skip(10)}>
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          {/* Volume and speed */}
          <div className="flex items-center gap-4 justify-center">
            <div className="flex items-center gap-2 w-32">
              <Volume2 className="h-3 w-3 text-muted-foreground shrink-0" />
              <Slider value={volume} max={100} step={1} onValueChange={setVolume} />
            </div>
            <Select value={String(playbackRate)} onValueChange={v => changeRate(parseFloat(v))}>
              <SelectTrigger className="w-20 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0.75, 1, 1.25, 1.5, 2].map(r => (
                  <SelectItem key={r} value={String(r)}>{r}x</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {call.recording_url && (
              <Button variant="ghost" size="sm" className="text-xs h-7" asChild>
                <a href={call.recording_url} download><Download className="h-3 w-3 mr-1" /> Download</a>
              </Button>
            )}
          </div>
        </div>

        {/* Transcript */}
        {transcriptLines.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Transcript</h4>
            <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg bg-muted p-3 text-xs">
              {transcriptLines.map((line, i) => (
                <div
                  key={i}
                  className={`flex gap-2 p-1 rounded cursor-pointer hover:bg-background/50 transition-colors ${
                    line.time <= currentTime && (transcriptLines[i + 1]?.time ?? Infinity) > currentTime
                      ? "bg-background shadow-sm"
                      : ""
                  }`}
                  onClick={() => {
                    if (audioRef.current && line.time) {
                      audioRef.current.currentTime = line.time;
                    }
                  }}
                >
                  {line.timeStr && (
                    <span className="text-muted-foreground shrink-0 font-mono">[{line.timeStr}]</span>
                  )}
                  {line.speaker && (
                    <span className={`font-medium shrink-0 ${
                      line.speaker.toLowerCase().includes("ai") ? "text-blue-600" : "text-green-600"
                    }`}>
                      {line.speaker}:
                    </span>
                  )}
                  <span>{line.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Summary */}
        {call.ai_summary && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Call Summary</h4>
            <p className="text-sm text-muted-foreground bg-muted rounded-lg p-3">{call.ai_summary}</p>
          </div>
        )}

        {/* Quick actions */}
        <DialogFooter className="gap-2">
          {!call.lead_id && (
            <Button variant="outline" size="sm" onClick={onMarkLead}>
              <Users className="h-3 w-3 mr-1" /> Mark as Lead
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => {
            navigator.clipboard.writeText(call.recording_url || "");
            toast.success("Link copied!");
          }}>
            <Share2 className="h-3 w-3 mr-1" /> Share
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Transcript Modal ─── */
function TranscriptModal({ call, onClose }: { call: CallLogEntry; onClose: () => void }) {
  function copyTranscript() {
    navigator.clipboard.writeText(call.transcript || "");
    toast.success("Transcript copied!");
  }

  function downloadTranscript() {
    const blob = new Blob([call.transcript || ""], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript_${call.phone_number}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Call Transcript</DialogTitle>
          <DialogDescription>{call.contact_name || call.phone_number}</DialogDescription>
        </DialogHeader>
        <div className="max-h-96 overflow-y-auto">
          {call.transcript ? (
            <pre className="text-sm whitespace-pre-wrap font-mono bg-muted rounded-lg p-4">
              {call.transcript}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No transcript available for this call.</p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={copyTranscript}>
            <Share2 className="h-3 w-3 mr-1" /> Copy
          </Button>
          <Button variant="outline" size="sm" onClick={downloadTranscript}>
            <Download className="h-3 w-3 mr-1" /> Download TXT
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Mark as Lead Modal ─── */
function MarkAsLeadModal({
  call, clientId, onClose, onCreated,
}: {
  call: CallLogEntry;
  clientId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState(call.contact_name || "");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [score, setScore] = useState([50]);
  const [interest, setInterest] = useState([5]);
  const [notes, setNotes] = useState(call.ai_summary || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!clientId) return;
    setSaving(true);
    const { error } = await supabase.from("leads").insert({
      client_id: clientId,
      call_log_id: call.id,
      campaign_id: call.campaign_id || null,
      lead_source: "telecaller" as const,
      name: name || null,
      phone: call.phone_number,
      email: email || null,
      company: company || null,
      lead_score: score[0],
      interest_level: interest[0],
      status: "new" as const,
      notes: notes || null,
    });
    setSaving(false);
    if (error) {
      toast.error("Failed to create lead");
      console.error(error);
    } else {
      onCreated();
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Lead</DialogTitle>
          <DialogDescription>From call to {call.phone_number}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Contact name" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Phone</Label>
            <Input value={call.phone_number} disabled className="font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Company</Label>
              <Input value={company} onChange={e => setCompany(e.target.value)} placeholder="Company name" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Lead Score: {score[0]}/100</Label>
            <Slider value={score} max={100} step={1} onValueChange={setScore} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Interest Level: {interest[0]}/10</Label>
            <Slider value={interest} max={10} step={1} onValueChange={setInterest} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Additional notes..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Save Lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

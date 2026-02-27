import { useEffect, useState, useCallback } from "react";
import { useClient } from "@/contexts/ClientContext";
import { supabase } from "@/integrations/supabase/client";
import { Navigate, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initiateInstantCall } from "@/lib/instant-call";
import {
  Phone, CheckCircle, Users, Plus, MoreVertical, Play,
  FileText, ArrowRight, Lightbulb, ChevronDown, X,
  Pause, Copy, Trash2, Eye, Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import CreateCampaignWizard from "@/components/client/telecaller/CreateCampaignWizard";

interface CampaignStats {
  totalCalls: number;
  completedCalls: number;
  successRate: number;
  leadsCount: number;
}

interface Campaign {
  id: string;
  campaign_name: string;
  status: string;
  created_at: string;
  scheduled_at: string | null;
  list_id: string | null;
}

interface CallLog {
  id: string;
  phone_number: string;
  duration_seconds: number;
  status: string;
  ai_summary: string | null;
  executed_at: string;
  recording_url: string | null;
  call_type: string | null;
  contact_name: string | null;
}

export default function VoiceTelecallerPage() {
  const { client, assignedServices, isLoading: contextLoading, primaryColor } = useClient();
  const navigate = useNavigate();

  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [recentCalls, setRecentCalls] = useState<CallLog[]>([]);
  const [outboundLeads, setOutboundLeads] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [tipsVisible, setTipsVisible] = useState(() => {
    return localStorage.getItem("hide-telecaller-tips") !== "true";
  });
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [instantCallOpen, setInstantCallOpen] = useState(false);
  const [instantCallPhone, setInstantCallPhone] = useState("");
  const [instantCallName, setInstantCallName] = useState("");
  const [isCalling, setIsCalling] = useState(false);
  const [hasBot, setHasBot] = useState<boolean>(true); // assume true until checked

  const [selectedCallData, setSelectedCallData] = useState<{
    name?: string;
    phone?: string;
    status?: string;
    time?: string;
    transcript?: string;
  } | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  // Check access
  const telecallerService = assignedServices.find(s => s.service_slug === "voice-telecaller" || s.service_slug === "ai-voice-telecaller");

  useEffect(() => {
    if (!client) return;
    fetchAllData();
  }, [client]);

  // Realtime subscription for campaigns
  useEffect(() => {
    if (!client) return;
    const channel = supabase
      .channel("telecaller-campaigns")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "outbound_contact_lists",
        filter: `owner_user_id=eq.${client.user_id}`,
      }, () => {
        fetchCampaigns();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [client]);

  const fetchAllData = useCallback(async () => {
    if (!client) return;
    setIsLoading(true);
    await Promise.all([fetchBotStatus(), fetchStats(), fetchCampaigns(), fetchRecentCalls(), fetchOutboundLeads()]);
    setIsLoading(false);
  }, [client]);

  async function fetchBotStatus() {
    if (!client) return;
    // Assume bot is active globally logic for this tier, or check workflow instances
    setHasBot(true);
  }

  async function fetchStats() {
    if (!client) return;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [callsRes, leadsRes] = await Promise.all([
      supabase
        .from("outbound_call_logs")
        .select("call_status")
        .eq("owner_user_id", client.user_id)
        .gte("created_at", monthStart),
      supabase
        .from("outbound_leads")
        .select("id", { count: "exact", head: true })
        .eq("owner_user_id", client.user_id)
        .gte("created_at", monthStart),
    ]);

    const calls = (callsRes.data as any[]) || [];
    const completed = calls.filter(c => c.call_status === "completed" || c.call_status === "answered").length;
    const total = calls.length;

    setStats({
      totalCalls: total,
      completedCalls: completed,
      successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      leadsCount: leadsRes.count || 0,
    });
  }

  async function fetchCampaigns() {
    if (!client) return;
    const { data } = await supabase.from("outbound_contact_lists")
      .select(`id, name, description, created_at`)
      .eq("owner_user_id", client.user_id)
      .order("created_at", { ascending: false });

    if (data) {
      const mapped = data.map((d: any) => ({
        id: d.id,
        campaign_name: d.name || 'Outbound Campaign',
        status: 'running', // Fallback as we don't track status directly in lists
        created_at: d.created_at,
        scheduled_at: null,
        list_id: d.id
      }));
      setCampaigns(mapped);
    }
  }

  async function fetchRecentCalls() {
    if (!client) return;
    const { data } = await supabase.from("outbound_call_logs")
      .select("id, phone, name, duration, transcript, call_url, call_type, call_status, created_at")
      .eq("owner_user_id", client.user_id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) {
      const mapped = data.map((d: any) => ({
        id: d.id,
        phone_number: d.phone,
        duration_seconds: parseInt(d.duration) || 0,
        status: d.call_status || 'unknown',
        ai_summary: d.transcript,
        executed_at: d.created_at,
        recording_url: d.call_url,
        call_type: d.call_type,
        contact_name: d.name || d.phone
      }));
      setRecentCalls(mapped);
    }
  }

  async function fetchOutboundLeads() {
    if (!client) return;
    const { data } = await supabase.from("outbound_leads")
      .select(`
        id, status, notes, created_at,
        outbound_call_logs ( id, transcript, phone, name )
      `)
      .eq("owner_user_id", client.user_id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) {
      const mapped = data.map((d: any) => {
        const callLog = Array.isArray(d.outbound_call_logs) ? d.outbound_call_logs[0] : d.outbound_call_logs;
        return {
          id: d.id,
          status: d.status,
          notes: d.notes,
          created_at: d.created_at,
          phone: callLog?.phone,
          name: callLog?.name,
          transcript: callLog?.transcript,
          call_log_id: callLog?.id
        };
      });
      setOutboundLeads(mapped);
    }
  }

  if (contextLoading) {
    return <LoadingSkeleton />;
  }

  if (!telecallerService) {
    return <Navigate to="/client" replace />;
  }

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  const filteredCampaigns = activeTab === "all"
    ? campaigns
    : campaigns.filter(c => c.status === activeTab);

  const dismissTips = () => {
    setTipsVisible(false);
    localStorage.setItem("hide-telecaller-tips", "true");
  };

  const handleInstantCall = async () => {
    if (!instantCallPhone) return toast.error("Phone number is required");
    setIsCalling(true);
    try {
      await initiateInstantCall(instantCallPhone, instantCallName, client.user_id);
      toast.success(`Calling ${instantCallPhone}...`);
      setInstantCallOpen(false);
      setInstantCallPhone("");
      setInstantCallName("");
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate call");
    } finally {
      setIsCalling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">AI Voice Telecaller</h1>
          <p className="text-sm text-muted-foreground">Automate your outbound calling campaigns</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Badge variant="outline" className="text-xs py-1 px-3">
            {telecallerService.usage_consumed} / {telecallerService.usage_limit} calls used
          </Badge>
          {!hasBot ? (
            <Badge variant="destructive" className="text-xs py-1 px-3">
              No Active Bot
            </Badge>
          ) : (
            <>
              <Button variant="outline" onClick={() => setInstantCallOpen(true)}>
                <Phone className="h-4 w-4 mr-2 text-green-500" />
                Instant Call
              </Button>
              <Button style={{ backgroundColor: primaryColor, color: "white" }} onClick={() => setWizardOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Campaign
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <StatsCard
          icon={<Phone className="h-5 w-5" />}
          color={primaryColor}
          label="Total Calls"
          value={stats?.totalCalls ?? 0}
          subtext="This month"
        />
        <StatsCard
          icon={<CheckCircle className="h-5 w-5" />}
          color="#22c55e"
          label="Success Rate"
          value={`${stats?.successRate ?? 0}%`}
          subtext={`${stats?.completedCalls ?? 0} of ${stats?.totalCalls ?? 0} calls`}
        />
        <StatsCard
          icon={<Users className="h-5 w-5" />}
          color={primaryColor}
          label="Leads Captured"
          value={stats?.leadsCount ?? 0}
        // linkText="View Leads"
        // onLinkClick={() => navigate("/client/leads")}
        />
      </div>

      {/* Quick Tips */}
      {tipsVisible && (
        <Collapsible defaultOpen>
          <Card className="border-dashed">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CollapsibleTrigger className="flex items-center gap-2 cursor-pointer">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                <CardTitle className="text-sm">Quick Tips</CardTitle>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </CollapsibleTrigger>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={dismissTips}>
                <X className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="grid gap-2 sm:grid-cols-2 text-xs text-muted-foreground">
                  <p>📝 Prepare your call script with variables like {"{name}"}, {"{company}"}</p>
                  <p>📊 Upload contacts as CSV with name, phone, and custom fields</p>
                  <p>🎯 Best time to call: 10 AM – 4 PM on weekdays</p>
                  <p>✅ Review AI summaries to identify hot leads</p>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Campaigns Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">My Campaigns</h2>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {[
            { key: "all", label: "All Campaigns" },
            { key: "running", label: "Running" },
            { key: "scheduled", label: "Scheduled" },
            { key: "completed", label: "Completed" },
            { key: "leads", label: "Leads" },
            { key: "call_logs", label: "Call Logs" },
          ].map(tab => (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? "default" : "outline"}
              size="sm"
              className="text-xs shrink-0"
              style={activeTab === tab.key ? { backgroundColor: primaryColor, color: "white" } : undefined}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              {tab.key !== "all" && tab.key !== "leads" && tab.key !== "call_logs" && (
                <span className="ml-1.5 text-[10px] opacity-70">
                  ({campaigns.filter(c => tab.key === "all" ? true : c.status === tab.key).length})
                </span>
              )}
            </Button>
          ))}
        </div>

        {/* Campaign Cards */}
        {activeTab === "leads" ? (
          <Card>
            <CardContent className="py-6">
              {outboundLeads.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contact Name</TableHead>
                        <TableHead>Phone Number</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead className="w-10 text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {outboundLeads.map(lead => (
                        <TableRow key={lead.id}>
                          <TableCell className="font-medium text-sm">{lead.name || "—"}</TableCell>
                          <TableCell className="font-mono text-sm">{lead.phone || "—"}</TableCell>
                          <TableCell className="capitalize text-sm">{lead.status || "new"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => {
                              setSelectedCallData({
                                name: lead.name,
                                phone: lead.phone,
                                status: lead.status,
                                time: lead.created_at,
                                transcript: lead.transcript
                              });
                              setDetailsModalOpen(true);
                            }}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="rounded-full bg-muted p-5 mb-4">
                    <Users className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    No leads captured yet
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Leads identified from your calls will appear here.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : activeTab === "call_logs" ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Recent Calls</CardTitle>
            </CardHeader>
            <CardContent>
              {recentCalls.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contact Name</TableHead>
                        <TableHead>Phone Number</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead className="w-10 text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentCalls.map(call => (
                        <TableRow key={call.id}>
                          <TableCell className="font-medium text-sm">{call.contact_name || "—"}</TableCell>
                          <TableCell className="font-mono text-sm">{call.phone_number}</TableCell>
                          <TableCell className="text-sm">{formatDuration(call.duration_seconds)}</TableCell>
                          <TableCell><CallStatusBadge status={call.status} /></TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(call.executed_at), { addSuffix: true })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => {
                              setSelectedCallData({
                                name: call.contact_name,
                                phone: call.phone_number,
                                status: call.status,
                                time: call.executed_at,
                                transcript: call.ai_summary
                              });
                              setDetailsModalOpen(true);
                            }}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-10">
                  <Phone className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No calls recorded yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : filteredCampaigns.length > 0 ? (
          <div className="space-y-3">
            {filteredCampaigns.map(campaign => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                primaryColor={primaryColor}
                navigate={navigate}
              />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          /* Empty state – no campaigns at all */
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-5 mb-4">
                <Phone className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                No calling campaigns yet
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-6">
                {hasBot
                  ? "Create your first campaign to start reaching out to customers with AI-powered calls."
                  : "You need an active bot to run campaigns. Please contact your admin."}
              </p>
              {hasBot && (
                <Button style={{ backgroundColor: primaryColor, color: "white" }} size="lg" onClick={() => setWizardOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Campaign
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          /* Empty state – filter has no results */
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-sm text-muted-foreground">No {activeTab} campaigns found.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Calls */}
      {activeTab !== "call_logs" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Recent Calls</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/client/voice-telecaller/calls")}>
              View All <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentCalls.length > 0 ? (
              <>
                {/* Desktop table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Phone Number</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>AI Summary</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentCalls.map(call => (
                        <TableRow key={call.id}>
                          <TableCell className="font-mono text-sm">{call.phone_number}</TableCell>
                          <TableCell className="text-sm">{formatDuration(call.duration_seconds)}</TableCell>
                          <TableCell><CallStatusBadge status={call.status} /></TableCell>
                          <TableCell>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]" title={call.ai_summary || ""}>
                              {call.ai_summary || "—"}
                            </p>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(call.executed_at), { addSuffix: true })}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {call.recording_url && (
                                  <DropdownMenuItem>
                                    <Play className="h-3 w-3 mr-2" /> Play Recording
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => {
                                  setSelectedCallData({
                                    name: call.contact_name,
                                    phone: call.phone_number,
                                    status: call.status,
                                    time: call.executed_at,
                                    transcript: call.ai_summary
                                  });
                                  setDetailsModalOpen(true);
                                }}>
                                  <FileText className="h-3 w-3 mr-2" /> View Transcript
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Users className="h-3 w-3 mr-2" /> Mark as Lead
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile cards */}
                <div className="space-y-3 md:hidden">
                  {recentCalls.map(call => (
                    <div key={call.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm">{call.phone_number}</span>
                        <CallStatusBadge status={call.status} />
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatDuration(call.duration_seconds)}</span>
                        <span>{formatDistanceToNow(new Date(call.executed_at), { addSuffix: true })}</span>
                      </div>
                      {call.ai_summary && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{call.ai_summary}</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-10">
                <Phone className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No calls recorded yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      <CreateCampaignWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        primaryColor={primaryColor}
        usageLimit={telecallerService.usage_limit}
        usageConsumed={telecallerService.usage_consumed}
        clientId={client?.id || ""}
        userId={client?.user_id || ""}
      />

      <Dialog open={instantCallOpen} onOpenChange={setInstantCallOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Instant Call</DialogTitle>
            <DialogDescription>Make a single instant call to a customer directly.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input placeholder="+1234567890" value={instantCallPhone} onChange={e => setInstantCallPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Customer Name (Optional)</Label>
              <Input placeholder="John Doe" value={instantCallName} onChange={e => setInstantCallName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInstantCallOpen(false)} disabled={isCalling}>Cancel</Button>
            <Button onClick={handleInstantCall} disabled={isCalling} style={{ backgroundColor: primaryColor, color: "white" }}>
              {isCalling ? "Calling..." : "Call Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto w-11/12 rounded-lg">
          <DialogHeader>
            <DialogTitle>Details</DialogTitle>
          </DialogHeader>
          {selectedCallData && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-semibold text-muted-foreground block mb-1">Contact Name</span>
                  <span>{selectedCallData.name || "—"}</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground block mb-1">Phone Number</span>
                  <span className="font-mono">{selectedCallData.phone || "—"}</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground block mb-1">Status</span>
                  <span className="capitalize">{selectedCallData.status || "—"}</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground block mb-1">Time</span>
                  <span>{selectedCallData.time ? formatDistanceToNow(new Date(selectedCallData.time), { addSuffix: true }) : "—"}</span>
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <span className="font-semibold text-muted-foreground block mb-2">Transcript / AI Summary</span>
                <div className="bg-muted p-4 rounded-md text-sm whitespace-pre-wrap">
                  {selectedCallData.transcript || "No transcript or summary available."}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setDetailsModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Sub Components ─── */

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

function CampaignCard({
  campaign, primaryColor, navigate,
}: {
  campaign: Campaign;
  primaryColor: string;
  navigate: (path: string) => void;
}) {
  const [isUpdating, setIsUpdating] = useState(false);

  async function updateStatus(newStatus: string) {
    toast.info("Status updates are not supported for this campaign type.");
  }

  async function deleteCampaign() {
    if (!confirm("Are you sure you want to delete this campaign? this will wipe all calls queues.")) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase.from("outbound_contact_lists").delete().eq("id", campaign.id);
      if (error) throw error;
      toast.success("Campaign deleted successfully");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <Card className={isUpdating ? "opacity-50" : ""}>
      <CardContent className="pt-5 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{campaign.campaign_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  Scheduled for {campaign.scheduled_at ? formatDistanceToNow(new Date(campaign.scheduled_at), { addSuffix: true }) : 'Now'}
                </p>
              </div>
              <CampaignStatusBadge status={campaign.status} />
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" disabled={isUpdating}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/client/voice-telecaller/campaigns/${campaign.id}`)}>
                <Eye className="h-3 w-3 mr-2" /> View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/client/voice-telecaller/calls?campaign=${campaign.id}`)}>
                <Phone className="h-3 w-3 mr-2" /> View Calls
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/client/leads")}>
                <Users className="h-3 w-3 mr-2" /> View Leads
              </DropdownMenuItem>
              <DropdownMenuItem onClick={deleteCampaign} className="text-destructive focus:text-destructive">
                <Trash2 className="h-3 w-3 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

function CampaignStatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; className?: string }> = {
    draft: { variant: "outline", label: "Draft" },
    scheduled: { variant: "secondary", label: "Scheduled" },
    pending: { variant: "secondary", label: "Pending" },
    running: { variant: "default", label: "Running", className: "animate-pulse" },
    paused: { variant: "outline", label: "Paused", className: "border-yellow-500 text-yellow-600" },
    completed: { variant: "default", label: "Completed" },
    cancelled: { variant: "destructive", label: "Cancelled" },
  };
  const c = config[status] || { variant: "outline" as const, label: status };
  return <Badge variant={c.variant} className={`text-[10px] ${c.className || ""}`}>{c.label}</Badge>;
}

function CallStatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    completed: { variant: "default", label: "Completed" },
    answered: { variant: "default", label: "Answered" },
    busy: { variant: "outline", label: "Busy" },
    no_answer: { variant: "secondary", label: "No Answer" },
    failed: { variant: "destructive", label: "Failed" },
    initiated: { variant: "outline", label: "Initiated" },
    ringing: { variant: "secondary", label: "Ringing" },
  };
  const c = config[status] || { variant: "outline" as const, label: status };
  return <Badge variant={c.variant} className="text-[10px]">{c.label}</Badge>;
}

function formatDuration(seconds: any): string {
  const totalSeconds = Number(seconds);
  if (!totalSeconds || isNaN(totalSeconds)) return "0s";

  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}
      </div>
      <Skeleton className="h-64" />
      <Skeleton className="h-48" />
    </div>
  );
}

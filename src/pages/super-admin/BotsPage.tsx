import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Bot, Search, MoreHorizontal, UserPlus, Eye, Pencil, Trash2, CheckCircle2, XCircle, Plus, Loader2, Zap, RefreshCw, Power, PowerOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface BotRecord {
  id: string;
  owner_user_id: string;
  name: string;
  company_name: string | null;
  created_at: string;
  updated_at: string;
  account_in_use: boolean | null;
  status: string | null;
  owner_email?: string;
  owner_name?: string;
  provider_agent_id?: string | null;
  provider_from_number_id?: string | null;
}

interface UserOption {
  id: string;
  email: string;
  full_name: string | null;
}

const PAGE_SIZE = 20;

export default function BotsPage() {
  const { toast } = useToast();
  const [bots, setBots] = useState<BotRecord[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);

  // Assign modal state
  const [assignTarget, setAssignTarget] = useState<BotRecord | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

  // View modal state
  const [viewTarget, setViewTarget] = useState<BotRecord | null>(null);

  // Create Bot modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<UserOption[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  const [formData, setFormData] = useState({
    owner_user_id: "",
    name: "",
    company_name: "",
    provider_agent_id: "",
    provider_from_number_id: ""
  });

  // Debounce main search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Debounced User Search for Create Bot
  useEffect(() => {
    if (userSearchTerm.length < 2) {
      setUserSearchResults([]);
      return;
    }

    setSearchingUsers(true);
    const handler = setTimeout(async () => {
      // 1. Search profiles by email
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .ilike("email", `%${userSearchTerm}%`)
        .limit(20);

      if (profileError || !profileData || profileData.length === 0) {
        setUserSearchResults([]);
        setSearchingUsers(false);
        return;
      }

      // 2. Filter those profiles to only include those in the clients table
      const userIds = profileData.map(p => p.user_id);
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("user_id")
        .in("user_id", userIds);

      if (clientError || !clientData) {
        setUserSearchResults([]);
      } else {
        const clientUserIds = new Set(clientData.map(c => c.user_id));
        const filtered = profileData
          .filter(p => clientUserIds.has(p.user_id))
          .map(p => ({
            id: p.user_id,
            email: p.email,
            full_name: p.full_name
          }));
        setUserSearchResults(filtered);
      }
      setSearchingUsers(false);
    }, 700);

    return () => clearTimeout(handler);
  }, [userSearchTerm]);

  const fetchUsers = useCallback(async () => {
    // For the initial list, we fetch clients and then their profiles
    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("user_id")
      .limit(50);

    if (clientError || !clientData || clientData.length === 0) return;

    const userIds = clientData.map(c => c.user_id);
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, email, full_name")
      .in("user_id", userIds);

    if (!profileError && profileData) {
      setUsers(profileData.map(p => ({
        id: p.user_id,
        email: p.email,
        full_name: p.full_name
      })));
    }
  }, []);

  const fetchBots = useCallback(async () => {
    setLoading(true);
    const { data: botsData, error } = await supabase
      .from("outboundagents" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error fetching bots",
        description: "Make sure the 'outboundagents' table exists in your database.",
        variant: "destructive"
      });
      setLoading(false);
      return;
    }

    const enriched: BotRecord[] = await Promise.all(
      (botsData ?? []).map(async (b: any) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("user_id", b.owner_user_id)
          .single();

        return {
          ...b,
          owner_email: profile?.email ?? "Unknown",
          owner_name: profile?.full_name ?? "Unknown",
        };
      })
    );

    setBots(enriched);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchUsers();
    fetchBots();
  }, [fetchUsers, fetchBots]);

  const filtered = useMemo(() => {
    let list = bots;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          (b.company_name || "").toLowerCase().includes(q) ||
          (b.owner_email ?? "").toLowerCase().includes(q) ||
          (b.provider_agent_id ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [bots, debouncedSearch]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => { setPage(0); }, [debouncedSearch]);

  const ensureVoiceTelecallerService = async (ownerUserId: string) => {
    try {
      const { data: clientData } = await supabase
        .from("clients")
        .select("id, admin_id")
        .eq("user_id", ownerUserId)
        .single();

      if (!clientData) return;

      const { data: serviceData } = await supabase
        .from("services")
        .select("id")
        .eq("slug", "voice-telecaller")
        .single();

      if (!serviceData) return;

      const { data: existing } = await supabase
        .from("client_services")
        .select("id, is_active")
        .eq("client_id", clientData.id)
        .eq("service_id", serviceData.id)
        .maybeSingle();

      if (!existing) {
        await supabase.from("client_services").insert({
          client_id: clientData.id,
          service_id: serviceData.id,
          is_active: true,
          usage_limit: 1000,
          reset_period: 'monthly',
          usage_consumed: 0,
          assigned_by: clientData.admin_id,
          last_reset_at: new Date().toISOString(),
          assigned_at: new Date().toISOString()
        } as any);
      } else if (!existing.is_active) {
        await supabase.from("client_services").update({
          is_active: true
        }).eq("id", existing.id);
      }
    } catch (e) {
      console.error("Error auto-assigning service:", e);
    }
  };

  const handleAssign = async () => {
    if (!assignTarget || !selectedUserId) return;
    setAssigning(true);

    // Check if user already has a bot
    const { data: existingBots } = await supabase
      .from("outboundagents" as any)
      .select("id")
      .eq("owner_user_id", selectedUserId);

    if (existingBots && existingBots.length > 0) {
      toast({
        title: "Assignment failed",
        description: "This user already has an assigned bot.",
        variant: "destructive"
      });
      setAssigning(false);
      return;
    }

    const { error } = await supabase
      .from("outboundagents" as any)
      .update({ owner_user_id: selectedUserId })
      .eq("id", assignTarget.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      await ensureVoiceTelecallerService(selectedUserId);
      toast({ title: "Bot reassigned successfully" });
      fetchBots();
      setAssignTarget(null);
    }
    setAssigning(false);
  };

  const handleCreateBot = async () => {
    if (!formData.owner_user_id || !formData.name || !formData.provider_agent_id || !formData.provider_from_number_id) {
      toast({
        title: "Missing fields",
        description: "Bot Name, Assigned User, Provider Agent ID and From Number ID are required.",
        variant: "destructive"
      });
      return;
    }

    setCreating(true);

    // Check if the user already has a bot
    const { data: existingBots } = await supabase
      .from("outboundagents" as any)
      .select("id")
      .eq("owner_user_id", formData.owner_user_id);

    if (existingBots && existingBots.length > 0) {
      toast({
        title: "Creation failed",
        description: "This user already has a bot assigned to them.",
        variant: "destructive"
      });
      setCreating(false);
      return;
    }

    // If company_name is required in DB but not in form, use bot name as fallback
    const payload = {
      ...formData,
      company_name: formData.company_name || formData.name
    };

    const { error } = await supabase
      .from("outboundagents" as any)
      .insert([payload]);

    if (error) {
      toast({ title: "Error creating bot", description: error.message, variant: "destructive" });
    } else {
      await ensureVoiceTelecallerService(formData.owner_user_id);
      toast({ title: "Bot created successfully" });
      fetchBots();
      setCreateOpen(false);
      setFormData({
        owner_user_id: "",
        name: "",
        company_name: "",
        provider_agent_id: "",
        provider_from_number_id: ""
      });
      setUserSearchTerm("");
    }
    setCreating(false);
  };

  const handleAutoFill = () => {
    setFormData(prev => ({
      ...prev,
      name: "Smart Support AI",
      provider_agent_id: "agent_12345",
      provider_from_number_id: "num_12345"
    }));
    toast({ title: "Form Auto-filled", description: "Default values have been applied." });
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from("outboundagents" as any)
      .update({ status: newStatus })
      .eq("id", id);
    
    if (error) {
      toast({ title: "Error updating status", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Bot ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully` });
      fetchBots();
    }
  };

  const handleDeleteBot = async (id: string) => {
    if (!confirm("Are you sure you want to delete this bot?")) return;
    
    const { error } = await supabase
      .from("outboundagents" as any)
      .delete()
      .eq("id", id);
      
    if (error) {
      toast({ title: "Error deleting bot", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Bot deleted successfully" });
      fetchBots();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bots Management</h1>
          <p className="text-muted-foreground">Monitor and assign agents across users</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchBots} disabled={loading} title="Refresh">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Bot
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search bots..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Bot className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">No bots found</h3>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bot Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((bot) => (
                  <TableRow key={bot.id}>
                    <TableCell className="font-medium">{bot.name}</TableCell>
                    <TableCell>{bot.company_name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{bot.owner_name}</span>
                        <span className="text-xs text-muted-foreground">{bot.owner_email}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {bot.status?.toLowerCase() === 'active' ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>
                      ) : (
                        <Badge variant="secondary">
                          {bot.status ? bot.status.charAt(0).toUpperCase() + bot.status.slice(1).toLowerCase() : 'Inactive'}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {format(new Date(bot.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewTarget(bot)}>
                            <Eye className="mr-2 h-4 w-4" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setAssignTarget(bot);
                            setSelectedUserId(bot.owner_user_id);
                            setUserSearchTerm(bot.owner_email || "");
                          }}>
                            <UserPlus className="mr-2 h-4 w-4" /> Reassign
                          </DropdownMenuItem>
                          {bot.status?.toLowerCase() === 'active' ? (
                            <DropdownMenuItem onClick={() => handleUpdateStatus(bot.id, 'inactive')}>
                              <PowerOff className="mr-2 h-4 w-4" /> Deactivate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleUpdateStatus(bot.id, 'active')}>
                              <Power className="mr-2 h-4 w-4" /> Activate
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleDeleteBot(bot.id)} className="text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Total {filtered.length} bots
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

      {/* Add Bot Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => {
        setCreateOpen(open);
        if (!open) {
          setUserSearchTerm("");
          setUserSearchResults([]);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <DialogTitle>Add New Bot</DialogTitle>
              <DialogDescription>Create a new agent for a specific user.</DialogDescription>
            </div>
            <Button variant="secondary" size="sm" onClick={handleAutoFill} className="mr-6">
              <Zap className="mr-2 h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
              Auto-fill Defaults
            </Button>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Assigned User (Search Email)</Label>
                <div className="relative">
                  <Input
                    placeholder="Search user by email (min 2 chars)..."
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                  />
                  {searchingUsers && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
                {userSearchResults.length > 0 && (
                  <div className="absolute z-50 border rounded-md mt-1 max-h-40 overflow-y-auto bg-card shadow-lg w-[320px]">
                    {userSearchResults.map(u => (
                      <div
                        key={u.id}
                        className={`p-2 hover:bg-muted cursor-pointer text-sm ${formData.owner_user_id === u.id ? 'bg-primary/10 border-l-2 border-primary' : ''}`}
                        onClick={() => {
                          setFormData(prev => ({ ...prev, owner_user_id: u.id }));
                          setUserSearchTerm(u.email);
                          setUserSearchResults([]);
                        }}
                      >
                        <p className="font-medium">{u.email}</p>
                        <p className="text-xs text-muted-foreground">{u.full_name || "No name"}</p>
                      </div>
                    ))}
                  </div>
                )}
                {formData.owner_user_id && (
                  <p className="text-xs text-green-600 font-medium">Selected User ID: {formData.owner_user_id}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Bot Name</Label>
                <Input value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} placeholder="My Bot" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Provider Agent ID</Label>
                <Input value={formData.provider_agent_id} onChange={e => setFormData(f => ({ ...f, provider_agent_id: e.target.value }))} placeholder="agent_xyz" />
              </div>

              <div className="space-y-2">
                <Label>Provider From Number ID</Label>
                <Input value={formData.provider_from_number_id} onChange={e => setFormData(f => ({ ...f, provider_from_number_id: e.target.value }))} placeholder="num_xyz" />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateBot} disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Bot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={!!viewTarget} onOpenChange={(open) => { if (!open) setViewTarget(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bot Details: {viewTarget?.name}</DialogTitle>
          </DialogHeader>
          {viewTarget && (
            <div className="py-4">
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Provider Info</Label>
                  <p className="text-sm break-all"><strong>Agent ID:</strong> {viewTarget.provider_agent_id || "—"}</p>
                  <p className="text-sm break-all"><strong>From Number ID:</strong> {viewTarget.provider_from_number_id || "—"}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewTarget(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={!!assignTarget} onOpenChange={(open) => {
        if (!open) {
          setAssignTarget(null);
          setUserSearchTerm("");
          setUserSearchResults([]);
        }
      }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Bot</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4 min-h-[140px]">
            <div className="space-y-2 relative">
              <Label>Search Client Email (min 2 chars)</Label>
              <div className="relative">
                <Input
                  placeholder="Search user by email..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                />
                {searchingUsers && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              {userSearchResults.length > 0 && (
                <div className="absolute z-50 border rounded-md mt-1 max-h-40 overflow-y-auto bg-card shadow-lg w-full">
                  {userSearchResults.map(u => (
                    <div
                      key={u.id}
                      className={`p-2 hover:bg-muted cursor-pointer text-sm ${selectedUserId === u.id ? 'bg-primary/10' : ''}`}
                      onClick={() => {
                        setSelectedUserId(u.id);
                        setUserSearchTerm(u.email);
                        setUserSearchResults([]);
                      }}
                    >
                      <p className="font-medium text-xs">{u.email}</p>
                      <p className="text-[10px] text-muted-foreground">{u.full_name || "No name"}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedUserId && (
              <p className="text-xs text-green-600 font-medium font-mono">
                Selected: {selectedUserId}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignTarget(null)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={assigning || !selectedUserId}>
              {assigning ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

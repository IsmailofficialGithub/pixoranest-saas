import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Bot, Search, MoreHorizontal, UserPlus, Eye, Pencil, Trash2, CheckCircle2, XCircle, Plus, Loader2, Zap, RefreshCw
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
  company_name: string;
  website_url: string | null;
  goal: string | null;
  background: string | null;
  welcome_message: string | null;
  instruction_voice: string | null;
  script: string | null;
  voice: string;
  language: string | null;
  agent_type: string | null;
  tone: string | null;
  model: string;
  background_noise: string | null;
  max_timeout: string | null;
  created_at: string;
  updated_at: string;
  vapi_id: string | null;
  account_in_use: boolean | null;
  owner_email?: string;
  owner_name?: string;
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
    website_url: "",
    goal: "",
    background: "",
    welcome_message: "",
    instruction_voice: "",
    script: "",
    voice: "alloy",
    language: "en",
    agent_type: "outbound",
    tone: "professional",
    model: "gpt-4o",
    background_noise: "office",
    max_timeout: "30",
    vapi_id: "",
    account_in_use: false
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
          b.company_name.toLowerCase().includes(q) ||
          (b.owner_email ?? "").toLowerCase().includes(q) ||
          (b.vapi_id ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [bots, debouncedSearch]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => { setPage(0); }, [debouncedSearch]);

  const handleAssign = async () => {
    if (!assignTarget || !selectedUserId) return;
    setAssigning(true);

    const { error } = await supabase
      .from("outboundagents" as any)
      .update({ owner_user_id: selectedUserId })
      .eq("id", assignTarget.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Bot reassigned successfully" });
      fetchBots();
      setAssignTarget(null);
    }
    setAssigning(false);
  };

  const handleCreateBot = async () => {
    if (!formData.owner_user_id || !formData.name || !formData.company_name) {
      toast({ title: "Missing fields", description: "Name, Company, and Owner are required.", variant: "destructive" });
      return;
    }

    setCreating(true);
    const { error } = await supabase
      .from("outboundagents" as any)
      .insert([formData]);

    if (error) {
      toast({ title: "Error creating bot", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Bot created successfully" });
      fetchBots();
      setCreateOpen(false);
      setFormData({
        owner_user_id: "",
        name: "",
        company_name: "",
        website_url: "",
        goal: "",
        background: "",
        welcome_message: "",
        instruction_voice: "",
        script: "",
        voice: "alloy",
        language: "en",
        agent_type: "outbound",
        tone: "professional",
        model: "gpt-4o",
        background_noise: "office",
        max_timeout: "30",
        vapi_id: "",
        account_in_use: false
      });
      setUserSearchTerm("");
    }
    setCreating(false);
  };

  const handleAutoFill = () => {
    setFormData(prev => ({
      ...prev,
      name: "Smart Support AI",
      company_name: "TechSolutions Inc",
      website_url: "https://techsolutions.example.com",
      goal: "Assist customers with technical troubleshooting and plan upgrades.",
      background: "A professional and friendly assistant for a software hosting company.",
      welcome_message: "Hello! This is Sam from TechSolutions. How can I help you today?",
      instruction_voice: "Speak slowly and clearly. Always confirm technical details before proceeding.",
      script: "You are a senior support agent. Your primary task is to identify if the user is calling about a technical issue or a billing inquiry. If technical, ask for the error code. If billing, offer a 10% discount on annual plans.",
      voice: "shimmer",
      language: "en-US",
      tone: "helpful",
      model: "gpt-4o",
      max_timeout: "60"
    }));
    toast({ title: "Form Auto-filled", description: "Default values have been applied." });
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
                  <TableHead>Specs</TableHead>
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
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-[10px] py-0">{bot.model}</Badge>
                        <Badge variant="outline" className="text-[10px] py-0">{bot.voice}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {bot.account_in_use ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
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
                <Label>Owner (Search Email)</Label>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Bot Name</Label>
                  <Input value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} placeholder="My Bot" />
                </div>
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input value={formData.company_name} onChange={e => setFormData(f => ({ ...f, company_name: e.target.value }))} placeholder="Bot Corp" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Website URL</Label>
                <Input value={formData.website_url} onChange={e => setFormData(f => ({ ...f, website_url: e.target.value }))} placeholder="https://..." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select value={formData.model} onValueChange={v => setFormData(f => ({ ...f, model: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                      <SelectItem value="gpt-4">GPT-4</SelectItem>
                      <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Voice</Label>
                  <Select value={formData.voice} onValueChange={v => setFormData(f => ({ ...f, voice: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alloy">Alloy</SelectItem>
                      <SelectItem value="echo">Echo</SelectItem>
                      <SelectItem value="fable">Fable</SelectItem>
                      <SelectItem value="onyx">Onyx</SelectItem>
                      <SelectItem value="nova">Nova</SelectItem>
                      <SelectItem value="shimmer">Shimmer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Input value={formData.language} onChange={e => setFormData(f => ({ ...f, language: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Agent Type</Label>
                  <Input value={formData.agent_type} onChange={e => setFormData(f => ({ ...f, agent_type: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Goal</Label>
                <Textarea value={formData.goal} onChange={e => setFormData(f => ({ ...f, goal: e.target.value }))} placeholder="What should the bot achieve?" />
              </div>
              <div className="space-y-2">
                <Label>Background</Label>
                <Textarea value={formData.background} onChange={e => setFormData(f => ({ ...f, background: e.target.value }))} placeholder="Context for the bot..." />
              </div>
              <div className="space-y-2">
                <Label>Welcome Message</Label>
                <Input value={formData.welcome_message} onChange={e => setFormData(f => ({ ...f, welcome_message: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Vapi ID (Optional)</Label>
                <Input value={formData.vapi_id} onChange={e => setFormData(f => ({ ...f, vapi_id: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <Label>Tone</Label>
                   <Input value={formData.tone} onChange={e => setFormData(f => ({ ...f, tone: e.target.value }))} />
                 </div>
                 <div className="space-y-2">
                   <Label>Max Timeout (s)</Label>
                   <Input value={formData.max_timeout} onChange={e => setFormData(f => ({ ...f, max_timeout: e.target.value }))} />
                 </div>
              </div>
            </div>

            <div className="md:col-span-2 space-y-4">
              <div className="space-y-2">
                <Label>Instructions</Label>
                <Textarea value={formData.instruction_voice} onChange={e => setFormData(f => ({ ...f, instruction_voice: e.target.value }))} className="h-24" />
              </div>
              <div className="space-y-2">
                <Label>Script / Core Prompt</Label>
                <Textarea value={formData.script} onChange={e => setFormData(f => ({ ...f, script: e.target.value }))} className="h-32 font-mono text-xs" />
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">General</Label>
                  <p className="text-sm"><strong>Company:</strong> {viewTarget.company_name}</p>
                  <p className="text-sm"><strong>Website:</strong> {viewTarget.website_url || "—"}</p>
                  <p className="text-sm"><strong>Type:</strong> {viewTarget.agent_type}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Specs</Label>
                  <p className="text-sm"><strong>Model:</strong> {viewTarget.model}</p>
                  <p className="text-sm"><strong>Voice:</strong> {viewTarget.voice}</p>
                  <p className="text-sm"><strong>Language:</strong> {viewTarget.language}</p>
                </div>
                <div>
                   <Label className="text-xs text-muted-foreground">Vapi</Label>
                   <p className="text-xs font-mono">{viewTarget.vapi_id || "None"}</p>
                </div>
              </div>
              <div className="space-y-4">
                 <div><Label className="text-xs text-muted-foreground">Goal</Label><p className="text-sm">{viewTarget.goal}</p></div>
                 <div><Label className="text-xs text-muted-foreground">Welcome</Label><p className="text-sm">{viewTarget.welcome_message}</p></div>
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

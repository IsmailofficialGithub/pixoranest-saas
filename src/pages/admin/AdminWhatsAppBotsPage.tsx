import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Plus, Search, Bot, UserPlus, Trash2, Globe, Phone, 
  Settings2, Shield, ExternalLink, QrCode, SendHorizonal
} from "lucide-react";
import { sendWhatsAppMessage } from "@/utils/whatsapp";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";

interface WhatsAppApplication {
  id: string;
  name: string;
  phone: string | null;
  status: string;
  provider_type: 'baileys' | 'api';
  api_config: any;
  created_at: string;
}

interface UserAccess {
  id: string;
  user_id: string;
  application_id: string;
  profile?: {
    email: string;
    full_name: string | null;
  };
}

export default function AdminWhatsAppBotsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isAddBotOpen, setIsAddBotOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isTestOpen, setIsTestOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState({ to: "", text: "Test from Pixora!" });
  const [isSendingTest, setIsSendingTest] = useState(false);
  
  // Form States
  const [newBot, setNewBot] = useState({
    name: "",
    provider_type: "api" as "baileys" | "api",
    panel_url: "",
    api_key: "",
    phone_id: "",
  });

  const [editBot, setEditBot] = useState<{
    id: string;
    name: string;
    provider_type: "baileys" | "api";
    panel_url: string;
    api_key: string;
    phone_id: string;
    status: string;
  } | null>(null);
  
  const [assignUserId, setAssignUserId] = useState("");

  // Queries
  const { data: bots = [], isLoading: isBotsLoading } = useQuery({
    queryKey: ["admin-wa-bots"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("whatsapp_applications" as any) as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as WhatsAppApplication[];
    }
  });

  const { data: users = [] } = useQuery({
    queryKey: ["whatsapp-eligible-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          user_id, email, full_name,
          clients!inner(
            id,
            client_services!inner(
              is_active,
              services!inner(slug)
            )
          )
        `)
        .eq("clients.client_services.is_active", true)
        .eq("clients.client_services.services.slug", "whatsapp");
      
      if (error) {
        console.error("Error fetching eligible users:", error);
        const { data: allProfiles } = await supabase.from("profiles").select("user_id, email, full_name").limit(100);
        return allProfiles || [];
      }
      return data;
    }
  });

  const { data: accessList = [] } = useQuery({
    queryKey: ["admin-wa-access"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("whatsapp_user_access" as any) as any)
        .select(`
          id, user_id, application_id,
          profile:profiles(email, full_name)
        `);
      if (error) throw error;
      return data as any[] as UserAccess[];
    }
  });

  // Mutations
  const createBotMutation = useMutation({
    mutationFn: async (botData: typeof newBot) => {
      const { data, error } = await (supabase.from("whatsapp_applications" as any) as any)
        .insert([{
          name: botData.name,
          provider_type: botData.provider_type,
          api_config: botData.provider_type === "api" ? {
            panel_url: botData.panel_url,
            api_key: botData.api_key,
            phone_id: botData.phone_id
          } : {},
          status: "pending"
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-wa-bots"] });
      toast.success("WhatsApp Bot created successfully");
      setIsAddBotOpen(false);
      setNewBot({ name: "", provider_type: "api", panel_url: "", api_key: "", phone_id: "" });
    }
  });

  const assignUserMutation = useMutation({
    mutationFn: async ({ botId, userId }: { botId: string, userId: string }) => {
      const { error } = await (supabase.from("whatsapp_user_access" as any) as any)
        .upsert([{ 
          application_id: botId, 
          user_id: userId,
          granted_by: (await supabase.auth.getUser()).data.user?.id
        }], { onConflict: 'user_id,application_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-wa-access"] });
      toast.success("User access managed successfully");
      setIsAssignOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to assign user");
    }
  });

  const updateBotMutation = useMutation({
    mutationFn: async (botData: any) => {
      const { data, error } = await (supabase.from("whatsapp_applications" as any) as any)
        .update({
          name: botData.name,
          provider_type: botData.provider_type,
          api_config: botData.provider_type === "api" ? {
            panel_url: botData.panel_url,
            api_key: botData.api_key,
            phone_id: botData.phone_id
          } : {},
          status: botData.status
        })
        .eq("id", botData.id);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-wa-bots"] });
      toast.success("WhatsApp Bot updated successfully");
      setIsEditOpen(false);
    }
  });

  const deleteBotMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("whatsapp_applications" as any) as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-wa-bots"] });
      toast.success("Bot deleted");
    }
  });

  const removeAccessMutation = useMutation({
    mutationFn: async (accessId: string) => {
      const { error } = await (supabase.from("whatsapp_user_access" as any) as any)
        .delete()
        .eq("id", accessId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-wa-access"] });
      toast.success("Access revoked");
    }
  });

  const handleSendTestMessage = async () => {
    if (!selectedBotId || !testMessage.to || !testMessage.text) return;
    const bot = bots.find(b => b.id === selectedBotId);
    if (!bot) return;

    if (bot.provider_type !== 'api') {
      toast.error("Test message only supported for API bots currently.");
      return;
    }

    setIsSendingTest(true);
    try {
      await sendWhatsAppMessage({
        to: testMessage.to,
        body: testMessage.text,
        application_id: bot.id,
        phoneNoId: bot.api_config?.phone_id,
        baseUrl: bot.api_config?.panel_url
      }, bot.api_config?.api_key);
      
      toast.success("Test message sent!");
      setIsTestOpen(false);
      setTestMessage({ to: "", text: "Test from Pixora!" });
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    } finally {
      setIsSendingTest(false);
    }
  };

  const filteredBots = bots.filter(b => 
    b.name.toLowerCase().includes(search.toLowerCase()) || 
    b.phone?.includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
            <Bot className="h-7 w-7 text-primary" />
            WhatsApp Bot Management
          </h1>
          <p className="text-muted-foreground text-sm">Create and assign WhatsApp bots to users.</p>
        </div>
        <Button onClick={() => setIsAddBotOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create New Bot
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search bots..." 
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isBotsLoading ? (
          <div>Loading...</div>
        ) : filteredBots.map(bot => (
          <Card key={bot.id} className="relative overflow-hidden border-white/10 bg-card/50 backdrop-blur-md">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${bot.provider_type === 'api' ? 'bg-blue-500/10 text-blue-500' : 'bg-green-500/10 text-green-500'}`}>
                    {bot.provider_type === 'api' ? <Globe className="h-5 w-5" /> : <QrCode className="h-5 w-5" />}
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold">{bot.name}</CardTitle>
                    <CardDescription>{bot.provider_type === 'api' ? 'Panel API' : 'Baileys'}</CardDescription>
                  </div>
                </div>
                <Badge variant={bot.status === 'active' ? 'default' : 'secondary'}>{bot.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <div className="flex items-center gap-2 pt-1"><Phone className="h-3 w-3" /> {bot.phone || 'Not connected'}</div>
                {bot.provider_type === 'api' && (
                  <div className="flex items-center gap-2 pt-1 truncate"><ExternalLink className="h-3 w-3" /> {bot.api_config?.panel_url}</div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button size="sm" variant="secondary" onClick={() => {
                  setSelectedBotId(bot.id);
                  setIsAssignOpen(true);
                }}>
                  <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Assign User
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  setSelectedBotId(bot.id);
                  setIsTestOpen(true);
                }}>
                  <SendHorizonal className="mr-1.5 h-3.5 w-3.5" /> Test
                </Button>
                <Button size="sm" variant="ghost" onClick={() => {
                  setEditBot({
                    id: bot.id,
                    name: bot.name,
                    provider_type: bot.provider_type,
                    panel_url: bot.api_config?.panel_url || "",
                    api_key: bot.api_config?.api_key || "",
                    phone_id: bot.api_config?.phone_id || "",
                    status: bot.status
                  });
                  setIsEditOpen(true);
                }}>
                  <Settings2 className="mr-1.5 h-3.5 w-3.5" /> Config
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto" onClick={() => {
                   if (confirm("Delete this bot? All user access will be revoked.")) {
                     deleteBotMutation.mutate(bot.id);
                   }
                }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-white/10 bg-card/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Access Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Bot</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accessList.map(acc => (
                <TableRow key={acc.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold">{acc.profile?.full_name || 'N/A'}</span>
                      <span className="text-xs text-muted-foreground">{acc.profile?.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>{bots.find(b => b.id === acc.application_id)?.name || 'Unknown'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => removeAccessMutation.mutate(acc.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isAddBotOpen} onOpenChange={setIsAddBotOpen}>
        <DialogContent className="max-w-md bg-card border-white/10">
          <DialogHeader><DialogTitle>Create WhatsApp Bot</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Bot Name</Label>
              <Input value={newBot.name} onChange={e => setNewBot({...newBot, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={newBot.provider_type} onValueChange={(v: any) => setNewBot({...newBot, provider_type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="api">External API</SelectItem>
                  <SelectItem value="baileys">Baileys Session</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newBot.provider_type === "api" && (
              <div className="space-y-3 pt-2 border-t border-white/5">
                <Input placeholder="Panel URL" value={newBot.panel_url} onChange={e => setNewBot({...newBot, panel_url: e.target.value})} />
                <Input placeholder="API Key" type="password" value={newBot.api_key} onChange={e => setNewBot({...newBot, api_key: e.target.value})} />
                <Input placeholder="Phone ID" value={newBot.phone_id} onChange={e => setNewBot({...newBot, phone_id: e.target.value})} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => createBotMutation.mutate(newBot)} disabled={!newBot.name}>Save Bot</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
        <DialogContent className="max-w-md bg-card border-white/10">
          <DialogHeader><DialogTitle>Assign Bot</DialogTitle></DialogHeader>
          <div className="py-4 space-y-2">
            <Label>Select User</Label>
            <Select value={assignUserId} onValueChange={setAssignUserId}>
              <SelectTrigger><SelectValue placeholder="User" /></SelectTrigger>
              <SelectContent>
                {users.map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button onClick={() => assignUserId && selectedBotId && assignUserMutation.mutate({ botId: selectedBotId, userId: assignUserId })}>Grant Access</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTestOpen} onOpenChange={setIsTestOpen}>
        <DialogContent className="max-w-md bg-card border-white/10">
          <DialogHeader>
            <DialogTitle>Send Test WhatsApp</DialogTitle>
            <DialogDescription>Test your bot connection by sending a real message.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Recipient Phone (with country code)</Label>
              <Input placeholder="919988XXXXXX" value={testMessage.to} onChange={e => setTestMessage({...testMessage, to: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Message Text</Label>
              <textarea 
                className="flex min-h-[80px] w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={testMessage.text} 
                onChange={e => setTestMessage({...testMessage, text: e.target.value})} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSendTestMessage} disabled={isSendingTest || !testMessage.to}>
              {isSendingTest ? "Sending..." : "Send Message"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit/Config Bot Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md bg-card border-white/10">
          <DialogHeader><DialogTitle>Configure Bot: {editBot?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Bot Name</Label>
              <Input value={editBot?.name} onChange={e => editBot && setEditBot({...editBot, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editBot?.status} onValueChange={(v: any) => editBot && setEditBot({...editBot, status: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Provider Type</Label>
              <Select value={editBot?.provider_type} onValueChange={(v: any) => editBot && setEditBot({...editBot, provider_type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="api">External API</SelectItem>
                  <SelectItem value="baileys">Baileys Session</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editBot?.provider_type === "api" && (
              <div className="space-y-3 pt-2 border-t border-white/5">
                <div className="space-y-2">
                  <Label className="text-xs">Panel URL</Label>
                  <Input placeholder="https://api.provider.com" value={editBot.panel_url} onChange={e => setEditBot({...editBot, panel_url: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">API Key</Label>
                  <Input type="password" value={editBot.api_key} onChange={e => setEditBot({...editBot, api_key: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Phone ID</Label>
                  <Input value={editBot.phone_id} onChange={e => setEditBot({...editBot, phone_id: e.target.value})} />
                </div>
              </div>
            )}
            {editBot?.provider_type === "baileys" && (
              <div className="p-3 bg-secondary/50 rounded-lg text-sm text-muted-foreground border border-white/5">
                Baileys sessions are managed via the local server scan. Switching to this mode will disable the External API settings for this bot.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => editBot && updateBotMutation.mutate(editBot)}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

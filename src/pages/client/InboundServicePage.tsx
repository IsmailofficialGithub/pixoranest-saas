import { useEffect, useState, useCallback, useMemo } from "react";
import {
  PhoneIncoming, Settings, PhoneCall, History, Play, Pause, Trash2, RefreshCw, Bot, User, Smartphone, Info, Save, MessageSquare, Volume2, Mic, CheckCircle, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface InboundNumber {
  id: string;
  phone_number: string;
  label: string | null;
  status: string;
}

interface InboundAgent {
  id: string;
  number_id: string;
  name: string;
  greeting_message: string;
  system_prompt: string;
  voice_id: string;
  model: string;
  tone: string;
}

interface CallLog {
  id: string;
  caller_number: string;
  call_status: string;
  duration: number;
  transcript: string | null;
  recording_url: string | null;
  created_at: string;
  is_lead?: boolean;
}

export default function InboundServicePage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [assignedNumbers, setAssignedNumbers] = useState<InboundNumber[]>([]);
  const [selectedNumId, setSelectedNumId] = useState<string | null>(null);
  const [agent, setAgent] = useState<Partial<InboundAgent>>({
    name: "AI Receptionist",
    greeting_message: "Hello, thank you for calling. How can I assist you today?",
    system_prompt: "You are a helpful office assistant. Be professional and concise.",
    voice_id: "aura-helena-en",
    model: "gpt-4o",
    tone: "professional"
  });
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [saving, setSaving] = useState(false);

  const leads = useMemo(() => logs.filter(l => l.is_lead), [logs]);

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch assigned numbers
      const { data: rawNums, error: numError } = await supabase
        .from("inbound_numbers" as any)
        .select("*")
        .eq("assigned_user_id", user.id);
      
      const nums = rawNums as any[] | null;
      
      if (numError) throw numError;
      setAssignedNumbers(nums || []);

      if (nums && nums.length > 0) {
        const firstNum = nums[0];
        setSelectedNumId(firstNum.id);
        
        // 2. Fetch agent config for this number
        const { data: rawAgentData } = await supabase
          .from("inbound_agents" as any)
          .select("*")
          .eq("number_id", firstNum.id)
          .maybeSingle();
        
        const agentData = rawAgentData as any;
        if (agentData) setAgent(agentData as Partial<InboundAgent>);

        // 3. Fetch call logs
        const { data: rawLogData } = await supabase
          .from("inbound_call_logs" as any)
          .select("*")
          .eq("number_id", firstNum.id)
          .order("created_at", { ascending: false });
        
        const logData = rawLogData as any[] | null;
        setLogs(logData || []);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const handleSaveAgent = async () => {
    if (!selectedNumId) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const payload = {
        ...agent,
        number_id: selectedNumId,
        owner_user_id: user.id
      };

      const { error } = await supabase
        .from("inbound_agents" as any)
        .upsert(payload, { onConflict: 'number_id' });

      if (error) throw error;
      toast({ title: "Agent Updated", description: "Your inbound agent configuration has been saved." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSkeleton />;

  if (assignedNumbers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="bg-primary/5 rounded-full p-6 mb-6">
          <Smartphone className="h-16 w-16 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">No Inbound Number Assigned</h2>
        <p className="text-muted-foreground max-w-md mb-8">
          You don't have any inbound phone numbers assigned to your account yet. 
          Please contact support or your administrator to get a number.
        </p>
        <Button variant="outline" onClick={fetchInitialData}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh Status
        </Button>
      </div>
    );
  }

  const activeNum = assignedNumbers.find(n => n.id === selectedNumId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inbound Voice Agent</h1>
          <p className="text-muted-foreground">Configure your AI receptionist and view call history</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedNumId || ""} onValueChange={setSelectedNumId}>
            <SelectTrigger className="w-[200px]">
              <PhoneIncoming className="mr-2 h-4 w-4 text-primary" />
              <SelectValue placeholder="Select Number" />
            </SelectTrigger>
            <SelectContent>
              {assignedNumbers.map(n => (
                <SelectItem key={n.id} value={n.id}>{n.phone_number}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchInitialData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview & Configuration</TabsTrigger>
          <TabsTrigger value="leads">Leads ({leads.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="grid gap-6 md:grid-cols-12">
            {/* Left Column: Configuration */}
        <div className="md:col-span-12 lg:col-span-7 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" /> Agent Configuration
              </CardTitle>
              <CardDescription>Configure how the AI answers your calls on {activeNum?.phone_number}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Agent Name</Label>
                  <Input value={agent.name} onChange={e => setAgent(p => ({...p, name: e.target.value}))} />
                </div>
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select value={agent.model} onValueChange={v => setAgent(p => ({...p, model: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4o">GPT-4o (Smart)</SelectItem>
                      <SelectItem value="gpt-4o-mini">GPT-4o Mini (Fast)</SelectItem>
                      <SelectItem value="claude-3-5">Claude 3.5 Sonnet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" /> Greeting Message
                </Label>
                <Textarea 
                  placeholder="What the AI says when picking up..." 
                  value={agent.greeting_message}
                  onChange={e => setAgent(p => ({...p, greeting_message: e.target.value}))}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Mic className="h-4 w-4 text-muted-foreground" /> System Instructions/Prompt
                </Label>
                <Textarea 
                  placeholder="Define who the AI is and what it should do..." 
                  value={agent.system_prompt}
                  onChange={e => setAgent(p => ({...p, system_prompt: e.target.value}))}
                  rows={6}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Voice</Label>
                  <Select value={agent.voice_id} onValueChange={v => setAgent(p => ({...p, voice_id: v}))}>
                    <SelectTrigger><Volume2 className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aura-helena-en">Helena (Professional)</SelectItem>
                      <SelectItem value="aura-luna-en">Luna (Friendly)</SelectItem>
                      <SelectItem value="aura-stella-en">Stella (Smooth)</SelectItem>
                      <SelectItem value="aura-orion-en">Orion (Male, Authority)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tone</Label>
                  <Select value={agent.tone} onValueChange={v => setAgent(p => ({...p, tone: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="concise">Concise & Direct</SelectItem>
                      <SelectItem value="empathetic">Empathetic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="pt-4">
                <Button className="w-full" onClick={handleSaveAgent} disabled={saving}>
                  {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Configuration
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Mini Logs/Stats */}
        <div className="md:col-span-12 lg:col-span-5 space-y-6">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                Current Status
                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">Online</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Active Number</span>
                <span className="font-mono font-medium">{activeNum?.phone_number}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Provider</span>
                <span className="capitalize">Twilio</span>
              </div>
              <div className="pt-2 border-t flex justify-around text-center">
                <div>
                  <p className="text-2xl font-bold">{logs.length}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Total Calls</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {logs.filter(l => l.call_status === 'answered').length}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase">Answered</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-600">
                    {logs.filter(l => l.call_status === 'missed').length}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase">Missed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <History className="h-4 w-4" /> Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               {logs.length === 0 ? (
                 <div className="p-8 text-center text-sm text-muted-foreground">
                   No calls recorded yet.
                 </div>
               ) : (
                 <div className="divide-y max-h-[400px] overflow-y-auto">
                   {logs.slice(0, 5).map(log => (
                     <div key={log.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                       <div className="flex flex-col">
                         <span className="text-sm font-medium">{log.caller_number}</span>
                         <span className="text-[10px] text-muted-foreground">
                           {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                         </span>
                       </div>
                       <div className="flex items-center gap-3">
                         <Badge variant="outline" className={cn(
                           "text-[10px] uppercase h-5",
                           log.call_status === 'answered' ? "text-green-600 border-green-200 bg-green-50" : "text-muted-foreground"
                         )}>
                           {log.call_status}
                         </Badge>
                         <div className="text-[10px] font-mono">
                           {Math.floor(log.duration / 60)}m {log.duration % 60}s
                         </div>
                       </div>
                     </div>
                   ))}
                 </div>
               )}
            </CardContent>
            {logs.length > 5 && (
              <div className="p-3 bg-muted/30 border-t text-center">
                <Button variant="ghost" size="sm" className="text-xs h-7">View All Logs</Button>
              </div>
            )}
          </Card>
        </div>
          </div>
        </TabsContent>
        <TabsContent value="leads">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" /> Captured Leads
              </CardTitle>
              <CardDescription>
                Contacts automatically identified as leads by your AI agent during their calls.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {leads.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <User className="h-10 w-10 mx-auto text-muted-foreground/30 mb-4" />
                  <p>No leads captured yet.</p>
                  <p className="text-sm">When the AI identifies a caller as a warm lead, they will appear here.</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Phone Number</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leads.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell className="font-medium">{lead.caller_number}</TableCell>
                          <TableCell>{format(new Date(lead.created_at), "MMM d, yyyy h:mm a")}</TableCell>
                          <TableCell>{Math.floor(lead.duration / 60)}m {lead.duration % 60}s</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                              Warm Lead
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm">
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-[500px] w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    </div>
  );
}

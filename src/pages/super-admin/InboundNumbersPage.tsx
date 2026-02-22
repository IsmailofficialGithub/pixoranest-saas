import { useEffect, useState, useCallback, useMemo } from "react";
import {
  PhoneIncoming, Search, Plus, Trash2, RefreshCw, UserPlus, Filter, X, Smartphone, Globe, CheckCircle, AlertCircle
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface InboundNumber {
  id: string;
  phone_number: string;
  country_code: string;
  label: string | null;
  provider: string | null;
  assigned_user_id: string | null;
  status: string;
  created_at: string;
  // Enriched
  owner_email?: string;
}

export default function InboundNumbersPage() {
  const { toast } = useToast();
  const [numbers, setNumbers] = useState<InboundNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  // Dialogs
  const [addOpen, setAddOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<InboundNumber | null>(null);
  
  // Forms
  const [newNumber, setNewNumber] = useState({ phone_number: "", provider: "Twilio", label: "" });
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<any[]>([]);
  const [assigning, setAssigning] = useState(false);

  const fetchNumbers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("inbound_numbers" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Enrich with owner email
      const enriched = await Promise.all((data || []).map(async (num: any) => {
        if (!num.assigned_user_id) return num;
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("user_id", num.assigned_user_id)
          .single();
        return { ...num, owner_email: profile?.email || "Unknown" };
      }));

      setNumbers(enriched);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchNumbers();
  }, [fetchNumbers]);

  const handleAddNumber = async () => {
    if (!newNumber.phone_number) return;
    try {
      const { error } = await supabase.from("inbound_numbers" as any).insert([newNumber]);
      if (error) throw error;
      toast({ title: "Success", description: "Phone number added successfully." });
      setAddOpen(false);
      setNewNumber({ phone_number: "", provider: "Twilio", label: "" });
      fetchNumbers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this phone number? This will also remove any configured agents.")) return;
    const { error } = await supabase.from("inbound_numbers" as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Number removed." });
      fetchNumbers();
    }
  };

  const searchUsers = async (term: string) => {
    setUserSearch(term);
    if (term.length < 3) {
      setUserResults([]);
      return;
    }
    const { data } = await supabase.from("profiles").select("user_id, email, full_name").ilike("email", `%${term}%`).limit(5);
    setUserResults(data || []);
  };

  const handleAssign = async (userId: string) => {
    if (!selectedNumber) return;
    setAssigning(true);
    try {
      const { error } = await supabase
        .from("inbound_numbers" as any)
        .update({ assigned_user_id: userId, status: 'assigned' })
        .eq("id", selectedNumber.id);
      
      if (error) throw error;
      toast({ title: "Assigned", description: "Number assigned to client." });
      setAssignOpen(false);
      fetchNumbers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  };

  const filtered = numbers.filter(n => 
    n.phone_number.includes(search) || 
    (n.label && n.label.toLowerCase().includes(search.toLowerCase())) ||
    (n.owner_email && n.owner_email.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inbound Numbers</h1>
          <p className="text-muted-foreground">Manage and assign inbound phone numbers to clients</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchNumbers} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Number
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by number, label or client email..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <PhoneIncoming className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold">No numbers found</h3>
            <p className="text-sm text-muted-foreground">Add your first inbound number to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phone Number</TableHead>
                <TableHead>Provider / Label</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((num) => (
                <TableRow key={num.id}>
                  <TableCell className="font-mono font-medium">{num.phone_number}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm">{num.provider || "Twilio"}</span>
                      {num.label && <span className="text-xs text-muted-foreground">{num.label}</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={num.status === 'assigned' ? 'default' : 'secondary'} className="capitalize">
                      {num.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {num.owner_email ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{num.owner_email}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" 
                                onClick={() => { setSelectedNumber(num); setAssignOpen(true); }}>
                          <X className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" className="text-primary h-8" 
                              onClick={() => { setSelectedNumber(num); setAssignOpen(true); }}>
                        <UserPlus className="mr-2 h-4 w-4" /> Assign User
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(num.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(num.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Number Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Inbound Number</DialogTitle>
            <DialogDescription>Add a new phone number to your inventory.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Phone Number (E.164 format)</Label>
              <Input placeholder="+1234567890" value={newNumber.phone_number} 
                     onChange={e => setNewNumber(p => ({...p, phone_number: e.target.value}))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select value={newNumber.provider} onValueChange={v => setNewNumber(p => ({...p, provider: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Twilio">Twilio</SelectItem>
                    <SelectItem value="Vonage">Vonage</SelectItem>
                    <SelectItem value="Telnyx">Telnyx</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Label (Optional)</Label>
                <Input placeholder="General Support" value={newNumber.label} 
                       onChange={e => setNewNumber(p => ({...p, label: e.target.value}))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddNumber} disabled={!newNumber.phone_number}>Add Number</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign User Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Number</DialogTitle>
            <DialogDescription>Assign {selectedNumber?.phone_number} to a client account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>User Email</Label>
              <Input placeholder="Search client email..." value={userSearch} onChange={e => searchUsers(e.target.value)} />
            </div>
            <div className="space-y-2">
              {userResults.length > 0 && (
                <div className="rounded-md border divide-y overflow-hidden">
                  {userResults.map(u => (
                    <div key={u.user_id} className="p-3 hover:bg-muted cursor-pointer flex justify-between items-center"
                         onClick={() => handleAssign(u.user_id)}>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{u.email}</span>
                        <span className="text-xs text-muted-foreground">{u.full_name || "No name"}</span>
                      </div>
                      <Button variant="ghost" size="sm">Select</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

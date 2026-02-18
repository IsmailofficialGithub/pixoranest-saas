import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Search, UserPlus, LayoutGrid, List, Package, Activity, DollarSign,
  MoreHorizontal, Mail, Phone, Eye, Pencil, MessageSquare, FileText,
  Ban, Trash2, Users, UserCheck, UserX, TrendingUp, Download, X, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import ClientFormModal from "@/components/admin/ClientFormModal";
import AssignServicesModal from "@/components/admin/AssignServicesModal";

type ClientRow = {
  id: string;
  company_name: string;
  industry: string | null;
  company_size: string | null;
  is_active: boolean;
  created_at: string;
  onboarded_at: string | null;
  user_id: string;
  allow_admin_raw_access: boolean | null;
  profile?: {
    email: string;
    full_name: string | null;
    phone: string | null;
    is_active: boolean;
  };
  active_services_count: number;
  total_usage: number;
  total_revenue: number;
};

export default function MyClientsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState<"grid" | "table">(() => {
    return (localStorage.getItem("admin-clients-view") as "grid" | "table") || "grid";
  });
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<ClientRow | null>(null);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientRow | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignClientId, setAssignClientId] = useState("");
  const [assignClientName, setAssignClientName] = useState("");

  const pageSize = viewMode === "grid" ? 12 : 20;

  // Debounce search
  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    setPage(1);
    const timer = setTimeout(() => setDebouncedSearch(val), 300);
    return () => clearTimeout(timer);
  }, []);

  // Persist view mode
  const toggleView = (mode: "grid" | "table") => {
    setViewMode(mode);
    localStorage.setItem("admin-clients-view", mode);
    setSelectedIds(new Set());
  };

  // Fetch clients
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async () => {
      // Fetch clients
      const { data: clientsData, error: clientsErr } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });

      if (clientsErr) throw clientsErr;
      if (!clientsData?.length) return [];

      // Fetch profiles for all client user_ids
      const userIds = clientsData.map((c) => c.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, full_name, phone, is_active")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

      // Fetch service counts
      const clientIds = clientsData.map((c) => c.id);
      const { data: services } = await supabase
        .from("client_services")
        .select("client_id, is_active, usage_consumed, service_id")
        .in("client_id", clientIds);

      // Fetch service categories
      const { data: allServices } = await supabase
        .from("services")
        .select("id, category");
      const serviceCategoryMap = new Map(allServices?.map((s) => [s.id, s.category]) || []);

      // Fetch revenue
      const { data: invoices } = await supabase
        .from("invoices")
        .select("client_id, total_amount, status")
        .in("client_id", clientIds)
        .eq("status", "paid");

      // Aggregate
      const serviceCountMap = new Map<string, { active: number; usage: number; categories: Set<string> }>();
      services?.forEach((s) => {
        const entry = serviceCountMap.get(s.client_id) || { active: 0, usage: 0, categories: new Set() };
        if (s.is_active) entry.active++;
        entry.usage += s.usage_consumed || 0;
        const cat = serviceCategoryMap.get(s.service_id);
        if (cat) entry.categories.add(cat);
        serviceCountMap.set(s.client_id, entry);
      });

      const revenueMap = new Map<string, number>();
      invoices?.forEach((inv) => {
        if (inv.client_id) {
          revenueMap.set(inv.client_id, (revenueMap.get(inv.client_id) || 0) + Number(inv.total_amount));
        }
      });

      return clientsData.map((c) => ({
        ...c,
        profile: profileMap.get(c.user_id) || { email: "", full_name: null, phone: null, is_active: true },
        active_services_count: serviceCountMap.get(c.id)?.active || 0,
        total_usage: serviceCountMap.get(c.id)?.usage || 0,
        total_revenue: revenueMap.get(c.id) || 0,
        _categories: serviceCountMap.get(c.id)?.categories || new Set(),
      })) as (ClientRow & { _categories: Set<string> })[];
    },
  });

  // Filter and sort
  const filtered = useMemo(() => {
    let result = [...clients];
    const q = debouncedSearch.toLowerCase();
    if (q) {
      result = result.filter(
        (c) =>
          c.company_name.toLowerCase().includes(q) ||
          c.profile?.full_name?.toLowerCase().includes(q) ||
          c.profile?.email?.toLowerCase().includes(q) ||
          c.profile?.phone?.includes(q)
      );
    }
    if (statusFilter === "active") result = result.filter((c) => c.is_active);
    if (statusFilter === "inactive") result = result.filter((c) => !c.is_active);
    if (serviceFilter !== "all") {
      result = result.filter((c) => (c as any)._categories?.has(serviceFilter));
    }
    switch (sortBy) {
      case "oldest": result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); break;
      case "name": result.sort((a, b) => a.company_name.localeCompare(b.company_name)); break;
      case "services": result.sort((a, b) => b.active_services_count - a.active_services_count); break;
      case "usage": result.sort((a, b) => b.total_usage - a.total_usage); break;
      default: result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return result;
  }, [clients, debouncedSearch, statusFilter, serviceFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Stats
  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      total: clients.length,
      active: clients.filter((c) => c.is_active).length,
      inactive: clients.filter((c) => !c.is_active).length,
      newThisMonth: clients.filter((c) => new Date(c.created_at) >= monthStart).length,
    };
  }, [clients]);

  // Delete client
  const deleteClientMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      toast.success("Client deleted successfully");
      setDeleteDialogOpen(false);
      setClientToDelete(null);
    },
    onError: (error: any) => {
      console.error("Error deleting client:", error);
      toast.error(error.message || "Failed to delete client. Check if they have active data dependencies.");
    },
  });

  // Toggle client status
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("clients").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { is_active }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      toast.success(is_active ? "Client activated" : "Client suspended");
    },
    onError: () => toast.error("Failed to update client status"),
  });

  // Selection helpers
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === paginated.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginated.map((c) => c.id)));
    }
  };

  // Export CSV
  const exportCSV = (items: ClientRow[]) => {
    const headers = ["Company Name", "Contact Person", "Email", "Phone", "Active Services", "Total Usage", "Revenue (₹)", "Status", "Onboarded"];
    const rows = items.map((c) => [
      c.company_name,
      c.profile?.full_name || "",
      c.profile?.email || "",
      c.profile?.phone || "",
      c.active_services_count,
      c.total_usage,
      c.total_revenue.toFixed(2),
      c.is_active ? "Active" : "Inactive",
      c.onboarded_at ? format(new Date(c.onboarded_at), "dd/MM/yyyy") : "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clients-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Clients exported successfully");
  };

  const getInitials = (name?: string | null) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const ActionMenu = ({ client }: { client: ClientRow }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => navigate(`/admin/clients/${client.id}`)}>
          <Eye className="mr-2 h-4 w-4" /> View Details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { setEditingClient(client); setFormModalOpen(true); }}>
          <Pencil className="mr-2 h-4 w-4" /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem>
          <MessageSquare className="mr-2 h-4 w-4" /> Send Message
        </DropdownMenuItem>
        <DropdownMenuItem>
          <FileText className="mr-2 h-4 w-4" /> Generate Invoice
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => toggleStatusMutation.mutate({ id: client.id, is_active: !client.is_active })}
        >
          <Ban className="mr-2 h-4 w-4" />
          {client.is_active ? "Suspend" : "Activate"}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive"
          onClick={() => {
            setClientToDelete(client);
            setDeleteDialogOpen(true);
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Clients</h1>
          <p className="text-muted-foreground">{stats.total} clients total</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportCSV(filtered)}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          <Button onClick={() => { setEditingClient(null); setFormModalOpen(true); }}>
            <UserPlus className="mr-2 h-4 w-4" /> Add New Client
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
            <div><p className="text-2xl font-bold text-foreground">{stats.total}</p><p className="text-xs text-muted-foreground">Total Clients</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10"><UserCheck className="h-5 w-5 text-green-500" /></div>
            <div><p className="text-2xl font-bold text-foreground">{stats.active}</p><p className="text-xs text-muted-foreground">Active</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted"><UserX className="h-5 w-5 text-muted-foreground" /></div>
            <div><p className="text-2xl font-bold text-foreground">{stats.inactive}</p><p className="text-xs text-muted-foreground">Inactive</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10"><TrendingUp className="h-5 w-5 text-blue-500" /></div>
            <div><p className="text-2xl font-bold text-foreground">{stats.newThisMonth}</p><p className="text-xs text-muted-foreground">New This Month</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by company, contact, email, or phone..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            <SelectItem value="active">Active Only</SelectItem>
            <SelectItem value="inactive">Inactive Only</SelectItem>
          </SelectContent>
        </Select>
        <Select value={serviceFilter} onValueChange={(v) => { setServiceFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Services</SelectItem>
            <SelectItem value="voice">Voice Services</SelectItem>
            <SelectItem value="messaging">Messaging Services</SelectItem>
            <SelectItem value="social_media">Social Media</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="name">Company A-Z</SelectItem>
            <SelectItem value="services">Most Services</SelectItem>
            <SelectItem value="usage">Most Usage</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex border rounded-md">
          <Button variant={viewMode === "grid" ? "default" : "ghost"} size="icon" className="h-9 w-9 rounded-r-none" onClick={() => toggleView("grid")}>
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button variant={viewMode === "table" ? "default" : "ghost"} size="icon" className="h-9 w-9 rounded-l-none" onClick={() => toggleView("table")}>
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="p-6 h-48" /></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">
              {clients.length === 0 ? "You haven't added any clients yet" : "No clients match your filters"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {clients.length === 0 ? "Add your first client to start offering services" : "Try adjusting your search or filters"}
            </p>
            {clients.length === 0 && (
              <Button size="lg" onClick={() => { setEditingClient(null); setFormModalOpen(true); }}>
                <UserPlus className="mr-2 h-5 w-5" /> Add Client
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginated.map((client) => (
            <Card
              key={client.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/admin/clients/${client.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                        {getInitials(client.company_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-base">{client.company_name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{client.profile?.full_name || "No contact"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Badge variant={client.is_active ? "default" : "secondary"} className={client.is_active ? "bg-green-500/10 text-green-600 border-green-200" : ""}>
                      {client.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <ActionMenu client={client} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1 text-sm">
                  {client.profile?.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" /> <span className="truncate">{client.profile.email}</span>
                    </div>
                  )}
                  {client.profile?.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" /> {client.profile.phone}
                    </div>
                  )}
                </div>
                {client.industry && <Badge variant="outline" className="text-xs">{client.industry}</Badge>}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                  <div className="text-center">
                    <div className="flex justify-center"><Package className="h-4 w-4 text-primary" /></div>
                    <p className="text-sm font-semibold text-foreground">{client.active_services_count}</p>
                    <p className="text-[10px] text-muted-foreground">Services</p>
                  </div>
                  <div className="text-center">
                    <div className="flex justify-center"><Activity className="h-4 w-4 text-blue-500" /></div>
                    <p className="text-sm font-semibold text-foreground">{client.total_usage}</p>
                    <p className="text-[10px] text-muted-foreground">Usage</p>
                  </div>
                  <div className="text-center">
                    <div className="flex justify-center"><DollarSign className="h-4 w-4 text-green-500" /></div>
                    <p className="text-sm font-semibold text-foreground">₹{client.total_revenue.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">Revenue</p>
                  </div>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant={client.active_services_count > 0 ? "outline" : "default"}
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setAssignClientId(client.id);
                      setAssignClientName(client.company_name);
                      setAssignModalOpen(true);
                    }}
                  >
                    {client.active_services_count > 0 ? "Manage Services" : "Assign Services"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={paginated.length > 0 && selectedIds.size === paginated.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-center">Services</TableHead>
                  <TableHead className="text-center">Usage</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Onboarded</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((client) => (
                  <TableRow
                    key={client.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/admin/clients/${client.id}`)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selectedIds.has(client.id)} onCheckedChange={() => toggleSelect(client.id)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">{getInitials(client.company_name)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-foreground">{client.company_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{client.profile?.full_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{client.profile?.email || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{client.profile?.phone || "—"}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{client.active_services_count}</Badge>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">{client.total_usage}</TableCell>
                    <TableCell className="text-right font-medium text-foreground">₹{client.total_revenue.toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={client.is_active ? "default" : "secondary"} className={client.is_active ? "bg-green-500/10 text-green-600 border-green-200" : ""}>
                        {client.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {client.onboarded_at ? format(new Date(client.onboarded_at), "dd MMM yyyy") : "—"}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <ActionMenu client={client} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-background border rounded-lg shadow-lg p-3 flex items-center gap-3 z-50">
          <span className="text-sm font-medium text-foreground">{selectedIds.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => exportCSV(filtered.filter((c) => selectedIds.has(c.id)))}>
            <Download className="mr-1 h-3 w-3" /> Export
          </Button>
          <Button size="sm" variant="outline" className="text-destructive" onClick={() => {
            toggleStatusMutation.mutate({ id: [...selectedIds][0], is_active: false });
          }}>
            <Ban className="mr-1 h-3 w-3" /> Suspend
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Pagination */}
      {filtered.length > pageSize && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = page <= 3 ? i + 1 : page + i - 2;
              if (p < 1 || p > totalPages) return null;
              return (
                <Button key={p} variant={p === page ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => setPage(p)}>
                  {p}
                </Button>
              );
            })}
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Client</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{clientToDelete?.company_name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                if (clientToDelete) {
                  deleteClientMutation.mutate(clientToDelete.id);
                }
              }}
              disabled={deleteClientMutation.isPending}
            >
              {deleteClientMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Client Form Modal */}
      <ClientFormModal
        open={formModalOpen}
        onOpenChange={setFormModalOpen}
        client={editingClient}
        onSuccess={(clientId) => {
          if (clientId) navigate(`/admin/clients/${clientId}`);
        }}
      />
      {/* Assign Services Modal */}
      <AssignServicesModal
        open={assignModalOpen}
        onOpenChange={setAssignModalOpen}
        clientId={assignClientId}
        clientCompanyName={assignClientName}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["admin-clients"] })}
      />
    </div>
  );
}

import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, MoreHorizontal, Eye, Pencil, ShieldOff, ShieldCheck, Trash2, Search, Settings,
} from "lucide-react";
import ManageWorkflowsDialog from "@/components/super-admin/ManageWorkflowsDialog";
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface ClientRow {
  id: string;
  user_id: string;
  company_name: string;
  industry: string | null;
  company_size: string | null;
  admin_id: string;
  admin_company: string;
  is_active: boolean;
  created_at: string;
  onboarded_at: string | null;
  full_name: string | null;
  email: string;
  phone: string | null;
  active_services_count: number;
}

interface AdminOption {
  id: string;
  company_name: string;
}

type SortField = "company_name" | "full_name" | "email" | "admin_company" | "active_services_count" | "industry" | "created_at";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 20;

export default function ClientsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [adminOptions, setAdminOptions] = useState<AdminOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [adminFilter, setAdminFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [suspendTarget, setSuspendTarget] = useState<ClientRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientRow | null>(null);

  // Edit modal state
  const [editTarget, setEditTarget] = useState<ClientRow | null>(null);
  const [editForm, setEditForm] = useState({ company_name: "", industry: "", company_size: "", full_name: "", phone: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [workflowTarget, setWorkflowTarget] = useState<ClientRow | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchAdminOptions = useCallback(async () => {
    const { data } = await supabase.from("admins").select("id, company_name").order("company_name");
    setAdminOptions(data ?? []);
  }, []);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    const { data: clientsData, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const enriched: ClientRow[] = await Promise.all(
      (clientsData ?? []).map(async (c) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email, phone")
          .eq("user_id", c.user_id)
          .single();

        const { data: admin } = await supabase
          .from("admins")
          .select("company_name")
          .eq("id", c.admin_id)
          .single();

        const { count } = await supabase
          .from("client_services")
          .select("id", { count: "exact", head: true })
          .eq("client_id", c.id)
          .eq("is_active", true);

        return {
          id: c.id,
          user_id: c.user_id,
          company_name: c.company_name,
          industry: c.industry,
          company_size: c.company_size,
          admin_id: c.admin_id,
          admin_company: admin?.company_name ?? "—",
          is_active: c.is_active,
          created_at: c.created_at,
          onboarded_at: c.onboarded_at,
          full_name: profile?.full_name ?? null,
          email: profile?.email ?? "",
          phone: profile?.phone ?? null,
          active_services_count: count ?? 0,
        };
      })
    );

    setClients(enriched);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchAdminOptions();
    fetchClients();
  }, [fetchAdminOptions, fetchClients]);

  // Filter + search + sort
  const filtered = useMemo(() => {
    let list = clients;

    if (statusFilter === "active") list = list.filter((c) => c.is_active);
    else if (statusFilter === "inactive") list = list.filter((c) => !c.is_active);

    if (adminFilter !== "all") list = list.filter((c) => c.admin_id === adminFilter);

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(
        (c) =>
          c.company_name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.phone ?? "").toLowerCase().includes(q) ||
          (c.full_name ?? "").toLowerCase().includes(q)
      );
    }

    list = [...list].sort((a, b) => {
      let av: string | number = (a as any)[sortField] ?? "";
      let bv: string | number = (b as any)[sortField] ?? "";
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [clients, statusFilter, adminFilter, debouncedSearch, sortField, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => { setPage(0); }, [debouncedSearch, statusFilter, adminFilter]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const sortIndicator = (field: SortField) =>
    sortField === field ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  const handleSuspendToggle = async () => {
    if (!suspendTarget) return;
    const newActive = !suspendTarget.is_active;
    const { error } = await supabase
      .from("clients")
      .update({ is_active: newActive })
      .eq("id", suspendTarget.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Client ${newActive ? "activated" : "suspended"} successfully` });
      setClients((prev) =>
        prev.map((c) => (c.id === suspendTarget.id ? { ...c, is_active: newActive } : c))
      );
    }
    setSuspendTarget(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from("clients")
      .update({ is_active: false })
      .eq("id", deleteTarget.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Client deleted successfully" });
      setClients((prev) =>
        prev.map((c) => (c.id === deleteTarget.id ? { ...c, is_active: false } : c))
      );
    }
    setDeleteTarget(null);
  };

  // Edit modal
  const openEdit = (client: ClientRow) => {
    setEditTarget(client);
    setEditForm({
      company_name: client.company_name,
      industry: client.industry ?? "",
      company_size: client.company_size ?? "",
      full_name: client.full_name ?? "",
      phone: client.phone ?? "",
    });
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    setEditSaving(true);

    const { error: clientError } = await supabase
      .from("clients")
      .update({
        company_name: editForm.company_name,
        industry: editForm.industry || null,
        company_size: (editForm.company_size || null) as any,
      })
      .eq("id", editTarget.id);

    if (clientError) {
      toast({ title: "Error", description: clientError.message, variant: "destructive" });
      setEditSaving(false);
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: editForm.full_name || null,
        phone: editForm.phone || null,
      })
      .eq("user_id", editTarget.user_id);

    if (profileError) {
      toast({ title: "Error", description: profileError.message, variant: "destructive" });
      setEditSaving(false);
      return;
    }

    toast({ title: "Client updated successfully" });
    setClients((prev) =>
      prev.map((c) =>
        c.id === editTarget.id
          ? {
              ...c,
              company_name: editForm.company_name,
              industry: editForm.industry || null,
              company_size: editForm.company_size || null,
              full_name: editForm.full_name || null,
              phone: editForm.phone || null,
            }
          : c
      )
    );
    setEditTarget(null);
    setEditSaving(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Clients</h1>
        <p className="text-muted-foreground">All clients across all admins</p>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by company name, email, or phone..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={adminFilter} onValueChange={setAdminFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Admins</SelectItem>
            {adminOptions.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.company_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
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
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">No clients found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {debouncedSearch || statusFilter !== "all" || adminFilter !== "all"
                ? "Try adjusting your search or filters."
                : "No clients have been created yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("company_name")}>
                    Client Name{sortIndicator("company_name")}
                  </TableHead>
                  <TableHead className="text-center">Role</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("full_name")}>
                    Contact Person{sortIndicator("full_name")}
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("email")}>
                    Email{sortIndicator("email")}
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("admin_company")}>
                    Admin{sortIndicator("admin_company")}
                  </TableHead>
                  <TableHead className="cursor-pointer select-none text-center" onClick={() => handleSort("active_services_count")}>
                    Active Services{sortIndicator("active_services_count")}
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("industry")}>
                    Industry{sortIndicator("industry")}
                  </TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("created_at")}>
                    Onboarded{sortIndicator("created_at")}
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((client) => (
                  <TableRow
                    key={client.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/super-admin/clients/${client.id}`)}
                  >
                    <TableCell className="font-medium">{client.company_name}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Client</Badge>
                    </TableCell>
                    <TableCell>{client.full_name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{client.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{client.admin_company}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{client.active_services_count} services</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{client.industry ?? "—"}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={client.is_active ? "default" : "destructive"}
                        className={client.is_active ? "bg-green-100 text-green-700 hover:bg-green-100" : ""}
                      >
                        {client.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {client.onboarded_at
                        ? format(new Date(client.onboarded_at), "MMM d, yyyy")
                        : format(new Date(client.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/super-admin/clients/${client.id}`)}>
                            <Eye className="mr-2 h-4 w-4" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setWorkflowTarget(client)}>
                            <Settings className="mr-2 h-4 w-4" /> Manage Workflows
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(client)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setSuspendTarget(client)}>
                            {client.is_active ? (
                              <><ShieldOff className="mr-2 h-4 w-4" /> Suspend</>
                            ) : (
                              <><ShieldCheck className="mr-2 h-4 w-4" /> Activate</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteTarget(client)}
                          >
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Suspend/Activate Dialog */}
      <AlertDialog open={!!suspendTarget} onOpenChange={() => setSuspendTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {suspendTarget?.is_active ? "Suspend" : "Activate"} {suspendTarget?.company_name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {suspendTarget?.is_active
                ? "This client will be suspended and won't be able to access the platform."
                : "This client will be reactivated and regain platform access."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSuspendToggle}>
              {suspendTarget?.is_active ? "Suspend" : "Activate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.company_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the client account. Their data will remain but they won't be able to log in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Client Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>Update client information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input
                value={editForm.company_name}
                onChange={(e) => setEditForm((f) => ({ ...f, company_name: e.target.value }))}
                placeholder="Company Name"
              />
            </div>
            <div className="space-y-2">
              <Label>Contact Person</Label>
              <Input
                value={editForm.full_name}
                onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder="Full Name"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={editForm.phone}
                onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+91 1234567890"
              />
            </div>
            <div className="space-y-2">
              <Label>Industry</Label>
              <Input
                value={editForm.industry}
                onChange={(e) => setEditForm((f) => ({ ...f, industry: e.target.value }))}
                placeholder="e.g., Healthcare, Finance"
              />
            </div>
            <div className="space-y-2">
              <Label>Company Size</Label>
              <Select value={editForm.company_size} onValueChange={(v) => setEditForm((f) => ({ ...f, company_size: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-10">1-10</SelectItem>
                  <SelectItem value="11-50">11-50</SelectItem>
                  <SelectItem value="51-200">51-200</SelectItem>
                  <SelectItem value="201-500">201-500</SelectItem>
                  <SelectItem value="500+">500+</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={editSaving || !editForm.company_name.trim()}>
              {editSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Workflows Dialog */}
      <ManageWorkflowsDialog
        open={!!workflowTarget}
        onOpenChange={(open) => { if (!open) setWorkflowTarget(null); }}
        clientId={workflowTarget?.id ?? ""}
        clientCompanyName={workflowTarget?.company_name ?? ""}
      />
    </div>
  );
}

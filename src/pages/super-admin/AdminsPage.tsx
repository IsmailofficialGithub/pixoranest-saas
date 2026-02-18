import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus, Users, MoreHorizontal, Eye, Pencil, ShieldOff, ShieldCheck, Trash2, Search, Layers } from "lucide-react";
import AdminFormModal from "@/components/super-admin/AdminFormModal";
import AdminServiceAssignment from "@/components/super-admin/AdminServiceAssignment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AdminRow {
  id: string;
  user_id: string;
  company_name: string;
  company_website: string | null;
  commission_rate: number | null;
  is_active: boolean;
  created_at: string;
  full_name: string | null;
  email: string;
  client_count: number;
  monthly_revenue: number;
}

type SortField = "company_name" | "full_name" | "email" | "commission_rate" | "client_count" | "monthly_revenue" | "created_at";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 20;

export default function AdminsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [suspendTarget, setSuspendTarget] = useState<AdminRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminRow | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    const { data: adminsData, error } = await supabase
      .from("admins")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const enriched: AdminRow[] = await Promise.all(
      (adminsData ?? []).map(async (a) => {
        // Get profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("user_id", a.user_id)
          .single();

        // Get client count
        const { count } = await supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("admin_id", a.id);

        // Get monthly revenue
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
        const { data: invoices } = await supabase
          .from("invoices")
          .select("total_amount")
          .eq("admin_id", a.id)
          .eq("status", "paid")
          .gte("invoice_date", startOfMonth)
          .lte("invoice_date", endOfMonth);

        const revenue = (invoices ?? []).reduce((sum, inv) => sum + Number(inv.total_amount), 0);

        return {
          id: a.id,
          user_id: a.user_id,
          company_name: a.company_name,
          company_website: a.company_website,
          commission_rate: a.commission_rate,
          is_active: a.is_active,
          created_at: a.created_at,
          full_name: profile?.full_name ?? null,
          email: profile?.email ?? "",
          client_count: count ?? 0,
          monthly_revenue: revenue,
        };
      })
    );

    setAdmins(enriched);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  // Filter + search + sort
  const filtered = useMemo(() => {
    let list = admins;

    // Status filter
    if (statusFilter === "active") list = list.filter((a) => a.is_active);
    else if (statusFilter === "inactive") list = list.filter((a) => !a.is_active);

    // Search
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(
        (a) =>
          a.company_name.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          (a.full_name ?? "").toLowerCase().includes(q)
      );
    }

    // Sort
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
  }, [admins, statusFilter, debouncedSearch, sortField, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page on filter change
  useEffect(() => { setPage(0); }, [debouncedSearch, statusFilter]);

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
      .from("admins")
      .update({ is_active: newActive })
      .eq("id", suspendTarget.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Admin ${newActive ? "activated" : "suspended"} successfully` });
      setAdmins((prev) =>
        prev.map((a) => (a.id === suspendTarget.id ? { ...a, is_active: newActive } : a))
      );
    }
    setSuspendTarget(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from("admins")
      .update({ is_active: false })
      .eq("id", deleteTarget.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Admin deleted successfully" });
      setAdmins((prev) =>
        prev.map((a) => (a.id === deleteTarget.id ? { ...a, is_active: false } : a))
      );
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admins (Resellers)</h1>
          <p className="text-muted-foreground">Manage your reseller partners</p>
        </div>
        <Button onClick={() => { setEditTarget(null); setModalOpen(true); }}>
          <UserPlus className="mr-2 h-4 w-4" />
          Add New Admin
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by company name or email..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
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
            <h3 className="mt-4 text-lg font-semibold text-foreground">No admins found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {debouncedSearch || statusFilter !== "all"
                ? "Try adjusting your search or filters."
                : "Get started by adding your first admin."}
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
                    Company Name{sortIndicator("company_name")}
                  </TableHead>
                  <TableHead className="text-center">Role</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("full_name")}>
                    Admin Name{sortIndicator("full_name")}
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("email")}>
                    Email{sortIndicator("email")}
                  </TableHead>
                  <TableHead className="cursor-pointer select-none text-center" onClick={() => handleSort("commission_rate")}>
                    Commission{sortIndicator("commission_rate")}
                  </TableHead>
                  <TableHead className="cursor-pointer select-none text-center" onClick={() => handleSort("client_count")}>
                    Clients{sortIndicator("client_count")}
                  </TableHead>
                  <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort("monthly_revenue")}>
                    Monthly Revenue{sortIndicator("monthly_revenue")}
                  </TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((admin) => (
                  <TableRow
                    key={admin.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/super-admin/admins/${admin.id}`)}
                  >
                    <TableCell className="font-medium">{admin.company_name}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Admin</Badge>
                    </TableCell>
                    <TableCell>{admin.full_name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{admin.email}</TableCell>
                    <TableCell className="text-center">{admin.commission_rate ?? 0}%</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{admin.client_count}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      ₹{admin.monthly_revenue.toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={admin.is_active ? "default" : "destructive"}
                        className={admin.is_active ? "bg-green-100 text-green-700 hover:bg-green-100" : ""}
                      >
                        {admin.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <AdminServiceAssignment adminId={admin.id} adminName={admin.company_name} />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/super-admin/admins/${admin.id}`)}>
                              <Eye className="mr-2 h-4 w-4" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setEditTarget(admin); setModalOpen(true); }}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSuspendTarget(admin)}>
                              {admin.is_active ? (
                                <><ShieldOff className="mr-2 h-4 w-4" /> Suspend</>
                              ) : (
                                <><ShieldCheck className="mr-2 h-4 w-4" /> Activate</>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteTarget(admin)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
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
                ? "This admin will be suspended and won't be able to access the platform."
                : "This admin will be reactivated and regain platform access."}
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
              This will deactivate the admin account. Their clients and data will remain but the admin won't be able to log in.
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
      {/* Add/Edit Admin Modal */}
      <AdminFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editData={editTarget}
        onSuccess={fetchAdmins}
      />
    </div>
  );
}

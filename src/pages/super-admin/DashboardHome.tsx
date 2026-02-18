import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Briefcase, Layers, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

interface StatsData {
  totalAdmins: number;
  totalClients: number;
  totalServices: number;
  monthlyRevenue: number;
}

interface AdminRow {
  id: string;
  company_name: string;
  is_active: boolean;
  created_at: string;
  user_id: string;
  profile_email: string | null;
  profile_name: string | null;
  client_count: number;
  role: string | null;
}

interface ClientRow {
  id: string;
  company_name: string;
  is_active: boolean;
  created_at: string;
  user_id: string;
  admin_id: string;
  profile_email: string | null;
  profile_name: string | null;
  admin_company: string | null;
  role: string | null;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

const statCards = [
  { key: "totalAdmins", label: "Total Admins", sub: "Active resellers", icon: Users, color: "text-primary", bg: "bg-primary/10" },
  { key: "totalClients", label: "Total Clients", sub: "Active clients", icon: Briefcase, color: "text-secondary", bg: "bg-secondary/10" },
  { key: "totalServices", label: "Services", sub: "Available services", icon: Layers, color: "text-accent-foreground", bg: "bg-accent" },
  { key: "monthlyRevenue", label: "This Month Revenue", sub: "Paid invoices", icon: DollarSign, color: "text-primary", bg: "bg-primary/10" },
] as const;

export default function DashboardHome() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAll() {
      try {
        const [adminsCount, clientsCount, servicesCount, revenueRes, recentAdmins, recentClients] =
          await Promise.all([
            supabase.from("admins").select("id", { count: "exact", head: true }).eq("is_active", true),
            supabase.from("clients").select("id", { count: "exact", head: true }).eq("is_active", true),
            supabase.from("services").select("id", { count: "exact", head: true }).eq("is_active", true),
            supabase
              .from("invoices")
              .select("total_amount")
              .eq("status", "paid")
              .gte("invoice_date", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]),
            supabase
              .from("admins")
              .select("id, company_name, is_active, created_at, user_id")
              .order("created_at", { ascending: false })
              .limit(5),
            supabase
              .from("clients")
              .select("id, company_name, is_active, created_at, user_id, admin_id")
              .order("created_at", { ascending: false })
              .limit(5),
          ]);

        const revenue = (revenueRes.data ?? []).reduce((sum, inv) => sum + Number(inv.total_amount ?? 0), 0);

        setStats({
          totalAdmins: adminsCount.count ?? 0,
          totalClients: clientsCount.count ?? 0,
          totalServices: servicesCount.count ?? 0,
          monthlyRevenue: revenue,
        });

        // Enrich admins with profile + client count
        const adminRows: AdminRow[] = [];
        for (const a of recentAdmins.data ?? []) {
          const [profileRes, countRes, roleRes] = await Promise.all([
            supabase.from("profiles").select("email, full_name").eq("user_id", a.user_id).maybeSingle(),
            supabase.from("clients").select("id", { count: "exact", head: true }).eq("admin_id", a.id),
            supabase.from("user_roles").select("role").eq("user_id", a.user_id).maybeSingle(),
          ]);
          adminRows.push({
            ...a,
            profile_email: profileRes.data?.email ?? null,
            profile_name: profileRes.data?.full_name ?? null,
            client_count: countRes.count ?? 0,
            role: roleRes.data?.role ?? 'admin',
          });
        }
        setAdmins(adminRows);

        // Enrich clients with profile + admin company
        const clientRows: ClientRow[] = [];
        for (const c of recentClients.data ?? []) {
          const [profileRes, adminRes, roleRes] = await Promise.all([
            supabase.from("profiles").select("email, full_name").eq("user_id", c.user_id).maybeSingle(),
            supabase.from("admins").select("company_name").eq("id", c.admin_id).maybeSingle(),
            supabase.from("user_roles").select("role").eq("user_id", c.user_id).maybeSingle(),
          ]);
          clientRows.push({
            ...c,
            profile_email: profileRes.data?.email ?? null,
            profile_name: profileRes.data?.full_name ?? null,
            admin_company: adminRes.data?.company_name ?? null,
            role: roleRes.data?.role ?? 'client',
          });
        }
        setClients(clientRows);
      } catch (e: any) {
        setError(e.message ?? "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Platform overview and key metrics</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((sc) => (
          <Card key={sc.key}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${sc.bg}`}>
                <sc.icon className={`h-6 w-6 ${sc.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{sc.label}</p>
                {loading ? (
                  <Skeleton className="mt-1 h-7 w-16" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">
                    {sc.key === "monthlyRevenue"
                      ? formatCurrency(stats?.monthlyRevenue ?? 0)
                      : (stats?.[sc.key] ?? 0).toLocaleString()}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">{sc.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Admins */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg">Recent Admins</CardTitle>
            <button
              onClick={() => navigate("/super-admin/admins")}
              className="text-sm font-medium text-primary hover:underline"
            >
              View All
            </button>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-3 p-6 pt-0">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : admins.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">No admins found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead className="text-center">Role</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Clients</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admins.map((a) => (
                    <TableRow
                      key={a.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/super-admin/admins/${a.id}`)}
                    >
                      <TableCell className="font-medium">{a.company_name}</TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant="outline" 
                          className={
                            a.role === 'super_admin' ? "bg-red-50 text-red-700 border-red-200" :
                            a.role === 'admin' ? "bg-blue-50 text-blue-700 border-blue-200" :
                            "bg-purple-50 text-purple-700 border-purple-200"
                          }
                        >
                          {a.role?.replace('_', ' ') || 'Admin'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{a.profile_name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{a.profile_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{a.client_count}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={a.is_active ? "default" : "destructive"}>
                          {a.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent Clients */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg">Recent Clients</CardTitle>
            <button
              onClick={() => navigate("/super-admin/clients")}
              className="text-sm font-medium text-primary hover:underline"
            >
              View All
            </button>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-3 p-6 pt-0">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : clients.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">No clients found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead className="text-center">Role</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/super-admin/clients/${c.id}`)}
                    >
                      <TableCell className="font-medium">{c.company_name}</TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant="outline" 
                          className={
                            c.role === 'super_admin' ? "bg-red-50 text-red-700 border-red-200" :
                            c.role === 'admin' ? "bg-blue-50 text-blue-700 border-blue-200" :
                            "bg-purple-50 text-purple-700 border-purple-200"
                          }
                        >
                          {c.role?.replace('_', ' ') || 'Client'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{c.profile_name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{c.profile_email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{c.admin_company ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={c.is_active ? "default" : "destructive"}>
                          {c.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

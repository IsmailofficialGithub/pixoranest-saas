import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, Building2, Globe, Mail, Phone, Users, DollarSign,
  Layers, Calendar, ShieldCheck, ShieldOff,
} from "lucide-react";
import { format } from "date-fns";
import AdminServiceAssignment from "@/components/super-admin/AdminServiceAssignment";

interface AdminDetail {
  id: string;
  user_id: string;
  company_name: string;
  company_website: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  custom_domain: string | null;
  commission_rate: number | null;
  is_active: boolean;
  total_clients: number | null;
  monthly_revenue: number | null;
  created_at: string;
  profile?: {
    full_name: string | null;
    email: string;
    phone: string | null;
  };
}

interface ClientRow {
  id: string;
  company_name: string;
  is_active: boolean;
  created_at: string;
  profile_name: string | null;
  profile_email: string | null;
  active_services: number;
}

export default function AdminDetailPage() {
  const { adminId } = useParams<{ adminId: string }>();
  const navigate = useNavigate();
  const [admin, setAdmin] = useState<AdminDetail | null>(null);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [serviceCount, setServiceCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!adminId) return;
    setLoading(true);

    const { data: adminData } = await supabase
      .from("admins")
      .select("*")
      .eq("id", adminId)
      .maybeSingle();

    if (!adminData) {
      setLoading(false);
      return;
    }

    // Fetch profile, clients, and service assignments in parallel
    const [profileRes, clientsRes, servicesRes] = await Promise.all([
      supabase.from("profiles").select("full_name, email, phone").eq("user_id", adminData.user_id).maybeSingle(),
      supabase.from("clients").select("id, company_name, is_active, created_at, user_id").eq("admin_id", adminId).order("created_at", { ascending: false }),
      supabase.from("admin_service_assignments").select("id", { count: "exact", head: true }).eq("admin_id", adminId).eq("is_enabled", true),
    ]);

    setAdmin({
      ...adminData,
      profile: profileRes.data ? {
        full_name: profileRes.data.full_name,
        email: profileRes.data.email,
        phone: profileRes.data.phone,
      } : undefined,
    } as AdminDetail);

    setServiceCount(servicesRes.count ?? 0);

    // Enrich clients with profiles and service counts
    const enrichedClients: ClientRow[] = await Promise.all(
      (clientsRes.data ?? []).map(async (c) => {
        const [pRes, sRes] = await Promise.all([
          supabase.from("profiles").select("full_name, email").eq("user_id", c.user_id).maybeSingle(),
          supabase.from("client_services").select("id", { count: "exact", head: true }).eq("client_id", c.id).eq("is_active", true),
        ]);
        return {
          id: c.id,
          company_name: c.company_name,
          is_active: c.is_active,
          created_at: c.created_at,
          profile_name: pRes.data?.full_name ?? null,
          profile_email: pRes.data?.email ?? null,
          active_services: sRes.count ?? 0,
        };
      })
    );

    setClients(enrichedClients);
    setLoading(false);
  }, [adminId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-lg font-semibold text-foreground">Admin not found</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/super-admin/admins")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Admins
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/super-admin/admins")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            {admin.logo_url ? (
              <img src={admin.logo_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-foreground">{admin.company_name}</h1>
              <p className="text-sm text-muted-foreground">{admin.profile?.email}</p>
            </div>
          </div>
        </div>
        <Badge variant={admin.is_active ? "default" : "destructive"} className="text-sm">
          {admin.is_active ? (
            <><ShieldCheck className="mr-1 h-3.5 w-3.5" /> Active</>
          ) : (
            <><ShieldOff className="mr-1 h-3.5 w-3.5" /> Inactive</>
          )}
        </Badge>
        <AdminServiceAssignment adminId={admin.id} adminName={admin.company_name} />
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users className="h-5 w-5" />} label="Total Clients" value={clients.length} />
        <StatCard icon={<Layers className="h-5 w-5" />} label="Enabled Services" value={serviceCount} />
        <StatCard icon={<DollarSign className="h-5 w-5" />} label="Commission Rate" value={`${admin.commission_rate ?? 0}%`} />
        <StatCard icon={<Calendar className="h-5 w-5" />} label="Joined" value={format(new Date(admin.created_at), "MMM d, yyyy")} />
      </div>

      {/* Details */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Admin Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DetailRow icon={<Mail className="h-4 w-4" />} label="Email" value={admin.profile?.email || "—"} />
            <DetailRow icon={<Phone className="h-4 w-4" />} label="Phone" value={admin.profile?.phone || "—"} />
            <DetailRow icon={<Building2 className="h-4 w-4" />} label="Contact" value={admin.profile?.full_name || "—"} />
            <DetailRow icon={<Globe className="h-4 w-4" />} label="Website" value={admin.company_website || "—"} />
            {admin.custom_domain && (
              <DetailRow icon={<Globe className="h-4 w-4" />} label="Custom Domain" value={admin.custom_domain} />
            )}
            <Separator />
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Branding</span>
              <div className="flex gap-2">
                <div className="h-6 w-6 rounded-full border" style={{ backgroundColor: admin.primary_color || "#3B82F6" }} title="Primary" />
                <div className="h-6 w-6 rounded-full border" style={{ backgroundColor: admin.secondary_color || "#10B981" }} title="Secondary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Clients Table */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Clients ({clients.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {clients.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">No clients yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-center">Services</TableHead>
                    <TableHead className="text-center">Status</TableHead>
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
                      <TableCell>
                        <div>
                          <p className="text-sm">{c.profile_name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{c.profile_email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{c.active_services}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
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

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}

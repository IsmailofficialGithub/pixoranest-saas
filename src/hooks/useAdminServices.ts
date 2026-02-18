import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/contexts/AdminContext";

interface AdminService {
  id: string;
  name: string;
  slug: string;
  icon_url: string | null;
  description: string | null;
  category: string;
  base_price: number;
  base_pricing_model: string;
  is_locked: boolean;
}

export function useAdminServices() {
  const { admin } = useAdmin();
  const [services, setServices] = useState<AdminService[]>([]);
  const [loading, setLoading] = useState(true);

  const loadServices = useCallback(async () => {
    if (!admin) return;
    setLoading(true);

    // Get all active services
    const { data: allServices } = await supabase
      .from("services")
      .select("id, name, slug, icon_url, description, category, base_price, base_pricing_model")
      .eq("is_active", true)
      .order("name");

    // Get this admin's assignments
    const { data: assignments } = await supabase
      .from("admin_service_assignments")
      .select("service_id, is_enabled")
      .eq("admin_id", admin.id);

    const enabledSet = new Set(
      (assignments ?? []).filter((a) => a.is_enabled).map((a) => a.service_id)
    );

    setServices(
      (allServices ?? []).map((s) => ({
        ...s,
        is_locked: !enabledSet.has(s.id),
      }))
    );
    setLoading(false);
  }, [admin]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  return { services, loading, refetch: loadServices };
}

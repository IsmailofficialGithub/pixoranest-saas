import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useClient } from "@/contexts/ClientContext";

interface ClientService {
  id: string;
  name: string;
  slug: string;
  icon_url: string | null;
  description: string | null;
  category: string;
  is_locked: boolean;
  lock_reason?: string;
}

export function useClientServices() {
  const { client } = useClient();
  const [services, setServices] = useState<ClientService[]>([]);
  const [loading, setLoading] = useState(true);

  const loadServices = useCallback(async () => {
    if (!client) return;
    setLoading(true);

    // Get all active services
    const { data: allServices } = await supabase
      .from("services")
      .select("id, name, slug, icon_url, description, category")
      .eq("is_active", true)
      .order("name");

    // Get client's subscribed services
    const { data: clientServices } = await supabase
      .from("client_services")
      .select("service_id, is_active")
      .eq("client_id", client.id);

    const clientActiveSet = new Set(
      (clientServices ?? []).filter((c) => c.is_active).map((c) => c.service_id)
    );

    setServices(
      (allServices ?? []).map((s) => {
        const clientHas = clientActiveSet.has(s.id);

        return {
          ...s,
          is_locked: !clientHas,
          lock_reason: !clientHas
            ? "Contact your administrator to activate this service."
            : undefined,
        };
      })
    );
    setLoading(false);
  }, [client]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  return { services, loading, refetch: loadServices };
}

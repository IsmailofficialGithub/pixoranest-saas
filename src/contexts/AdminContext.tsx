import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface AdminProfile {
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
}

interface AdminContextType {
  admin: AdminProfile | null;
  isLoading: boolean;
  refetchAdmin: () => Promise<void>;
  primaryColor: string;
  secondaryColor: string;
  logo: string | null;
}

const AdminContext = createContext<AdminContextType>({
  admin: null,
  isLoading: true,
  refetchAdmin: async () => {},
  primaryColor: "#3B82F6",
  secondaryColor: "#10B981",
  logo: null,
});

export const useAdmin = () => useContext(AdminContext);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAdmin = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from("admins")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!error && data) {
      setAdmin(data as AdminProfile);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAdmin();
  }, [fetchAdmin]);

  const primaryColor = admin?.primary_color || "#3B82F6";
  const secondaryColor = admin?.secondary_color || "#10B981";

  // Apply CSS custom properties for white-label branding
  useEffect(() => {
    const root = document.documentElement;
    // Convert hex to HSL-ish for the admin portal scope
    root.style.setProperty("--admin-primary", primaryColor);
    root.style.setProperty("--admin-secondary", secondaryColor);
    return () => {
      root.style.removeProperty("--admin-primary");
      root.style.removeProperty("--admin-secondary");
    };
  }, [primaryColor, secondaryColor]);

  return (
    <AdminContext.Provider
      value={{
        admin,
        isLoading,
        refetchAdmin: fetchAdmin,
        primaryColor,
        secondaryColor,
        logo: admin?.logo_url || null,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

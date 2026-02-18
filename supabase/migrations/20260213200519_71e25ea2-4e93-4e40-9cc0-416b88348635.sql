
-- Create admin service assignments table
CREATE TABLE public.admin_service_assignments (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID,
  UNIQUE(admin_id, service_id)
);

-- Enable RLS
ALTER TABLE public.admin_service_assignments ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
CREATE POLICY "Super admins can manage all service assignments"
  ON public.admin_service_assignments
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Admins can view their own assignments
CREATE POLICY "Admins can view own service assignments"
  ON public.admin_service_assignments
  FOR SELECT
  USING (admin_id = get_admin_id_for_user());

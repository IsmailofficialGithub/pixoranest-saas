
-- Service purchase requests from clients
CREATE TABLE public.service_purchase_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.service_plans(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  message TEXT,
  admin_id UUID NOT NULL REFERENCES public.admins(id),
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id, service_id, status)
);

-- Enable RLS
ALTER TABLE public.service_purchase_requests ENABLE ROW LEVEL SECURITY;

-- Clients can view their own requests
CREATE POLICY "Clients can view own requests"
ON public.service_purchase_requests
FOR SELECT
USING (client_id = (SELECT clients.id FROM clients WHERE clients.user_id = auth.uid()));

-- Clients can create requests
CREATE POLICY "Clients can create requests"
ON public.service_purchase_requests
FOR INSERT
WITH CHECK (client_id = (SELECT clients.id FROM clients WHERE clients.user_id = auth.uid()));

-- Admins can view their clients' requests
CREATE POLICY "Admins can view client requests"
ON public.service_purchase_requests
FOR SELECT
USING (admin_id = get_admin_id_for_user());

-- Admins can update (approve/reject) their clients' requests
CREATE POLICY "Admins can update client requests"
ON public.service_purchase_requests
FOR UPDATE
USING (admin_id = get_admin_id_for_user());

-- Super admins full access
CREATE POLICY "Super admins full access purchase requests"
ON public.service_purchase_requests
FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- Trigger for updated_at
CREATE TRIGGER update_service_purchase_requests_updated_at
BEFORE UPDATE ON public.service_purchase_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

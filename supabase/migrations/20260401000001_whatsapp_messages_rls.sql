-- 1. Add INSERT policy for whatsapp_messages to allow clients and accessed users to log messages
CREATE POLICY "Accessed users can insert messages for their bots" ON public.whatsapp_messages
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.whatsapp_user_access WHERE application_id = public.whatsapp_messages.application_id AND user_id = auth.uid())
  OR client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()) -- Owner clients can insert
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')) -- Admins can insert
);

-- 2. Add UPDATE policy for message status updates (e.g. for delivery receipts)
CREATE POLICY "Accessed users can update status of their messages" ON public.whatsapp_messages
FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.whatsapp_user_access WHERE application_id = public.whatsapp_messages.application_id AND user_id = auth.uid())
  OR client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.whatsapp_user_access WHERE application_id = public.whatsapp_messages.application_id AND user_id = auth.uid())
  OR client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
);

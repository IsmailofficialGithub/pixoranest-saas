
-- Create conversations table
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(admin_id, client_id)
);

-- Create message_type enum
CREATE TYPE public.message_type AS ENUM ('text', 'file', 'system');

-- Create messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  message_content TEXT NOT NULL,
  message_type public.message_type NOT NULL DEFAULT 'text',
  file_url TEXT,
  is_read BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Conversations RLS policies
CREATE POLICY "Admins can view own conversations"
  ON public.conversations FOR SELECT
  USING (admin_id = get_admin_id_for_user());

CREATE POLICY "Admins can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin') AND admin_id = get_admin_id_for_user());

CREATE POLICY "Admins can update own conversations"
  ON public.conversations FOR UPDATE
  USING (admin_id = get_admin_id_for_user());

CREATE POLICY "Clients can view own conversations"
  ON public.conversations FOR SELECT
  USING (client_id = (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE POLICY "Super admins full access conversations"
  ON public.conversations FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Messages RLS policies
CREATE POLICY "Users can view messages in their conversations"
  ON public.messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE admin_id = get_admin_id_for_user()
         OR client_id = (SELECT id FROM public.clients WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages in their conversations"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (
      SELECT id FROM public.conversations
      WHERE admin_id = get_admin_id_for_user()
         OR client_id = (SELECT id FROM public.clients WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can update messages they received"
  ON public.messages FOR UPDATE
  USING (receiver_id = auth.uid());

CREATE POLICY "Super admins full access messages"
  ON public.messages FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Create storage bucket for message attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('message-attachments', 'message-attachments', false);

CREATE POLICY "Users can upload message attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'message-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view message attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'message-attachments');

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

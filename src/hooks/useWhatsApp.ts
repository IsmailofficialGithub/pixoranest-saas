import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SendMessageOptions {
  to: string;
  message: string;
  type?: 'text' | 'template';
  templateName?: string;
  templateVariables?: string[];
  mediaUrl?: string;
}

export function useWhatsApp() {
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (options: SendMessageOptions) => {
    setIsSending(true);
    setError(null);

    try {
      const { data, error: sendError } = await supabase.functions.invoke(
        'send-whatsapp-message',
        { body: options }
      );

      if (sendError) throw sendError;
      return data;
    } catch (err: any) {
      const message = err.message || 'Failed to send message';
      setError(message);
      throw err;
    } finally {
      setIsSending(false);
    }
  };

  return { sendMessage, isSending, error };
}

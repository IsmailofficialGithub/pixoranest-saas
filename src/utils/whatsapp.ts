import { supabase } from "@/integrations/supabase/client";

const WHATSAPP_API_URL = import.meta.env.VITE_WHATSAPP_API_URL || "https://app.whapihub.com/api/v2/whatsapp-business/messages";
const DEFAULT_API_KEY = import.meta.env.VITE_WHATSAPP_API_KEY;

export interface SendWhatsAppMessageParams {
  to: string;
  phoneNoId: string;
  type: "text";
  text: string;
  application_id: string; // The ID of the bot in our database
}

/**
 * Sends a message via WhatsApp and logs it to our local database history.
 */
export async function sendWhatsAppMessage(params: SendWhatsAppMessageParams, apiKey?: string) {
  const token = apiKey || DEFAULT_API_KEY;
  if (!token) throw new Error("WhatsApp API Key is missing. Add it to .env or pass it as an argument.");

  try {
    // 1. Send the actual message through WhapiHub
    const response = await fetch(WHATSAPP_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: params.to,
        phoneNoId: params.phoneNoId,
        type: params.type,
        text: params.text,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result?.message || "Failed to send WhatsApp message");
    }

    // 2. Log the message to our Supabase database so the user can see it in "Bot History"
    const { error: dbError } = await (supabase.from("whatsapp_messages" as any) as any).insert({
      application_id: params.application_id,
      phone_number: params.to,
      message_content: params.text,
      message_type: params.type,
      status: "sent",
      whatsapp_message_id: result?.id || null, // WhapiHub returns an ID
      sent_at: new Date().toISOString(),
    });

    if (dbError) {
      console.warn("Message sent but failed to log in history:", dbError);
    }

    return result;
  } catch (error: any) {
    console.error("WhatsApp Send Error:", error);
    throw error;
  }
}

/**
 * Checks the real-time status of a message and updates our local database.
 */
export async function updateMessageStatus(messageId: string, dbMessageId: string, apiKey?: string) {
  const token = apiKey || DEFAULT_API_KEY;
  if (!token) return;

  try {
    const baseUrl = WHATSAPP_API_URL.replace("/messages", "/status/");
    const response = await fetch(`${baseUrl}${messageId}`, {
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      const status = data?.status || "sent";
      
      // Update our local DB status (delivered, read, failed, etc.)
      await (supabase.from("whatsapp_messages" as any) as any)
        .update({ status })
        .eq("id", dbMessageId);
        
      return status;
    }
  } catch (error) {
    console.error("Failed to update message status:", error);
  }
}

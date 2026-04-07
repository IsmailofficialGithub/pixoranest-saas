import { supabase } from "@/integrations/supabase/client";

const WHATSAPP_API_URL = import.meta.env.VITE_WHATSAPP_API_URL || "https://app.whapihub.com/api/v2/whatsapp-business/messages";
const DEFAULT_API_KEY = import.meta.env.VITE_WHATSAPP_API_KEY;

export interface SendWhatsAppMessageParams {
  to: string;
  body?: string;
  application_id: string; // The ID of the bot in our database
  phoneNoId?: string;
  baseUrl?: string;   // The customized Panel URL for the bot
  type?: string;      // "text" or "template"
  name?: string;      // template name
  language?: string;  // template language code
  bodyParams?: string[]; // template variables
  text?: string;
}

/**
 * Sends a message via WhatsApp and logs it to our local database history.
 */
export async function sendWhatsAppMessage(params: SendWhatsAppMessageParams, apiKey?: string) {
  const token = apiKey || DEFAULT_API_KEY;
  if (!token) throw new Error("WhatsApp API Key is missing. Add it to .env or pass it as an argument.");

  try {
    // 1. Determine the correct API URL
    let targetUrl = WHATSAPP_API_URL;
    if (params.baseUrl) {
      targetUrl = params.baseUrl;
      const suffix = "v2/whatsapp-business/messages";
      if (!targetUrl.includes(suffix)) {
        targetUrl = targetUrl.endsWith("/") ? targetUrl : targetUrl + "/";
        if (!targetUrl.includes("v2/")) targetUrl += "v2/";
        if (!targetUrl.includes("whatsapp-business/")) targetUrl += "whatsapp-business/";
        if (!targetUrl.includes("/messages")) targetUrl += "messages";
      }
    }

    // 2. Build the request body based on message type
    const requestBody: any = {
      to: params.to,
    };

    if (params.type === "template") {
      requestBody.type = "template";
      requestBody.name = params.name;
      requestBody.language = params.language || "en_US";
      requestBody.bodyParams = params.bodyParams || [];
    } else {
      requestBody.body = params.body ?? params.text;
    }

    if (params.phoneNoId) {
      requestBody.phone_number_id = params.phoneNoId;
      // Also used by some WhapiHub versions as 'phoneNoId'
      requestBody.phoneNoId = params.phoneNoId;
    }

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Authorization": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result?.message || result?.error || "Failed to send WhatsApp message");
    }

    // 2. Log the message to our Supabase database
    let logContent = params.body ?? params.text ?? "";
    if (params.type === "template") {
      logContent = `Template: ${params.name} | Variables: ${params.bodyParams?.join(", ") || "none"}`;
    }

    const { error: dbError } = await (supabase.from("whatsapp_messages" as any) as any).insert({
      application_id: params.application_id,
      phone_number: params.to,
      message_content: logContent,
      message_type: params.type || "text",
      template_name: params.name || null,
      status: "sent",
      whatsapp_message_id: result?.id || null,
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
        "Authorization": token,
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

/**
 * Fetches available message templates for a specific bot from the provider.
 */
export async function getWhatsAppTemplates(applicationId: string) {
  const { data: bot, error: botError } = await (supabase
    .from("whatsapp_applications" as any) as any)
    .select("api_config")
    .eq("id", applicationId)
    .single();

  if (botError || !bot) throw new Error("WhatsApp bot not found");
  const config = bot.api_config as any;
  const token = config?.api_key || DEFAULT_API_KEY;
  const panelUrl = config?.panel_url;

  if (!token) throw new Error("API Key is missing for this bot.");

  // For templates, we use the correct endpoint based on provider
  let targetUrl = panelUrl || WHATSAPP_API_URL;
  const isWhapi = targetUrl.includes("whapi");

  if (isWhapi) {
    // WhapiHub uses /settings/templates
    // We must clean the base URL if it already contains message-related paths
    let cleanBase = targetUrl.split("/v2/")[0].split("/whatsapp-business/")[0].split("/messages")[0];
    cleanBase = cleanBase.endsWith("/") ? cleanBase : cleanBase + "/";
    targetUrl = cleanBase + "settings/templates";
    // Whapi prefers Bearer token for settings (usually)
    // token = "Bearer " + token; 
  } else {
    // Standard Meta/Cloud API
    if (targetUrl.includes("/messages")) {
      targetUrl = targetUrl.replace("/messages", "/message-templates");
    } else {
      targetUrl = targetUrl.endsWith("/") ? targetUrl : targetUrl + "/";
      if (!targetUrl.includes("v2/")) targetUrl += "v2/";
      if (!targetUrl.includes("whatsapp-business/")) targetUrl += "whatsapp-business/";
      if (!targetUrl.includes("message-templates")) targetUrl += "message-templates";
    }
  }

  const response = await fetch(targetUrl, {
    method: "GET",
    headers: {
      "Authorization": token,
      "Content-Type": "application/json",
    },
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result?.message || result?.error || "Failed to fetch templates");

  return result.templates || result.data || [];
}

/**
 * Creates a new message template at the provider.
 */
export async function createWhatsAppTemplate(applicationId: string, templateData: any) {
  const { data: bot, error: botError } = await (supabase
    .from("whatsapp_applications" as any) as any)
    .select("api_config")
    .eq("id", applicationId)
    .single();

  if (botError || !bot) throw new Error("WhatsApp bot not found");
  const config = bot.api_config as any;
  const token = config?.api_key || DEFAULT_API_KEY;
  const panelUrl = config?.panel_url;

  // For templates, we use the correct endpoint based on provider
  let targetUrl = panelUrl || WHATSAPP_API_URL;
  const isWhapi = targetUrl.includes("whapi");

  if (isWhapi) {
    // WhapiHub uses /settings/templates
    // We must clean the base URL if it already contains message-related paths
    let cleanBase = targetUrl.split("/v2/")[0].split("/whatsapp-business/")[0].split("/messages")[0];
    cleanBase = cleanBase.endsWith("/") ? cleanBase : cleanBase + "/";
    targetUrl = cleanBase + "settings/templates";
  } else {
    // Standard Meta/Cloud API
    if (targetUrl.includes("/messages")) {
      targetUrl = targetUrl.replace("/messages", "/message-templates");
    } else if (!targetUrl.includes("message-templates")) {
      targetUrl = targetUrl.endsWith("/") ? targetUrl : targetUrl + "/";
      if (!targetUrl.includes("v2/")) targetUrl += "v2/";
      if (!targetUrl.includes("whatsapp-business/")) targetUrl += "whatsapp-business/";
      targetUrl += "message-templates";
    }
  }

  const response = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "Authorization": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(templateData),
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result?.message || result?.error || "Failed to create template");

  return result;
}

/**
 * Deletes a message from our local history.
 */
export async function deleteWhatsAppMessage(messageId: string) {
  const { error } = await (supabase
    .from("whatsapp_messages" as any) as any)
    .delete()
    .eq("id", messageId);

  if (error) throw error;
  return true;
}


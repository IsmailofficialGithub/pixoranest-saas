import { supabase } from "@/integrations/supabase/client";

export const WHATSAPP_API_URL = "https://app.whapihub.com/v2/whatsapp-business";
const DEFAULT_API_KEY = import.meta.env.VITE_WHATSAPP_API_KEY;

export interface SendWhatsAppMessageParams {
  to: string;
  text?: string;
  body?: string;
  type?: "text" | "template" | "image" | "video" | "document" | "audio";
  name?: string;
  language?: string;
  bodyParams?: string[];
  mediaUrl?: string;
  phoneNoId?: string;
  application_id: string;
  client_id?: string; // Optional for admin tests
  api_key?: string;
  baseUrl?: string;
}

/**
 * Sends a message via WhatsApp and logs it to our local database history.
 */
export async function sendWhatsAppMessage(params: SendWhatsAppMessageParams, apiKey?: string) {
  const token = apiKey || params.api_key || DEFAULT_API_KEY;
  if (!token) throw new Error("WhatsApp API Key is missing. Add it to .env or pass it as an argument.");
  try {
    // 1. Determine the correct API URL - ignore user-provided URL if it's likely wrong
    let targetUrl = WHATSAPP_API_URL;

    // In development, use the local proxy to avoid CORS
    if (import.meta.env.DEV) {
      targetUrl = targetUrl.replace("https://app.whapihub.com", "/whapi");
    }

    // Append the messages suffix
    targetUrl = targetUrl.endsWith("/") ? targetUrl + "messages" : targetUrl + "/messages";

    // 2. Build the request body based on message type
    const requestBody: any = {
      to: params.to.replace('+', ''),
      type: params.type || "text",
    };

    if (params.phoneNoId) {
      requestBody.phoneNoId = params.phoneNoId;
    }

    if (params.type === "template") {
      requestBody.name = params.name?.trim().toLowerCase();
      let lang = params.language || "en_US";

      // Normalize 'en' to 'en_US' as per user's common mistakes list
      if (lang === "en") lang = "en_US";
      requestBody.language = lang;

      // Only include bodyParams if they exist and have content
      if (params.bodyParams && params.bodyParams.length > 0) {
        requestBody.bodyParams = params.bodyParams;
      }

      // Handle Media Header Params (Image, Video, Audio, Document)
      if (params.mediaUrl) {
        requestBody.media = {
          link: params.mediaUrl
        };
      }
    } else if (params.type && ["image", "video", "audio", "document"].includes(params.type)) {
      requestBody.media = {
        link: params.mediaUrl || params.body || params.text
      };
      if (params.body || params.text) {
        requestBody.caption = params.body || params.text;
      }
    } else {
      // For text messages
      requestBody.body = params.body ?? params.text;
    }

    console.log("🚀 Sending WhatsApp Payload:", JSON.stringify(requestBody, null, 2));

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`, // Switched to Bearer format as per working curl
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();
    console.log("📥 WhatsApp API Response:", result);

    if (!response.ok) {
      throw new Error(result?.message || result?.error || "Failed to send WhatsApp message");
    }

    // 2. Log the message to our Supabase database (only if client_id is present)
    if (params.client_id) {
      let logContent = params.body ?? params.text ?? "";
      if (params.type === "template") {
        logContent = `Template: ${params.name} | Variables: ${params.bodyParams?.join(", ") || "none"}`;
      }

      const { error: dbError } = await (supabase.from("whatsapp_messages" as any) as any).insert({
        application_id: params.application_id,
        client_id: params.client_id,
        phone_number: params.to,
        message_content: logContent,
        message_type: params.type || "text",
        template_name: params.name || null,
        status: "sent",
        metadata: { whatsapp_message_id: result?.id || null },
        sent_at: new Date().toISOString(),
      });

      if (dbError) {
        console.warn("Message sent but failed to log in history:", dbError);
      }
    } else {
      console.log("Admin test message detected, skipping database log.");
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
        "Authorization": `Authorization ${token}`,
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
 * Fetches available message templates for a specific bot from our local database.
 */
export async function getWhatsAppTemplates(applicationId: string) {
  const { data, error } = await (supabase
    .from("whatsapp_templates" as any) as any)
    .select("*")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch templates:", error);
    throw new Error(error.message || "Failed to fetch templates from database");
  }

  return data || [];
}

/**
 * Creates a new message template on the real WhatsApp platform and saves to local database.
 */
export async function createWhatsAppTemplate(applicationId: string, templateData: any) {
  // 1. Fetch bot details to get API config
  const { data: bot, error: botError } = await (supabase
    .from("whatsapp_applications" as any) as any)
    .select("*")
    .eq("id", applicationId)
    .single();

  if (botError || !bot) throw new Error("WhatsApp bot not found");

  // 2. Call REAL API to create template on Meta/WhatsApp platform
  const token = bot.api_config.api_key;
  let targetUrl = WHATSAPP_API_URL;
  
  // In development, use the local proxy to avoid CORS
  if (import.meta.env.DEV) {
    targetUrl = targetUrl.replace("https://app.whapihub.com", "/whapi");
  }

  // Construct templates URL
  targetUrl = targetUrl.endsWith("/") ? targetUrl + "message_templates" : targetUrl + "/message_templates";

  const apiPayload = {
    name: templateData.name.trim().toLowerCase().replace(/\s+/g, '_'),
    category: templateData.category || 'MARKETING',
    language: templateData.language || 'en_US',
    components: templateData.components || []
  };

  console.log("📝 Creating Template on WhatsApp:", JSON.stringify(apiPayload, null, 2));

  const apiResponse = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(apiPayload),
  });

  const apiResult = await apiResponse.json();
  console.log("📥 Create Template Response:", apiResult);

  if (!apiResponse.ok) {
    throw new Error(apiResult?.message || apiResult?.error || "Failed to create template on WhatsApp platform");
  }

  // 3. Save to local database for history/caching
  // Get current user for attribution
  const { data: { user } } = await supabase.auth.getUser();

  const { data: client } = await (supabase
    .from("clients" as any) as any)
    .select("id")
    .eq("user_id", user?.id)
    .maybeSingle();

  const { data, error } = await (supabase
    .from("whatsapp_templates" as any) as any)
    .insert({
      application_id: applicationId,
      client_id: client?.id || null,
      name: templateData.name.trim().toLowerCase().replace(/\s+/g, '_'),
      category: templateData.category || 'MARKETING',
      language: templateData.language || 'en_US',
      components: templateData.components || [],
      status: 'pending', // New templates start as pending on WhatsApp
      created_by: user?.id
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create template:", error);
    throw new Error(error.message || "Failed to save template to database");
  }

  return data;
}

/**
 * Fetches templates from the real WhatsApp API and syncs them to our local database.
 */
export async function syncWhatsAppTemplates(applicationId: string) {
  const { data: bot, error: botError } = await (supabase
    .from("whatsapp_applications" as any) as any)
    .select("*")
    .eq("id", applicationId)
    .single();

  if (botError || !bot || !bot.api_config?.api_key) {
    throw new Error("Bot API configuration missing or invalid");
  }

  const token = bot.api_config.api_key;
  let targetUrl = WHATSAPP_API_URL;

  // In development, use the local proxy to avoid CORS
  if (import.meta.env.DEV) {
    targetUrl = targetUrl.replace("https://app.whapihub.com", "/whapi");
  }

  // Construct templates list URL
  targetUrl = targetUrl.endsWith("/") ? targetUrl + "templates" : targetUrl + "/templates";

  const response = await fetch(targetUrl, {
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err?.message || "Failed to fetch templates from WhatsApp API");
  }

  const result = await response.json();
  const externalTemplates = result?.templates || result?.data || [];

  console.log(`🔍 Found ${externalTemplates.length} templates from API`);

  // Get current user for attribution
  const { data: { user } } = await supabase.auth.getUser();

  // Find linked client
  const { data: client } = await (supabase
    .from("clients" as any) as any)
    .select("id")
    .eq("user_id", user?.id)
    .maybeSingle();

  // Update local DB (upsert based on name)
  for (const tpl of externalTemplates) {
    // Only sync approved templates to avoid draft errors
    const status = (tpl.status || "approved").toLowerCase();
    if (status !== 'approved' && status !== 'ready') continue;

    const tplName = (tpl.name || tpl.template_name || "").trim();
    if (!tplName) continue;

    const tplLang = (tpl.language || tpl.language_code || "en_US").trim();

    const { error: upsertError } = await (supabase.from("whatsapp_templates" as any) as any).upsert({
      application_id: applicationId,
      client_id: client?.id || null,
      name: tplName,
      category: tpl.category || 'MARKETING',
      language: tplLang, // Store exactly what the API says
      components: tpl.components || [],
      status: status,
      created_by: user?.id
    }, { onConflict: 'application_id,name' });

    if (upsertError) console.warn(`Failed to sync template ${tplName}:`, upsertError);
  }

  return externalTemplates;
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


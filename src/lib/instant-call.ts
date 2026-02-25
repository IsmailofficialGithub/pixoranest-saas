import { supabase } from "@/integrations/supabase/client";

/**
 * Initiates an instant call by triggering the n8n webhook.
 */
export const initiateInstantCall = async (phoneNumber: string, customerName: string, ownerUserId: string) => {
    // Use import.meta.env for Vite apps
    const webhookUrl = import.meta.env.VITE_N8N_OUTBOUND_CALL_WEBHOOK;

    if (!webhookUrl) {
        throw new Error("N8N Webhook URL is not configured. Please add VITE_N8N_OUTBOUND_CALL_WEBHOOK to your .env file.");
    }

    // Fetch the bot for this user to get provider IDs
    const { data, error: botError } = await (supabase as any)
        .from("outboundagents")
        .select("provider_agent_id, provider_from_number_id")
        .eq("owner_user_id", ownerUserId)
        .maybeSingle();

    if (botError) throw botError;
    const bot = data as any;
    if (!bot) throw new Error("No outbound agent assigned to your account.");

    const agentId = bot.provider_agent_id;
    const fromNumberId = bot.provider_from_number_id;

    if (!agentId || !fromNumberId) {
        throw new Error("Outbound agent is missing Provider Agent ID or From Number ID.");
    }

    const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify({
            agent_id: agentId,
            to_number: phoneNumber,
            from_number_id: fromNumberId,
            call_context: {
                customer_name: customerName || "Customer",
            }
        }),
    });

    if (!response.ok) {
        throw new Error(`Call request failed with status ${response.status}`);
    }

    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        return { success: true, message: text };
    }
};

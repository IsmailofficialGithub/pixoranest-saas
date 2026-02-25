/**
 * Initiates an instant call by triggering the n8n webhook.
 */
export const initiateInstantCall = async (phoneNumber: string, customerName: string) => {
    // Use import.meta.env for Vite apps
    const webhookUrl = import.meta.env.VITE_N8N_OUTBOUND_CALL_WEBHOOK;

    if (!webhookUrl) {
        throw new Error("N8N Webhook URL is not configured. Please add VITE_N8N_OUTBOUND_CALL_WEBHOOK to your .env file.");
    }

    const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify({
            agent_id: 102898,
            to_number: phoneNumber,
            from_number_id: 1721,
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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { campaign_id, client_id } = await req.json();

    if (!campaign_id || !client_id) {
      return new Response(
        JSON.stringify({ success: false, error: "campaign_id and client_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch campaign with contacts
    const { data: campaign, error: campaignError } = await supabaseUser
      .from("voice_campaigns")
      .select("*, campaign_contacts(*)")
      .eq("id", campaign_id)
      .single();

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ success: false, error: campaignError?.message || "Campaign not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the telecaller service id
    const { data: service } = await supabaseUser
      .from("services")
      .select("id")
      .eq("slug", "voice-telecaller")
      .single();

    if (!service) {
      return new Response(
        JSON.stringify({ success: false, error: "Voice Telecaller service not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch client's active workflow instance for telecaller
    const { data: workflowInstance, error: workflowError } = await supabaseUser
      .from("client_workflow_instances")
      .select("*")
      .eq("client_id", client_id)
      .eq("service_id", service.id)
      .eq("is_active", true)
      .maybeSingle();

    if (workflowError || !workflowInstance) {
      return new Response(
        JSON.stringify({ success: false, error: "No active workflow found for Voice Telecaller" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const webhookUrl = workflowInstance.webhook_url;

    if (!webhookUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "Webhook URL not configured for this workflow" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare payload for n8n
    const contacts = (campaign.campaign_contacts || []).map(
      (contact: { id: string; phone_number: string; contact_name: string | null; contact_data: unknown }) => ({
        id: contact.id,
        phone: contact.phone_number,
        name: contact.contact_name,
        data: contact.contact_data,
      })
    );

    const payload = {
      campaign_id: campaign.id,
      campaign_name: campaign.campaign_name,
      client_id,
      script: campaign.script,
      contacts,
      workflow_instance_id: workflowInstance.id,
    };

    // Trigger n8n workflow via webhook
    const n8nResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!n8nResponse.ok) {
      const errText = await n8nResponse.text();
      console.error("n8n webhook failed:", n8nResponse.status, errText);
      return new Response(
        JSON.stringify({ success: false, error: `n8n webhook failed: ${n8nResponse.statusText}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let n8nResult: unknown = null;
    try {
      n8nResult = await n8nResponse.json();
    } catch {
      n8nResult = await n8nResponse.text();
    }

    // Update campaign status to running
    await supabaseUser
      .from("voice_campaigns")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", campaign_id);

    // Audit log (use admin client to bypass RLS)
    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "campaign_started",
      entity_type: "voice_campaigns",
      entity_id: campaign_id,
      new_values: { status: "running" },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Campaign started successfully",
        campaign_id,
        n8n_response: n8nResult,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

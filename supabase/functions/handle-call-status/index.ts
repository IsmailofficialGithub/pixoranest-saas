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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload = await req.json();

    const {
      campaign_id,
      contact_id,
      phone_number,
      call_status,
      duration_seconds,
      recording_url,
      transcript,
      ai_summary,
      is_lead,
      lead_score,
      client_id,
      workflow_instance_id,
    } = payload;

    if (!client_id || !phone_number || !campaign_id) {
      return new Response(
        JSON.stringify({ success: false, error: "client_id, phone_number, and campaign_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get telecaller service id
    const { data: service } = await supabaseAdmin
      .from("services")
      .select("id")
      .eq("slug", "voice-telecaller")
      .maybeSingle();

    const serviceId = service?.id ?? null;

    // Insert call log
    const { data: callLog, error: callLogError } = await supabaseAdmin
      .from("call_logs")
      .insert({
        client_id,
        workflow_instance_id: workflow_instance_id ?? null,
        service_id: serviceId,
        call_type: "outbound",
        phone_number,
        status: call_status ?? "completed",
        duration_seconds: duration_seconds ?? 0,
        recording_url: recording_url ?? null,
        transcript: transcript ?? null,
        ai_summary: ai_summary ?? null,
        executed_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (callLogError) {
      console.error("Call log insert error:", callLogError);
      return new Response(
        JSON.stringify({ success: false, error: callLogError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update campaign contact if contact_id provided
    if (contact_id) {
      await supabaseAdmin
        .from("campaign_contacts")
        .update({
          call_status: call_status ?? "completed",
          call_log_id: callLog.id,
        })
        .eq("id", contact_id);
    }

    // Update campaign progress
    const { data: campaign } = await supabaseAdmin
      .from("voice_campaigns")
      .select("contacts_called, contacts_answered, total_contacts")
      .eq("id", campaign_id)
      .single();

    if (campaign) {
      const newContactsCalled = (campaign.contacts_called || 0) + 1;
      const newAnswered =
        call_status === "answered" || call_status === "completed"
          ? (campaign.contacts_answered || 0) + 1
          : campaign.contacts_answered || 0;
      const isCompleted = newContactsCalled >= (campaign.total_contacts || 0);

      await supabaseAdmin
        .from("voice_campaigns")
        .update({
          contacts_called: newContactsCalled,
          contacts_answered: newAnswered,
          status: isCompleted ? "completed" : "running",
          completed_at: isCompleted ? new Date().toISOString() : null,
        })
        .eq("id", campaign_id);

      // Send completion notification
      if (isCompleted) {
        // Get client user_id for notification
        const { data: client } = await supabaseAdmin
          .from("clients")
          .select("user_id")
          .eq("id", client_id)
          .single();

        if (client) {
          await supabaseAdmin.from("notifications").insert({
            user_id: client.user_id,
            title: "Campaign Completed",
            message: `Your campaign has finished. ${newContactsCalled} contacts called.`,
            type: "success",
            action_url: "/client/voice-telecaller",
          });
        }
      }
    }

    // Create lead if detected
    if (is_lead) {
      await supabaseAdmin.from("leads").insert({
        client_id,
        call_log_id: callLog.id,
        campaign_id,
        lead_source: "telecaller",
        phone: phone_number,
        lead_score: lead_score ?? 50,
        status: "new",
        notes: ai_summary ?? null,
      });

      // Notify client about new lead
      const { data: client } = await supabaseAdmin
        .from("clients")
        .select("user_id")
        .eq("id", client_id)
        .single();

      if (client) {
        await supabaseAdmin.from("notifications").insert({
          user_id: client.user_id,
          title: "New Lead Captured",
          message: `A lead was captured from your campaign. Score: ${lead_score ?? 50}/100`,
          type: "success",
          action_url: "/client/leads",
        });
      }
    }

    // Track usage
    await supabaseAdmin.from("usage_tracking").insert({
      client_id,
      service_id: serviceId,
      usage_type: "outbound_call",
      quantity: 1,
      metadata: { campaign_id, call_status, duration_seconds },
    });

    // Increment client service usage
    await supabaseAdmin.rpc("increment_usage", {
      p_client_id: client_id,
      p_service_slug: "voice-telecaller",
      p_amount: 1,
    });

    return new Response(
      JSON.stringify({ success: true, call_log_id: callLog.id }),
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

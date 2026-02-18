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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Verify super_admin role
    const { data: roleCheck } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { client_id, service_id } = await req.json();

    if (!client_id || !service_id) {
      return new Response(JSON.stringify({ error: "client_id and service_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get service info
    const { data: service, error: serviceErr } = await supabaseAdmin
      .from("services")
      .select("name, slug")
      .eq("id", service_id)
      .single();

    if (serviceErr || !service) {
      return new Response(JSON.stringify({ error: "Service not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if workflow already exists
    const { data: existing } = await supabaseAdmin
      .from("client_workflow_instances")
      .select("id")
      .eq("client_id", client_id)
      .eq("service_id", service_id)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: "Workflow already exists for this service" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for a workflow template
    const { data: template } = await supabaseAdmin
      .from("workflow_templates")
      .select("*")
      .eq("service_id", service_id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Create workflow instance
    const workflowData: Record<string, unknown> = {
      client_id,
      service_id,
      workflow_name: `${service.name} - Workflow`,
      n8n_workflow_id: `placeholder_${Date.now()}`,
      status: "pending",
      is_active: false,
      created_by: userId,
      custom_config: template?.default_config ?? {},
    };

    if (template) {
      workflowData.workflow_template_id = template.id;
    }

    const { data: instance, error: insertErr } = await supabaseAdmin
      .from("client_workflow_instances")
      .insert(workflowData)
      .select()
      .single();

    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create credential entries if template has required_credentials
    if (template?.required_credentials && template.required_credentials.length > 0) {
      const credentialInserts = template.required_credentials.map((cred: string) => ({
        client_workflow_instance_id: instance.id,
        credential_name: cred,
        credential_type: cred,
        credential_status: "pending",
      }));

      await supabaseAdmin.from("client_workflow_credentials").insert(credentialInserts);
    }

    return new Response(JSON.stringify({ success: true, workflow: instance }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

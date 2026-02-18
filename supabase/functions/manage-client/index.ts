import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generatePassword(length = 14): string {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const special = "!@#$%^&*";
  const all = upper + lower + digits + special;
  let pw = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
  ];
  for (let i = pw.length; i < length; i++) {
    pw.push(all[Math.floor(Math.random() * all.length)]);
  }
  for (let i = pw.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pw[i], pw[j]] = [pw[j], pw[i]];
  }
  return pw.join("");
}

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerUserId = claimsData.claims.sub as string;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is an admin
    const { data: roleCheck } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUserId)
      .in("role", ["admin", "super_admin"])
      .limit(1)
      .single();

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get admin_id for the caller
    const { data: adminRecord } = await adminClient
      .from("admins")
      .select("id")
      .eq("user_id", callerUserId)
      .single();

    if (!adminRecord) {
      return new Response(JSON.stringify({ error: "Admin record not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminId = adminRecord.id;
    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const {
        email,
        full_name,
        phone,
        company_name,
        industry,
        company_size,
        allow_admin_raw_access,
        password,
        auto_generate_password,
      } = body;

      if (!email || !full_name || !company_name) {
        return new Response(
          JSON.stringify({ error: "Email, contact name, and company name are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const finalPassword = auto_generate_password !== false ? generatePassword() : password;
      if (!finalPassword || finalPassword.length < 8) {
        return new Response(
          JSON.stringify({ error: "Password must be at least 8 characters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create auth user
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password: finalPassword,
        email_confirm: true,
        user_metadata: { full_name, role: "client", created_by_admin: adminId },
      });

      if (authError) {
        const msg = authError.message.includes("already been registered")
          ? "A user with this email already exists"
          : authError.message;
        return new Response(JSON.stringify({ error: msg }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userId = authData.user.id;

      // Insert profile
      await adminClient.from("profiles").upsert({
        user_id: userId,
        email,
        full_name,
        phone: phone || null,
        is_active: true,
      }, { onConflict: "user_id" });

      // Insert user role
      await adminClient.from("user_roles").insert({
        user_id: userId,
        role: "client",
      });

      // Insert client record
      const { error: clientError } = await adminClient.from("clients").insert({
        user_id: userId,
        admin_id: adminId,
        company_name,
        industry: industry || null,
        company_size: company_size || null,
        allow_admin_raw_access: allow_admin_raw_access || false,
        onboarded_at: new Date().toISOString(),
      });

      if (clientError) {
        await adminClient.auth.admin.deleteUser(userId);
        return new Response(JSON.stringify({ error: clientError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get the client id
      const { data: newClient } = await adminClient
        .from("clients")
        .select("id")
        .eq("user_id", userId)
        .single();

      return new Response(
        JSON.stringify({
          success: true,
          message: "Client created successfully",
          user_id: userId,
          client_id: newClient?.id,
          generated_password: auto_generate_password !== false ? finalPassword : undefined,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update") {
      const { client_id, full_name, phone, company_name, industry, company_size, allow_admin_raw_access } = body;

      if (!client_id) {
        return new Response(JSON.stringify({ error: "Client ID is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify this client belongs to the admin
      const { data: client } = await adminClient
        .from("clients")
        .select("user_id, admin_id")
        .eq("id", client_id)
        .single();

      if (!client || client.admin_id !== adminId) {
        return new Response(JSON.stringify({ error: "Client not found or access denied" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update client record
      await adminClient
        .from("clients")
        .update({
          company_name,
          industry: industry || null,
          company_size: company_size || null,
          allow_admin_raw_access: allow_admin_raw_access || false,
        })
        .eq("id", client_id);

      // Update profile
      await adminClient
        .from("profiles")
        .update({
          full_name,
          phone: phone || null,
        })
        .eq("user_id", client.user_id);

      return new Response(
        JSON.stringify({ success: true, message: "Client updated successfully" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

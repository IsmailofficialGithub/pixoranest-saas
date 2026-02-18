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
  // shuffle
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
    // Verify the caller is a super_admin
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

    // Verify caller with anon client
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
    const callerUserId = claimsData.claims.sub;

    // Use service role client for admin operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is super_admin
    const { data: roleCheck } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUserId)
      .eq("role", "super_admin")
      .single();

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Forbidden: Super admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const {
        email,
        full_name,
        phone,
        company_name,
        company_website,
        commission_rate,
        password,
        auto_generate_password,
      } = body;

      // Validate required fields
      if (!email || !full_name || !company_name) {
        return new Response(
          JSON.stringify({ error: "Email, full name, and company name are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const finalPassword = auto_generate_password ? generatePassword() : password;
      if (!finalPassword || finalPassword.length < 8) {
        return new Response(
          JSON.stringify({ error: "Password must be at least 8 characters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Step 1: Create auth user
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password: finalPassword,
        email_confirm: true,
        user_metadata: { full_name, role: "admin" },
      });

      if (authError) {
        const msg = authError.message.includes("already been registered")
          ? "This email is already registered"
          : authError.message;
        return new Response(JSON.stringify({ error: msg }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userId = authData.user.id;

      // Step 2: Insert profile (trigger may have created it, so upsert)
      await adminClient.from("profiles").upsert({
        user_id: userId,
        email,
        full_name,
        phone: phone || null,
        is_active: true,
      }, { onConflict: "user_id" });

      // Step 3: Insert user role
      await adminClient.from("user_roles").insert({
        user_id: userId,
        role: "admin",
      });

      // Step 4: Insert admin record
      const { error: adminError } = await adminClient.from("admins").insert({
        user_id: userId,
        company_name,
        company_website: company_website || null,
        commission_rate: commission_rate ?? 20,
        created_by: callerUserId,
      });

      if (adminError) {
        // Cleanup: delete the auth user if admin insert fails
        await adminClient.auth.admin.deleteUser(userId);
        return new Response(JSON.stringify({ error: adminError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Admin created successfully`,
          user_id: userId,
          generated_password: auto_generate_password ? finalPassword : undefined,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update") {
      const { admin_id, full_name, phone, company_name, company_website, commission_rate } = body;

      if (!admin_id) {
        return new Response(JSON.stringify({ error: "Admin ID is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get admin's user_id
      const { data: admin } = await adminClient
        .from("admins")
        .select("user_id")
        .eq("id", admin_id)
        .single();

      if (!admin) {
        return new Response(JSON.stringify({ error: "Admin not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update admins table
      const { error: adminError } = await adminClient
        .from("admins")
        .update({
          company_name,
          company_website: company_website || null,
          commission_rate: commission_rate ?? 20,
        })
        .eq("id", admin_id);

      if (adminError) {
        return new Response(JSON.stringify({ error: adminError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update profile
      await adminClient
        .from("profiles")
        .update({
          full_name,
          phone: phone || null,
        })
        .eq("user_id", admin.user_id);

      return new Response(
        JSON.stringify({ success: true, message: "Admin updated successfully" }),
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

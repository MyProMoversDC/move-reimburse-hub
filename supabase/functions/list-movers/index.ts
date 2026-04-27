import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sharedKey = Deno.env.get("WORKERS_SHARED_API_KEY");
    if (!sharedKey) {
      return new Response(
        JSON.stringify({ error: "Server not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const providedKey =
      req.headers.get("x-api-key") ||
      req.headers.get("X-API-Key") ||
      "";

    if (providedKey !== sharedKey) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get all users that have the "mover" role
    const { data: roleRows, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "mover");

    if (rolesError) throw rolesError;

    const moverIds = (roleRows ?? []).map((r: any) => r.user_id);
    if (moverIds.length === 0) {
      return new Response(
        JSON.stringify({ workers: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email, phone, signup_status")
      .in("id", moverIds);

    if (profilesError) throw profilesError;

    const workers = (profiles ?? []).map((p: any) => ({
      external_id: p.id,
      name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
      first_name: p.first_name ?? "",
      last_name: p.last_name ?? "",
      email: p.email ?? "",
      phone: p.phone ?? "",
      is_active: p.signup_status === "approved",
    }));

    return new Response(
      JSON.stringify({ workers, synced_at: new Date().toISOString() }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("list-movers error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

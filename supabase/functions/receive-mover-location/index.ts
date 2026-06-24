// Authenticated mover writes a GPS ping into mover_location_pings.
// Uses the caller's JWT; RLS enforces auth.uid() = user_id on insert.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Ping {
  lat: number;
  lng: number;
  accuracy_m?: number | null;
  inv_job_order_id?: string | null;
  crew_id?: string | null;
  recorded_at?: string;
}

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const client = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await client.auth.getUser();
    if (!u?.user) return json({ error: "Unauthorized" }, 401);

    const body = (await req.json().catch(() => null)) as Ping | null;
    if (!body || typeof body.lat !== "number" || typeof body.lng !== "number") {
      return json({ error: "lat and lng are required numbers" }, 400);
    }

    const { error } = await client.from("mover_location_pings").insert({
      user_id: u.user.id,
      lat: body.lat,
      lng: body.lng,
      accuracy_m: body.accuracy_m ?? null,
      inv_job_order_id: body.inv_job_order_id ?? null,
      crew_id: body.crew_id ?? null,
      recorded_at: body.recorded_at ?? new Date().toISOString(),
    });
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});

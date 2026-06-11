import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Runs on the 1st of each month at 00:05 EST (05:05 UTC during EST / 04:05 UTC during EDT)
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Previous month range in UTC (approximation; awarded once per month)
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    // All movers
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "mover");
    const moverIds: string[] = (roles ?? []).map((r: any) => r.user_id);

    let awarded = 0;
    for (const moverId of moverIds) {
      const { data: events } = await supabase
        .from("mover_rating_events")
        .select("event_type, delta")
        .eq("mover_id", moverId)
        .gte("created_at", monthStart.toISOString())
        .lt("created_at", monthEnd.toISOString());

      const list = events ?? [];
      const hasNegative = list.some((e: any) => e.delta < 0);
      const hadMissedAlcohol = list.some((e: any) => e.event_type === "alcohol_test_missed");
      const hadDocsOverdue = list.some((e: any) => e.event_type === "compliance_docs_overdue");

      const toAward: Array<{ event: string; reason: string }> = [];
      if (!hasNegative) toAward.push({ event: "perfect_month", reason: "Perfect month — no negative events" });
      if (!hadMissedAlcohol) toAward.push({ event: "alcohol_compliance_monthly", reason: "Alcohol compliance maintained for the month" });
      if (!hadDocsOverdue) toAward.push({ event: "docs_on_time", reason: "All compliance documents kept on time" });

      for (const a of toAward) {
        await supabase.rpc("apply_rating_event", {
          _mover_id: moverId,
          _event_type: a.event,
          _delta: 2,
          _reason: a.reason,
          _source_id: null,
          _source_table: "monthly_bonus_cron",
          _created_by: null,
        });
        awarded++;
      }
    }

    return new Response(JSON.stringify({ success: true, awarded, movers: moverIds.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("calculate-monthly-rating-bonuses error", e);
    return new Response(JSON.stringify({ error: e?.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

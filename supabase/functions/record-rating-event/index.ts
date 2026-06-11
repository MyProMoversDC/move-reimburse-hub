import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DELTAS: Record<string, number> = {
  misconduct_filed: -5,
  misconduct_confirmed: -8,
  violence_incident: -10,
  alcohol_test_failed: -4,
  alcohol_test_missed: -3,
  reimbursement_declined: -1,
  customer_refund_fault: -3,
  compliance_docs_overdue: -1,
  negative_review: -5,
  review_bonus_approved: 2,
  referral_approved: 2,
  perfect_month: 2,
  alcohol_compliance_monthly: 2,
  docs_on_time: 2,
  positive_feedback: 2,
};

const POSITIVE_MANUAL_EVENTS = new Set(["positive_feedback", "perfect_month", "alcohol_compliance_monthly", "docs_on_time"]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { mover_id, event_type, reason, source_id, source_table, manual } = body ?? {};
    if (!mover_id || !event_type) {
      return new Response(JSON.stringify({ error: "mover_id and event_type required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const delta = DELTAS[event_type];
    if (delta === undefined) {
      return new Response(JSON.stringify({ error: `Unknown event_type: ${event_type}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Permission check: must be admin (manual adjustments admin-only)
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = roles?.some((r: any) => r.role === "admin");
    const isHR = roles?.some((r: any) => r.role === "hr_manager");
    if (!isAdmin && !isHR) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (manual && !isAdmin) {
      return new Response(JSON.stringify({ error: "Only admins can create manual adjustments" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 30-day cap on positive manual adjustments
    if (manual && delta > 0 && POSITIVE_MANUAL_EVENTS.has(event_type)) {
      const { data: lastTs } = await admin.rpc("last_positive_manual_adjustment", { _mover_id: mover_id });
      if (lastTs) {
        const last = new Date(lastTs as string);
        const days = (Date.now() - last.getTime()) / (1000 * 60 * 60 * 24);
        if (days < 30) {
          return new Response(JSON.stringify({ error: `Only one positive manual adjustment allowed every 30 days. Try again in ${Math.ceil(30 - days)} day(s).` }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }

    const { data, error } = await admin.rpc("apply_rating_event", {
      _mover_id: mover_id,
      _event_type: event_type,
      _delta: delta,
      _reason: reason ?? null,
      _source_id: source_id ?? null,
      _source_table: manual ? "manual_adjustment" : (source_table ?? null),
      _created_by: user.id,
    });
    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;
    const newScore = result?.new_score ?? null;

    // Critical threshold notification
    if (newScore !== null && newScore <= 10) {
      try {
        await admin.functions.invoke("send-critical-score-alert", { body: { mover_id } });
      } catch (e) {
        console.error("critical alert invoke failed", e);
      }
    }

    return new Response(JSON.stringify({ success: true, ...result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("record-rating-event error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEmail } from "../_shared/emailLogger.ts";

const FROM_EMAIL = "MyProMovers <alerts@mypromoversreimbursements.com>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sanitize = (s: string) => (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { mover_id } = await req.json();
    if (!mover_id) return new Response(JSON.stringify({ error: "mover_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: profile } = await supabase.from("profiles").select("first_name, last_name, email").eq("id", mover_id).maybeSingle();
    const { data: rating } = await supabase.from("mover_ratings").select("score, stars").eq("mover_id", mover_id).maybeSingle();
    const { data: events } = await supabase.from("mover_rating_events").select("event_type, delta, reason, created_at").eq("mover_id", mover_id).order("created_at", { ascending: false }).limit(3);

    const fullName = `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim();

    // Recipients: admins + HR managers
    const { data: roleRows } = await supabase.from("user_roles").select("user_id, role").in("role", ["admin", "hr_manager"]);
    const userIds = (roleRows ?? []).map((r: any) => r.user_id);
    const { data: recipients } = await supabase.from("profiles").select("email").in("id", userIds);
    const toEmails = (recipients ?? []).map((r: any) => r.email).filter((e: string | null) => !!e);
    if (toEmails.length === 0) return new Response(JSON.stringify({ success: true, message: "no recipients" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const eventsHtml = (events ?? []).map((e: any) =>
      `<li><strong>${e.delta > 0 ? "+" : ""}${e.delta}</strong> ${sanitize(e.event_type)} — ${sanitize(e.reason ?? "")} (${new Date(e.created_at).toLocaleString("en-US", { timeZone: "America/New_York" })} EST)</li>`
    ).join("");

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2 style="color:#b91c1c;">Critical Performance Score Alert</h2>
        <p>The following mover has reached the minimum performance score threshold.</p>
        <p><strong>Mover:</strong> ${sanitize(fullName)}</p>
        <p><strong>Current Score:</strong> ${rating?.score ?? "?"} / 50 (${rating?.stars ?? ""} stars)</p>
        <h3>Last 3 Rating Events</h3>
        <ul>${eventsHtml || "<li>No recent events.</li>"}</ul>
        <p style="color:#6b7280; font-size:12px;">This is an automated alert from MyProMovers.</p>
      </div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "MyProMovers <alerts@mypromoversreimbursements.com>",
        to: toEmails,
        subject: `Critical Performance Score: ${fullName}`,
        html,
      }),
    });
    const result = await res.json();

    try {
      await logEmail(supabase, {
        recipients: toEmails,
        subject: `Critical Performance Score: ${fullName}`,
        type: "critical_score_alert",
        status: res.ok ? "sent" : "failed",
        resend_id: result?.id,
        error_message: res.ok ? null : JSON.stringify(result),
      });
    } catch (e) { console.error("logEmail failed", e); }

    // In-app mover notification
    await supabase.from("mover_notifications").insert({
      mover_id,
      title: "Performance score critical",
      message: "Your performance score has reached the minimum threshold. HR will contact you.",
      type: "critical_score",
    });

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("send-critical-score-alert error", e);
    return new Response(JSON.stringify({ error: e?.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

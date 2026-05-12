// Mover-facing endpoint. Updates their assignment status and reports to MovePro Inventory Hub.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Body {
  assignment_id: string;
  status: "confirmed" | "declined";
  decline_reason?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SHARED_KEY = Deno.env.get("WORKERS_SHARED_API_KEY");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = (await req.json()) as Body;
    if (!body?.assignment_id || !["confirmed", "declined"].includes(body.status)) {
      return json({ error: "Invalid payload" }, 400);
    }
    const declineReason = (body.decline_reason ?? "").trim();
    if (body.status === "declined" && !declineReason) {
      return json({ error: "Decline reason is required" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const responded_at = new Date().toISOString();

    const updatePayload: Record<string, unknown> = { status: body.status, responded_at };
    if (body.status === "declined") updatePayload.decline_reason = declineReason;
    else updatePayload.decline_reason = null;

    const { data: updated, error: upErr } = await admin
      .from("mover_job_assignments")
      .update(updatePayload)
      .eq("assignment_id", body.assignment_id)
      .eq("user_id", userId)
      .select("id, assignment_id")
      .maybeSingle();
    if (upErr) throw upErr;
    if (!updated) return json({ error: "Assignment not found for this user" }, 404);

    const { data: assignment } = await admin
      .from("job_assignments")
      .select("external_job_id, callback_url")
      .eq("id", body.assignment_id)
      .single();

    let callback: { ok: boolean; error?: string } = { ok: false };
    if (assignment && SHARED_KEY) {
      try {
        const resp = await fetch(assignment.callback_url, {
          method: "POST",
          headers: { "x-api-key": SHARED_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            external_job_id: assignment.external_job_id,
            external_user_id: userId,
            status: body.status,
            responded_at,
            decline_reason: body.status === "declined" ? declineReason : null,
          }),
        });
        const text = await resp.text();
        callback = { ok: resp.ok, error: resp.ok ? undefined : text.slice(0, 500) };
        if (!resp.ok) console.error("Callback failed", resp.status, text);
      } catch (e) {
        callback = { ok: false, error: String(e) };
        console.error("Callback exception", e);
      }
    } else if (!SHARED_KEY) {
      callback = { ok: false, error: "Shared key not configured" };
    }

    return json({ ok: true, status: body.status, callback });
  } catch (e) {
    console.error("confirm-job error", e);
    return json({ error: String(e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

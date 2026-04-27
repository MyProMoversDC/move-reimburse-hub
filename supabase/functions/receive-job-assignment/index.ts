// Public endpoint called by MovePro Inventory Hub when an admin assigns a crew.
// Authenticated by the shared WORKERS_SHARED_API_KEY (x-api-key header).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  external_job_id: string;
  job_number: string;
  client_name: string;
  service_date: string | null;
  move_size: string | null;
  scope_of_work: string | null;
  truck_number: string | null;
  mover_external_ids: string[];
  callback_url: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SHARED_KEY = Deno.env.get("WORKERS_SHARED_API_KEY");
    if (!SHARED_KEY) return json({ error: "Server not configured" }, 500);

    const provided = req.headers.get("x-api-key") || req.headers.get("X-API-Key") || "";
    if (provided !== SHARED_KEY) return json({ error: "Unauthorized" }, 401);

    const body = (await req.json()) as Body;
    if (
      !body?.external_job_id ||
      !body?.job_number ||
      !body?.callback_url ||
      !Array.isArray(body.mover_external_ids) ||
      body.mover_external_ids.length === 0
    ) {
      return json({ error: "Invalid payload" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: assignment, error: aErr } = await admin
      .from("job_assignments")
      .upsert(
        {
          external_job_id: body.external_job_id,
          job_number: body.job_number,
          client_name: body.client_name,
          service_date: body.service_date,
          move_size: body.move_size,
          scope_of_work: body.scope_of_work,
          truck_number: body.truck_number,
          callback_url: body.callback_url,
        },
        { onConflict: "external_job_id" }
      )
      .select("id")
      .single();
    if (aErr) throw aErr;

    const moverRows = body.mover_external_ids.map((uid) => ({
      assignment_id: assignment.id,
      user_id: uid,
      status: "pending",
    }));
    const { error: mErr } = await admin
      .from("mover_job_assignments")
      .upsert(moverRows, { onConflict: "assignment_id,user_id" });
    if (mErr) throw mErr;

    const notifications = body.mover_external_ids.map((uid) => ({
      user_id: uid,
      notification_type: "job_assignment",
      reference_type: "job_assignment",
      reference_id: assignment.id,
      title: "New job assigned",
      message: `Job #${body.job_number} for ${body.client_name}${
        body.service_date ? ` on ${body.service_date}` : ""
      }. Please review and confirm in My Jobs.`,
      is_read: false,
    }));
    await admin.from("mover_notifications").insert(notifications);

    return json({ ok: true, assignment_id: assignment.id, movers: moverRows.length });
  } catch (e) {
    console.error("receive-job-assignment error", e);
    return json({ error: String(e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

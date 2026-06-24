// Fetch Crew/Opportunity notes from SmartMoving for an inv_job_orders row.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SM_BASE = "https://api-public.smartmoving.com/v1";

function pickStr(o: any, ...keys: string[]): string | null {
  for (const k of keys) if (o && typeof o[k] === "string" && o[k].trim()) return o[k];
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SM_KEY = Deno.env.get("SMARTMOVING_API_KEY");
    const SM_CID = Deno.env.get("SMARTMOVING_CLIENT_ID");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!SM_KEY || !SM_CID) {
      return new Response(JSON.stringify({ error: "SmartMoving credentials missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const jobId: string | undefined = body.jobId;
    if (!jobId) {
      return new Response(JSON.stringify({ error: "jobId required" }), { status: 400, headers: corsHeaders });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: row } = await admin
      .from("inv_job_orders")
      .select("smartmoving_id, job_number")
      .eq("id", jobId)
      .maybeSingle();
    const smId = row?.smartmoving_id;
    if (!smId) {
      return new Response(JSON.stringify({ ok: true, notes: "", info: "Job not synced from SmartMoving." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers = {
      "x-api-key": SM_KEY,
      "x-client-id": SM_CID,
      ClientID: SM_CID,
      Accept: "application/json",
    };

    // Find opportunity for this job
    const jobRes = await fetch(`${SM_BASE}/api/jobs/${smId}?ClientID=${encodeURIComponent(SM_CID)}`, { headers });
    let oppId: string | null = null;
    if (jobRes.ok) {
      const jobJson = await jobRes.json().catch(() => null);
      oppId = String(jobJson?.opportunityId ?? jobJson?.OpportunityId ?? "") || null;
    }
    if (!oppId) {
      return new Response(JSON.stringify({ ok: true, notes: "", info: "Could not locate opportunity." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const oppRes = await fetch(
      `${SM_BASE}/api/opportunities/${oppId}?IncludeTripInfo=true&IncludeEstimates=true&IncludeNotes=true&ClientID=${encodeURIComponent(SM_CID)}`,
      { headers },
    );
    if (!oppRes.ok) {
      return new Response(JSON.stringify({ ok: true, notes: "", info: "Opportunity fetch failed." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const opp = await oppRes.json();

    const parts: string[] = [];
    const oppNote = pickStr(opp, "crewNotes", "CrewNotes", "opportunityNotes", "OpportunityNotes", "notes", "Notes");
    if (oppNote) parts.push(`[Opportunity Notes]\n${oppNote}`);
    for (const est of (opp?.estimates ?? opp?.Estimates ?? [])) {
      const crew = pickStr(est, "crewNotes", "CrewNotes");
      const internal = pickStr(est, "internalNotes", "InternalNotes");
      const collected: string[] = [];
      if (crew) collected.push(`Crew Notes: ${crew}`);
      if (internal) collected.push(`Internal Notes: ${internal}`);
      if (collected.length) parts.push(`[Estimate ${est?.id ?? ""}]\n${collected.join("\n")}`);
    }

    const notes = parts.join("\n\n").trim();
    return new Response(JSON.stringify({ ok: true, notes, opportunityId: oppId, info: notes ? "Crew notes loaded." : "No crew notes returned." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e instanceof Error ? e.message : e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

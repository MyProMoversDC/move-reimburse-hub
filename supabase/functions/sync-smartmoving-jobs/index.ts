// Pulls Booked-stage opportunities from SmartMoving and caches them in planning_jobs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SM_BASE = "https://api-public.smartmoving.com/v1";

function fmtDate(d: Date) { return d.toISOString().slice(0, 10); }
function toSmartMovingDate(v: string) { return v.replaceAll("-", ""); }

function toDate(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "number") {
    const s = String(v);
    if (/^\d{8}$/.test(s)) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
  }
  if (typeof v === "string") {
    const m = v.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const d = new Date(v);
    if (!isNaN(d.getTime())) return fmtDate(d);
  }
  return null;
}
function toIso(v: unknown): string | null {
  if (typeof v === "string") {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

const opportunityStatuses: Record<number, string> = {
  0: "New Lead", 1: "Lead In Progress", 3: "Opportunity", 4: "Booked",
  10: "Completed", 11: "Closed", 20: "Cancelled", 30: "Lost", 50: "Bad Lead",
};
const jobTypes: Record<number, string> = {
  1: "Moving", 3: "Packing", 4: "Moving & Packing", 5: "Load Only", 6: "Unload Only",
  7: "Commercial", 8: "Storage Inbound", 9: "Storage Outbound", 10: "Inner House",
  11: "Junk Removal", 12: "Labor Only",
};
function enumLabel(value: unknown, labels: Record<number, string>) {
  if (typeof value === "number") return labels[value] ?? String(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return labels[Number(value)] ?? value;
  return value ? String(value) : null;
}
function pick<T = unknown>(o: any, ...keys: string[]): T | undefined {
  for (const k of keys) if (o && o[k] !== undefined && o[k] !== null) return o[k] as T;
  return undefined;
}
function pickStr(o: any, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = o?.[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}
function extractMoveSize(opp: any, job: any): string | null {
  for (const src of [job, opp]) {
    if (!src) continue;
    const direct = pickStr(src, "moveSize","MoveSize","moveSizeName","MoveSizeName","size","Size","estimatedMoveSize","EstimatedMoveSize");
    if (direct) return direct;
    for (const k of ["moveSize","MoveSize","estimatedMoveSize","EstimatedMoveSize"]) {
      const obj = src[k];
      if (obj && typeof obj === "object") {
        const n = pickStr(obj,"name","Name","displayName","DisplayName");
        if (n) return n;
      }
    }
  }
  const ests = opp?.estimates ?? opp?.Estimates ?? [];
  for (const e of ests) {
    const d = pickStr(e,"moveSize","MoveSize","moveSizeName","MoveSizeName");
    if (d) return d;
    for (const k of ["moveSize","MoveSize"]) {
      const obj = e?.[k];
      if (obj && typeof obj === "object") {
        const n = pickStr(obj,"name","Name","displayName","DisplayName");
        if (n) return n;
      }
    }
  }
  return null;
}

async function fetchOppDetail(id: string, headers: Record<string,string>, cidQs: string) {
  try {
    const r = await fetch(`${SM_BASE}/api/opportunities/${id}?IncludeTripInfo=true&${cidQs}`, { headers });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}
async function mapConc<T,R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const w = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(w);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SM_KEY = Deno.env.get("SMARTMOVING_API_KEY");
    const SM_CID = Deno.env.get("SMARTMOVING_CLIENT_ID");
    if (!SM_KEY || !SM_CID) {
      return new Response(JSON.stringify({ error: "SmartMoving credentials missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const [adminRole, opsRole] = await Promise.all([
      admin.rpc("has_role", { _user_id: u.user.id, _role: "admin" }),
      admin.rpc("has_role", { _user_id: u.user.id, _role: "operations_manager" }),
    ]);
    if (!adminRole.data && !opsRole.data) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    let body: any = {};
    try { body = await req.json(); } catch { /* */ }
    const today = new Date(); today.setHours(0,0,0,0);
    const defTo = new Date(today); defTo.setDate(defTo.getDate() + 60);
    const fromDate = toDate(body.fromDate) ?? fmtDate(today);
    const toDateStr = toDate(body.toDate) ?? fmtDate(defTo);

    const { data: runRow } = await admin.from("planning_sync_runs").insert({
      triggered_by: u.user.id, from_date: fromDate, to_date: toDateStr, status: "running",
    }).select("id").single();
    const runId = runRow?.id;

    const headers = {
      "x-api-key": SM_KEY, "x-client-id": SM_CID, "ClientID": SM_CID,
      "Accept": "application/json", "Content-Type": "application/json",
    };

    const customers: any[] = [];
    let lastStatus = 0, lastBody = "";
    for (let page = 1; page <= 100; page++) {
      const params = new URLSearchParams({
        Page: String(page), PageSize: "200",
        FromServiceDate: toSmartMovingDate(fromDate),
        ToServiceDate: toSmartMovingDate(toDateStr),
        IncludeOpportunityInfo: "true",
      });
      const url = `${SM_BASE}/api/customers?${params.toString()}`;
      const r = await fetch(url, { headers });
      lastStatus = r.status;
      const text = await r.text();
      lastBody = text.slice(0, 600);
      if (!r.ok) break;
      let payload: any;
      try { payload = JSON.parse(text); } catch { break; }
      const items: any[] = Array.isArray(payload)
        ? payload
        : payload.pageResults ?? payload.results ?? payload.data ?? payload.items ?? payload.value ?? [];
      customers.push(...items);
      if (items.length < 200) break;
    }
    if (lastStatus < 200 || lastStatus >= 300) {
      const err = `SmartMoving API failed (${lastStatus}): ${lastBody}`;
      if (runId) await admin.from("planning_sync_runs").update({ status: "error", finished_at: new Date().toISOString(), error: err }).eq("id", runId);
      return new Response(JSON.stringify({ error: err }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Booked only
    const items: any[] = [];
    for (const c of customers) {
      const opps = c?.opportunities ?? c?.Opportunities ?? [];
      for (const o of opps) {
        const s = pick<number | string>(o, "status", "Status");
        const sn = typeof s === "string" && /^\d+$/.test(s) ? Number(s) : (typeof s === "number" ? s : null);
        const sl = typeof s === "string" ? s.toLowerCase() : null;
        if (!(sn === 4 || sl === "booked")) continue;
        const jobs = o?.jobs ?? o?.Jobs ?? [];
        for (const j of jobs) items.push({ customer: c, opportunity: o, job: j });
      }
    }

    if (items.length === 0) {
      if (runId) await admin.from("planning_sync_runs").update({ status: "success", finished_at: new Date().toISOString() }).eq("id", runId);
      return new Response(JSON.stringify({ success: true, fetched: 0, upserted: 0, fromDate, toDate: toDateStr }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cidQs = `ClientID=${encodeURIComponent(SM_CID)}`;
    const oppIds = Array.from(new Set(items.map(it => String(it.opportunity?.id ?? it.opportunity?.Id ?? "")).filter(Boolean)));
    const detailMap = new Map<string, any>();
    await mapConc(oppIds, 8, async (id) => {
      const d = await fetchOppDetail(id, headers, cidQs);
      if (d) detailMap.set(id, d);
    });

    const rows = items.map((it: any) => {
      const c = it.customer ?? {}, o = it.opportunity ?? {}, j = it.job ?? {};
      const id = String(pick(j, "id", "Id") ?? "");
      if (!id) return null;
      const customerName = (pick<string>(c, "name","fullName","Name","FullName")
        ?? [pick<string>(c,"firstName","FirstName"), pick<string>(c,"lastName","LastName")].filter(Boolean).join(" ")) || null;
      const serviceDate = toDate(pick(j, "serviceDate","ServiceDate","jobDate","JobDate","date","Date"));
      const start = toIso(pick(j, "startTimeUtc","StartTimeUtc","startTime","StartTime","scheduledStart","ScheduledStart"));
      const end = toIso(pick(j, "endTimeUtc","EndTimeUtc","endTime","EndTime","scheduledEnd","ScheduledEnd"));
      const statusV = pick<number | string>(o, "status","Status");
      const typeV = pick<number | string>(j, "type","Type","jobType","JobType","serviceType","ServiceType");
      return {
        smartmoving_id: id,
        job_number: String(pick(j,"jobNumber","JobNumber") ?? pick(o,"quoteNumber","QuoteNumber") ?? "") || null,
        customer_name: customerName,
        status: enumLabel(statusV, opportunityStatuses),
        job_type: enumLabel(typeV, jobTypes),
        branch_name: pickStr(o, "branchName","BranchName") ?? pickStr(c, "branchName","BranchName"),
        service_date: serviceDate,
        start_time: start,
        end_time: end,
        estimated_total: Number(pick(it,"estimatedTotal","EstimatedTotal","total","Total") ?? 0) || null,
        address: pick<string>(c, "address","Address") ?? null,
        move_size: extractMoveSize(detailMap.get(String(o?.id ?? o?.Id ?? "")) ?? o, j),
        raw: it,
        last_synced_at: new Date().toISOString(),
      };
    }).filter(Boolean) as any[];

    let upserted = 0;
    if (rows.length) {
      const { error: upErr, count } = await admin
        .from("planning_jobs")
        .upsert(rows, { onConflict: "smartmoving_id", count: "exact" });
      if (upErr) {
        const m = `Upsert failed: ${upErr.message}`;
        if (runId) await admin.from("planning_sync_runs").update({ status: "error", finished_at: new Date().toISOString(), error: m, fetched_count: items.length }).eq("id", runId);
        return new Response(JSON.stringify({ error: m }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      upserted = count ?? rows.length;
    }

    // Mirror booked jobs into inv_job_orders so Ops Manager can see and assign movers
    // directly from the Job Orders tab. Uniqueness is enforced on job_number.
    let jobOrdersUpserted = 0;
    const jobOrderRows = rows
      .filter((r: any) => r.job_number && r.service_date)
      .map((r: any) => ({
        job_number: r.job_number,
        client_name: r.customer_name || "SmartMoving customer",
        job_date: r.service_date,
        pickup_address: r.address ?? null,
        notes: r.move_size ? `Move size: ${r.move_size}` : null,
        status: "pending",
        smartmoving_id: r.smartmoving_id,
        planned_from_smartmoving_id: r.smartmoving_id,
        created_by: u.user.id,
      }));
    if (jobOrderRows.length) {
      const { error: joErr, count: joCount } = await admin
        .from("inv_job_orders")
        .upsert(jobOrderRows, { onConflict: "job_number", ignoreDuplicates: false, count: "exact" });
      if (joErr) {
        console.error("inv_job_orders upsert error:", joErr.message);
      } else {
        jobOrdersUpserted = joCount ?? jobOrderRows.length;
      }
    }


    if (runId) await admin.from("planning_sync_runs").update({
      status: "success", finished_at: new Date().toISOString(),
      fetched_count: items.length, upserted_count: upserted,
    }).eq("id", runId);

    return new Response(JSON.stringify({ success: true, fetched: items.length, upserted, job_orders_upserted: jobOrdersUpserted, fromDate, toDate: toDateStr }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

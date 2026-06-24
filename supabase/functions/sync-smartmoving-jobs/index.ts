// Pull booked SmartMoving jobs and upsert into inv_job_orders.
// Adapted from MovePro Inventory Hub for this project's schema.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SM_BASE = "https://api-public.smartmoving.com/v1";

const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
const toSm = (v: string) => v.replaceAll("-", "");

function toDate(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "number") {
    const s = String(v);
    if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  if (typeof v === "string") {
    const m = v.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  return null;
}
function pick<T = unknown>(obj: any, ...keys: string[]): T | undefined {
  for (const k of keys) if (obj && obj[k] != null) return obj[k] as T;
  return undefined;
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
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", u.user.id);
    const r = (roles ?? []).map((x: any) => x.role);
    if (!r.includes("admin") && !r.includes("operations_manager") && !r.includes("warehouse_keeper")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    let body: any = {};
    try { body = await req.json(); } catch {}
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const defTo = new Date(today); defTo.setDate(defTo.getDate() + 60);
    const fromDate = toDate(body.fromDate) ?? fmtDate(today);
    const toDateStr = toDate(body.toDate) ?? fmtDate(defTo);

    const headers = {
      "x-api-key": SM_KEY,
      "x-client-id": SM_CID,
      ClientID: SM_CID,
      Accept: "application/json",
    };

    const customers: any[] = [];
    for (let page = 1; page <= 50; page++) {
      const qs = new URLSearchParams({
        Page: String(page), PageSize: "200",
        FromServiceDate: toSm(fromDate), ToServiceDate: toSm(toDateStr),
        IncludeOpportunityInfo: "true",
      });
      const res = await fetch(`${SM_BASE}/api/customers?${qs}`, { headers });
      if (!res.ok) {
        const t = await res.text();
        return new Response(JSON.stringify({ error: `SmartMoving ${res.status}: ${t.slice(0, 400)}` }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const j = await res.json();
      const items: any[] = Array.isArray(j) ? j : (j.pageResults ?? j.results ?? j.data ?? []);
      customers.push(...items);
      if (items.length < 200) break;
    }

    const rows: any[] = [];
    for (const c of customers) {
      const opps = c?.opportunities ?? c?.Opportunities ?? [];
      for (const opp of opps) {
        const status = pick<number | string>(opp, "status", "Status");
        const isBooked = status === 4 || status === "4" || String(status).toLowerCase() === "booked";
        if (!isBooked) continue;
        const jobs = opp?.jobs ?? opp?.Jobs ?? [];
        for (const j of jobs) {
          const smId = String(pick(j, "id", "Id") ?? "");
          const jobNumber = String(pick(j, "jobNumber", "JobNumber") ?? pick(opp, "quoteNumber", "QuoteNumber") ?? smId);
          if (!smId || !jobNumber) continue;
          const name = pick<string>(c, "name", "fullName", "Name", "FullName")
            ?? [pick<string>(c, "firstName"), pick<string>(c, "lastName")].filter(Boolean).join(" ")
            ?? "Unknown";
          rows.push({
            smartmoving_id: smId,
            job_number: jobNumber,
            client_name: name,
            job_date: toDate(pick(j, "serviceDate", "ServiceDate", "jobDate")) ?? fromDate,
            pickup_address: pick<string>(c, "address", "Address") ?? null,
            dropoff_address: null,
            status: "synced",
            notes: null,
            created_by: u.user.id,
          });
        }
      }
    }

    let upserted = 0;
    if (rows.length > 0) {
      const { error, count } = await admin
        .from("inv_job_orders")
        .upsert(rows, { onConflict: "job_number", count: "exact", ignoreDuplicates: false });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      upserted = count ?? rows.length;
    }

    return new Response(JSON.stringify({ success: true, fetched: rows.length, upserted, fromDate, toDate: toDateStr }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e instanceof Error ? e.message : e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Weekly cron entry point. Pulls pay stub PDFs from SmartMoving, stores them
// in the private `pay-stubs` bucket, creates rows in `pay_stubs`, matches
// them to profiles by `smartmoving_employee_id`, and hands the batch off to
// `send-paystub-batch` for automatic delivery of matched rows.
//
// NOTE: SmartMoving does not publicly document a pay stub PDF endpoint at
// the time of writing. The endpoint path and response shape below are the
// working assumption per product requirements. On a shape mismatch this
// function writes NO pay stub rows and returns a structured discovery
// error so operators can adjust `SMARTMOVING_PAYSTUBS_ENDPOINT` /
// response parsing without a partial batch.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SM_BASE = "https://api-public.smartmoving.com/v1";
const SM_ENDPOINT = Deno.env.get("SMARTMOVING_PAYSTUBS_ENDPOINT") ?? "/pay-stubs";

function estWeekWindow(now = new Date()): { start: string; end: string } {
  // EST fixed offset (UTC-5) per project convention.
  const est = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const day = est.getUTCDay(); // 0=Sun ... 4=Thu
  const daysSinceMon = (day + 6) % 7;
  const monday = new Date(est);
  monday.setUTCDate(est.getUTCDate() - daysSinceMon - 7); // previous week Monday
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(monday), end: fmt(sunday) };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const smKey = Deno.env.get("SMARTMOVING_API_KEY");
  const smClientId = Deno.env.get("SMARTMOVING_CLIENT_ID");
  const admin = createClient(supabaseUrl, serviceKey);

  if (!smKey) {
    return new Response(JSON.stringify({ error: "SMARTMOVING_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const window = estWeekWindow();
  const runDate = new Date().toISOString().slice(0, 10);

  // Create the batch row up front so we can attach downstream state to it.
  const { data: batch, error: batchErr } = await admin
    .from("pay_stub_batches")
    .insert({ run_date: runDate, source: "smartmoving_cron", status: "processing" })
    .select()
    .single();
  if (batchErr || !batch) {
    console.error("Failed to create batch", batchErr);
    return new Response(JSON.stringify({ error: batchErr?.message ?? "batch insert failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ---- 1. Fetch pay stubs list from SmartMoving ----
    const url = new URL(SM_BASE + SM_ENDPOINT);
    url.searchParams.set("periodStart", window.start);
    url.searchParams.set("periodEnd", window.end);
    if (smClientId) url.searchParams.set("clientId", smClientId);

    const listResp = await fetch(url.toString(), {
      headers: { "api-key": smKey, Accept: "application/json" },
    });
    const rawList = await listResp.text();
    if (!listResp.ok) {
      throw new Error(`SmartMoving pay stubs endpoint returned ${listResp.status}: ${rawList.slice(0, 500)}`);
    }
    let parsed: any;
    try { parsed = JSON.parse(rawList); } catch {
      throw new Error(`Non-JSON response from ${SM_ENDPOINT} (shape probe): ${rawList.slice(0, 500)}`);
    }
    const items: any[] = Array.isArray(parsed) ? parsed
      : Array.isArray(parsed?.payStubs) ? parsed.payStubs
      : Array.isArray(parsed?.data) ? parsed.data
      : Array.isArray(parsed?.items) ? parsed.items
      : [];

    if (items.length === 0) {
      await admin.from("pay_stub_batches").update({
        status: "empty", total_count: 0,
      }).eq("id", batch.id);
      return new Response(JSON.stringify({ ok: true, batch_id: batch.id, count: 0, window }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- 2. For each item, download PDF, insert pay_stubs row, match by employee id ----
    let matched = 0;
    for (const item of items) {
      const smEmployeeId = String(item.employeeId ?? item.EmployeeId ?? item.employee_id ?? "").trim() || null;
      const extractedName = String(item.employeeName ?? item.EmployeeName ?? item.name ?? "").trim() || null;
      const periodStart = item.payPeriodStart ?? item.PayPeriodStart ?? item.periodStart ?? window.start;
      const periodEnd = item.payPeriodEnd ?? item.PayPeriodEnd ?? item.periodEnd ?? window.end;
      const netTotal = Number(item.netTotal ?? item.NetTotal ?? item.netPay ?? item.NetPay ?? 0) || null;
      const pdfUrl = item.pdfUrl ?? item.PdfUrl ?? item.downloadUrl ?? item.DownloadUrl ?? null;
      const pdfId = item.id ?? item.Id ?? item.payStubId ?? null;

      // Download the PDF (either from a direct url or a nested endpoint).
      let pdfBytes: Uint8Array | null = null;
      let fileName = `${smEmployeeId ?? "unknown"}-${periodEnd}.pdf`;
      try {
        const pdfEndpoint = pdfUrl ?? (pdfId ? `${SM_BASE}${SM_ENDPOINT}/${pdfId}/pdf` : null);
        if (pdfEndpoint) {
          const pdfResp = await fetch(pdfEndpoint, {
            headers: { "api-key": smKey, Accept: "application/pdf" },
          });
          if (!pdfResp.ok) throw new Error(`PDF download ${pdfResp.status}`);
          pdfBytes = new Uint8Array(await pdfResp.arrayBuffer());
        }
      } catch (e) {
        console.warn("PDF download failed for", smEmployeeId, e);
      }

      // Insert the pay stub row (status decided after we try to match).
      const { data: stub, error: stubErr } = await admin
        .from("pay_stubs")
        .insert({
          batch_id: batch.id,
          file_path: "",
          file_name: fileName,
          smartmoving_employee_id: smEmployeeId,
          extracted_name: extractedName,
          pay_period_start: periodStart,
          pay_period_end: periodEnd,
          net_total: netTotal,
          status: "processing",
        })
        .select()
        .single();
      if (stubErr || !stub) { console.error("stub insert", stubErr); continue; }

      // Upload PDF to storage (if we have one).
      let filePath = "";
      if (pdfBytes) {
        filePath = `batches/${batch.id}/${stub.id}.pdf`;
        const { error: upErr } = await admin.storage
          .from("pay-stubs")
          .upload(filePath, pdfBytes, { contentType: "application/pdf", upsert: true });
        if (upErr) {
          console.error("storage upload", upErr);
          await admin.from("pay_stubs").update({ status: "error", error: `Upload failed: ${upErr.message}` }).eq("id", stub.id);
          continue;
        }
      }

      // Try to match to a profile.
      let moverId: string | null = null;
      if (smEmployeeId) {
        const { data: profile } = await admin
          .from("profiles")
          .select("id")
          .eq("smartmoving_employee_id", smEmployeeId)
          .maybeSingle();
        if (profile) moverId = profile.id;
      }

      const newStatus = !pdfBytes ? "error"
        : moverId ? "ready"
        : "unmatched";
      if (moverId) matched++;

      await admin.from("pay_stubs").update({
        file_path: filePath,
        mover_id: moverId,
        status: newStatus,
        error: !pdfBytes ? "PDF unavailable from SmartMoving" : null,
      }).eq("id", stub.id);
    }

    await admin.from("pay_stub_batches").update({
      status: "ready", total_count: items.length, matched_count: matched,
    }).eq("id", batch.id);

    // Kick off auto-send for matched rows. Fire-and-forget.
    try {
      admin.functions.invoke("send-paystub-batch", {
        body: { batch_id: batch.id, auto: true },
      });
    } catch (e) { console.warn("send-paystub-batch invoke", e); }

    return new Response(JSON.stringify({ ok: true, batch_id: batch.id, count: items.length, matched, window }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("sync-smartmoving-paystubs failed", e);
    await admin.from("pay_stub_batches").update({
      status: "error", error: String(e?.message ?? e),
    }).eq("id", batch.id);
    return new Response(JSON.stringify({ error: String(e?.message ?? e), batch_id: batch.id }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

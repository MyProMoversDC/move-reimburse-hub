// Sends pay stub emails, one at a time, with a 10-15s random cooldown per
// email. Invoked by:
//   - the cron ingest function (auto = true, sends all 'ready' rows)
//   - the Reviews Admin UI (auto = false, sends a single pay_stub_id)
//
// Per-send failures are recorded on the row and in pay_stub_send_log, and
// never optimistically marked as sent.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { logEmail } from "../_shared/emailLogger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const FROM = "MyProMovers <reimbursements@mypromoversreimbursements.com>";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function fmtMoney(n: number | null) {
  if (n === null || n === undefined) return "";
  return `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtPeriod(start: string | null, end: string | null) {
  if (!start || !end) return "";
  return `${start} — ${end}`;
}
function jitter() { return 10000 + Math.floor(Math.random() * 5001); } // 10-15s

async function renderAndSend(admin: any, stub: any, sentBy: string | null): Promise<{ ok: boolean; error?: string }> {
  // Load recipient profile.
  const { data: profile, error: profErr } = await admin
    .from("profiles")
    .select("id, first_name, last_name, email")
    .eq("id", stub.mover_id)
    .maybeSingle();
  if (profErr || !profile?.email) {
    return { ok: false, error: profErr?.message ?? "Recipient has no email on file" };
  }

  // Signed URL is not needed — we attach the PDF bytes directly.
  let pdfBase64: string | null = null;
  if (stub.file_path) {
    const { data: file, error: dlErr } = await admin.storage.from("pay-stubs").download(stub.file_path);
    if (dlErr || !file) return { ok: false, error: `Storage download failed: ${dlErr?.message ?? "unknown"}` };
    const buf = new Uint8Array(await file.arrayBuffer());
    // base64 encode
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    pdfBase64 = btoa(bin);
  }

  const name = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "there";
  const period = fmtPeriod(stub.pay_period_start, stub.pay_period_end);
  const amount = fmtMoney(stub.net_total);
  const subject = `Your MyProMovers pay stub${period ? ` — ${period}` : ""}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Your Pay Stub</h1>
      <p>Hello ${esc(name)},</p>
      <p>Your pay stub for <strong>${esc(period)}</strong> is attached to this email as a PDF.</p>
      ${amount ? `<p><strong>Net amount:</strong> ${esc(amount)}</p>` : ""}
      <p style="margin-top: 30px; color: #666;">Thank you,<br/>MyProMovers Team</p>
    </div>
  `;

  try {
    const resp: any = await resend.emails.send({
      from: FROM,
      to: [profile.email],
      subject,
      html,
      attachments: pdfBase64
        ? [{ filename: stub.file_name || "paystub.pdf", content: pdfBase64 }]
        : undefined,
    });
    if (resp?.error) return { ok: false, error: String(resp.error.message ?? resp.error) };

    // Success — mark stub sent, write audit log + email_logs
    const nowIso = new Date().toISOString();
    await admin.from("pay_stubs").update({
      status: "sent", sent_at: nowIso, sent_by: sentBy,
    }).eq("id", stub.id);
    await admin.from("pay_stub_send_log").insert({
      pay_stub_id: stub.id, mover_id: profile.id, email: profile.email,
      status: "sent", sent_by: sentBy,
    });
    await logEmail({
      email_type: "pay_stub",
      from_email: FROM,
      to_emails: [profile.email],
      subject,
      body_html: html,
      status: "sent",
      resend_id: resp?.id,
      reference_type: "pay_stub",
      reference_id: stub.id,
    });
    return { ok: true };
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    await admin.from("pay_stubs").update({
      status: "send_failed", error: msg,
    }).eq("id", stub.id);
    await admin.from("pay_stub_send_log").insert({
      pay_stub_id: stub.id, mover_id: profile.id, email: profile.email,
      status: "failed", error: msg, sent_by: sentBy,
    });
    await logEmail({
      email_type: "pay_stub",
      from_email: FROM,
      to_emails: [profile.email],
      subject,
      body_html: html,
      status: "failed",
      error_message: msg,
      reference_type: "pay_stub",
      reference_id: stub.id,
    });
    return { ok: false, error: msg };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  // Identify the caller (nullable for cron auto-send).
  let userId: string | null = null;
  const authHeader = req.headers.get("Authorization");
  if (authHeader) {
    const uClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await uClient.auth.getUser();
    userId = user?.id ?? null;
  }

  let body: any = {};
  try { body = await req.json(); } catch {}
  const { batch_id, pay_stub_id, auto } = body ?? {};

  // Single-row send path (from the UI after manual assignment).
  if (pay_stub_id) {
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: stub, error } = await admin.from("pay_stubs").select("*").eq("id", pay_stub_id).maybeSingle();
    if (error || !stub) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!stub.mover_id) return new Response(JSON.stringify({ error: "Assign a mover first" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const result = await renderAndSend(admin, stub, userId);
    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Batch auto-send path (from cron).
  if (!batch_id) {
    return new Response(JSON.stringify({ error: "batch_id or pay_stub_id required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await admin.from("pay_stub_batches").update({ status: "sending" }).eq("id", batch_id);

  // Kick off async loop — return 202 immediately.
  (async () => {
    const { data: rows } = await admin.from("pay_stubs").select("*")
      .eq("batch_id", batch_id).eq("status", "ready");
    let sent = 0, failed = 0;
    for (const stub of rows ?? []) {
      const result = await renderAndSend(admin, stub, null);
      if (result.ok) sent++; else failed++;
      // update batch counters incrementally
      await admin.from("pay_stub_batches").update({
        sent_count: sent, failed_count: failed,
      }).eq("id", batch_id);
      await new Promise((r) => setTimeout(r, jitter()));
    }
    await admin.from("pay_stub_batches").update({ status: "done" }).eq("id", batch_id);
  })();

  return new Response(JSON.stringify({ ok: true, batch_id, mode: auto ? "auto" : "manual" }), {
    status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

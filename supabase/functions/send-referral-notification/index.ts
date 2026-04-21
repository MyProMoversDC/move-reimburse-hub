import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEmail } from "../_shared/emailLogger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = "notifications@mypromoversreimbursements.com";
const ADMIN_EMAILS = [
  "Daniel@mypromoversdc.com",
  "mark@mypromoversdc.com",
  "management@mypromovers.com",
];

function sanitize(str: string): string {
  return str.replace(/[<>&"']/g, (c) => {
    const map: Record<string, string> = { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" };
    return map[c] || c;
  });
}

async function sendEmail(to: string[], subject: string, html: string, emailType: string, referenceId?: string) {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });
    const data = await res.json();
    await logEmail({
      from_email: FROM_EMAIL,
      to_emails: to,
      subject,
      body_html: html,
      email_type: emailType,
      reference_id: referenceId,
      reference_type: "referral",
      status: res.ok ? "sent" : "failed",
      error_message: res.ok ? undefined : JSON.stringify(data),
      resend_id: data?.id,
    });
    return { ok: res.ok, data };
  } catch (err) {
    console.error("Email send error:", err);
    return { ok: false, error: err.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { type } = body;

    if (type === "new_referral") {
      const { referrerName, referredName, position, availableDate, contactPhone, contactEmail } = body;
      const subject = `New Referral Request from ${sanitize(referrerName)}`;
      const html = `
        <h2>New Referral Request</h2>
        <p><strong>Referrer:</strong> ${sanitize(referrerName)}</p>
        <p><strong>Referred Person:</strong> ${sanitize(referredName)}</p>
        <p><strong>Position:</strong> ${sanitize(position)}</p>
        <p><strong>Contact Phone:</strong> ${sanitize(contactPhone)}</p>
        <p><strong>Contact Email:</strong> ${sanitize(contactEmail || "N/A")}</p>
        <p><strong>Available Date:</strong> ${sanitize(availableDate)}</p>
        <p>Please log in to the Admin Portal to review this referral.</p>
      `;
      await sendEmail(ADMIN_EMAILS, subject, html, "referral_new");
    }

    if (type === "referral_approved") {
      const { referrerName, referredName, position, startDate, referrerId } = body;
      // Get referrer email
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("id", referrerId)
        .single();

      if (profile?.email) {
        const subject = `Your Referral for ${sanitize(referredName)} Has Been Approved`;
        const html = `
          <h2>Referral Approved</h2>
          <p>Your referral for <strong>${sanitize(referredName)}</strong> (${sanitize(position)}) has been approved.</p>
          <p><strong>Start Date:</strong> ${sanitize(startDate)}</p>
          <p>After 3 months of consecutive work (at least 40 hours/week), you will be eligible to claim your referral bonus ($300 for Helper, $500 for Driver).</p>
        `;
        await sendEmail([profile.email], subject, html, "referral_approved");
      }
    }

    if (type === "bonus_eligible") {
      const { referrerName, referredName, referrerId } = body;
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("id", referrerId)
        .single();

      if (profile?.email) {
        const subject = `Your Referral Bonus is Ready to Claim!`;
        const html = `
          <h2>Referral Bonus Available</h2>
          <p>Congratulations! Your referral for <strong>${sanitize(referredName)}</strong> has completed 3 months of work.</p>
          <p>You can now claim your referral bonus. Please log in to the Mover Portal and go to "Refer a Friend" to claim your reward.</p>
        `;
        await sendEmail([profile.email], subject, html, "referral_bonus_eligible");
      }
    }

    if (type === "bonus_claimed") {
      const { referrerName, referredName, position, bonusAmount } = body;
      const subject = `Referral Bonus Claim from ${sanitize(referrerName)}`;
      const html = `
        <h2>Referral Bonus Claim</h2>
        <p><strong>${sanitize(referrerName)}</strong> is claiming a referral bonus.</p>
        <p><strong>Referred Person:</strong> ${sanitize(referredName)}</p>
        <p><strong>Position:</strong> ${sanitize(position)}</p>
        <p><strong>Bonus Amount:</strong> $${bonusAmount}</p>
        <p>Please log in to the Admin Portal to approve this bonus.</p>
      `;
      await sendEmail(ADMIN_EMAILS, subject, html, "referral_bonus_claimed");
    }

    if (type === "bonus_paid") {
      const { referrerName, referredName, bonusAmount, referrerId } = body;
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("id", referrerId)
        .single();

      if (profile?.email) {
        const subject = `Your Referral Bonus of $${bonusAmount} Has Been Approved!`;
        const html = `
          <h2>Bonus Approved</h2>
          <p>Your referral bonus of <strong>$${bonusAmount}</strong> for referring <strong>${sanitize(referredName)}</strong> has been approved.</p>
        `;
        await sendEmail([profile.email], subject, html, "referral_bonus_paid");
      }
    }

    if (type === "hiring_declined") {
      const { referrerId, referrerName, referredName, note } = body;
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("id", referrerId)
        .single();

      if (profile?.email) {
        const subject = `Hiring Update for Your Referral — ${sanitize(referredName)}`;
        const noteSection = note
          ? `<p><strong>Admin Note:</strong> ${sanitize(note)}</p>`
          : "";
        const html = `
          <h2>Referral Hiring Update</h2>
          <p>We wanted to let you know that the hiring process for your referral <strong>${sanitize(referredName)}</strong> has been <strong>declined</strong>.</p>
          ${noteSection}
          <p>Thank you for your referral. Feel free to refer other candidates through the Mover Portal.</p>
        `;
        await sendEmail([profile.email], subject, html, "referral_hiring_declined");
      }
    }
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

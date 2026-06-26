import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEmail } from "../_shared/emailLogger.ts";

const RESET_URL = "https://mypromoversreimbursements.com/reset-password";
const FROM_EMAIL = "MyProMovers <notifications@mypromoversreimbursements.com>";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const isValidEmail = (value: unknown): value is string =>
  typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const successResponse = () =>
  new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const htmlEscape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rawEmail = body?.email;

    if (!isValidEmail(rawEmail)) {
      return new Response(JSON.stringify({ error: "Valid email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = rawEmail.trim().toLowerCase();
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY_1") || Deno.env.get("RESEND_API_KEY") || "";
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY") || "";

    if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !lovableApiKey) {
      throw new Error("Password reset email service is not configured");
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: RESET_URL,
      },
    });

    // Do not reveal whether an account exists for the submitted email address.
    if (error) {
      console.warn("Password reset link was not generated");
      return successResponse();
    }

    const actionLink = data?.properties?.action_link;
    if (!actionLink) {
      throw new Error("Password reset link was not created");
    }

    const resetLink = new URL(actionLink);
    resetLink.searchParams.set("redirect_to", RESET_URL);
    const safeLink = htmlEscape(resetLink.toString());

    const subject = "Reset your MyProMovers password";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111827; line-height: 1.6;">
        <h2 style="margin: 0 0 16px;">Reset your password</h2>
        <p>Use this secure password reset link for your MyProMovers account:</p>
        <p style="word-break: break-all;"><a href="${safeLink}" style="color: #2563eb;">${RESET_URL}</a></p>
        <p>If you did not request this reset, you can ignore this email.</p>
      </div>
    `;

    const emailResponse = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
        "X-Connection-Api-Key": resendApiKey,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject,
        html,
      }),
    });

    const emailResult = await emailResponse.json().catch(() => ({}));

    await logEmail({
      email_type: "password_reset",
      from_email: FROM_EMAIL,
      to_emails: [email],
      subject,
      body_html: html,
      status: emailResponse.ok ? "sent" : "failed",
      resend_id: emailResult?.id || null,
      error_message: emailResponse.ok ? undefined : JSON.stringify(emailResult),
      reference_type: "auth",
    });

    if (!emailResponse.ok) {
      throw new Error("Password reset email was not sent");
    }

    return successResponse();
  } catch (error) {
    console.error("send-password-reset failed:", error instanceof Error ? error.message : String(error));
    return new Response(JSON.stringify({ error: "Failed to send password reset email" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
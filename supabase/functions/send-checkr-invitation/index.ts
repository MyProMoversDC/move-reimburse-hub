import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { logEmail } from "../_shared/emailLogger.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const CHECKR_API_KEY = (Deno.env.get("CHECKR_API_KEY") || "").trim();
const CHECKR_API_URL = "https://api.checkr.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function respond(ok: boolean, payload: Record<string, unknown>, statusCode = 200): Response {
  return new Response(JSON.stringify({ ok, ...payload }), {
    status: statusCode,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return respond(false, { error: "Unauthorized" });
    }

    if (!CHECKR_API_KEY) {
      console.error("CHECKR_API_KEY is not set");
      return respond(false, { error: "Checkr API key is not configured" });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { userId } = await req.json();
    if (!userId) {
      return respond(false, { error: "Missing userId" });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return respond(false, { error: "User not found" });
    }

    // Check if already invited
    const { data: existing } = await supabaseAdmin
      .from("checkr_candidates")
      .select("id, status")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      return respond(false, { error: "User already sent to Checkr", status: existing.status });
    }

    // Step 1: Create Checkr candidate
    const checkrAuth = btoa(CHECKR_API_KEY + ":");
    console.log("Calling Checkr API to create candidate for:", profile.email);
    
    const candidateRes = await fetch(`${CHECKR_API_URL}/v1/candidates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${checkrAuth}`,
      },
      body: JSON.stringify({
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email,
        no_middle_name: true,
      }),
    });

    const candidateData = await candidateRes.json();
    if (!candidateRes.ok) {
      console.error("Checkr candidate creation failed:", candidateData);
      const isAuthError = candidateData?.error === "Bad authentication error";
      return respond(false, { 
        error: "Failed to create Checkr candidate",
        details: candidateData,
        hint: isAuthError
          ? "Check the Checkr secret API key and make sure it matches the correct environment: staging keys only work with api.checkr-staging.com, production keys work with api.checkr.com."
          : undefined,
        diagnostics: {
          error_stage: "checkr_candidate_creation",
          status_code: candidateRes.status,
        }
      });
    }

    // Step 2: Create Checkr invitation
    const invitationRes = await fetch(`${CHECKR_API_URL}/v1/invitations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${checkrAuth}`,
      },
      body: JSON.stringify({
        candidate_id: candidateData.id,
        package: "driver_pro",
      }),
    });

    const invitationData = await invitationRes.json();
    if (!invitationRes.ok) {
      console.error("Checkr invitation creation failed:", invitationData);
      return respond(false, { 
        error: "Failed to create Checkr invitation", 
        details: invitationData,
        diagnostics: {
          error_stage: "checkr_invitation_creation",
          status_code: invitationRes.status,
        }
      });
    }

    const invitationUrl = invitationData.invitation_url || invitationData.url;

    // Step 3: Save to database
    await supabaseAdmin.from("checkr_candidates").insert({
      user_id: userId,
      checkr_candidate_id: candidateData.id,
      invitation_id: invitationData.id,
      invitation_url: invitationUrl,
      status: "invited",
    });

    // Step 4: Send email to user with invitation link
    const sanitize = (v: string) => String(v || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fromEmail = "MyProMovers <notifications@mypromoversreimbursements.com>";
    const emailSubject = "Background Check Required - MyProMovers";
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Background Check Required</h2>
        <p>Hello ${sanitize(profile.first_name)},</p>
        <p>As part of the onboarding process at MyProMovers, we require a background check to be completed through Checkr.</p>
        <p>Please click the button below to complete your background check:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${invitationUrl}" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-size: 16px; display: inline-block;">
            Complete Background Check
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="color: #2563eb; font-size: 14px; word-break: break-all;">${invitationUrl}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px;">This is an automated message from MyProMovers.</p>
      </div>
    `;

    const emailResult = await resend.emails.send({
      from: fromEmail,
      to: [profile.email],
      subject: emailSubject,
      html: htmlContent,
    });

    await logEmail({
      from_email: fromEmail,
      to_emails: [profile.email],
      subject: emailSubject,
      body_html: htmlContent,
      email_type: "checkr_invitation",
      reference_id: userId,
      reference_type: "checkr_candidate",
      status: emailResult?.error ? "failed" : "sent",
      error_message: emailResult?.error?.message || null,
      resend_id: emailResult?.data?.id || null,
    });

    return respond(true, { success: true, invitationUrl });
  } catch (error) {
    console.error("Error in send-checkr-invitation:", error);
    return respond(false, { error: error.message });
  }
};

serve(handler);

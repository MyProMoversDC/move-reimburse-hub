import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEmail } from "../_shared/emailLogger.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConsentNotificationRequest {
  userId: string;
  documentUrl: string;
  documentName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const fromEmail = "MyProMovers <notifications@mypromoversreimbursements.com>";
  let toEmail = "";
  let subject = "Consent Document Signed - MyProMovers";

  try {
    // Get auth token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { userId, documentUrl, documentName }: ConsentNotificationRequest = await req.json();

    // Ensure user can only send notification for themselves
    if (userId !== user.id) {
      console.error("User ID mismatch");
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get user profile to get their email and name
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      console.error("Error fetching profile:", profileError);
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    toEmail = profile.email || user.email || "";
    
    if (!toEmail) {
      console.error("No email found for user");
      return new Response(
        JSON.stringify({ error: "No email address found" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const moverName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Mover";

    console.log("Sending consent notification to:", toEmail);

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
          <h2 style="color: #1a1a1a; margin-bottom: 20px;">Consent Document Signed</h2>
          
          <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6;">
            Dear <strong>${moverName}</strong>,
          </p>
          
          <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6;">
            Thank you for signing the Terms and Conditions document. This email confirms that you have successfully reviewed and signed the consent document.
          </p>
          
          <div style="margin: 20px 0; padding: 16px; background-color: #ffffff; border-left: 4px solid #3b82f6; border-radius: 4px;">
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #666;">Document Name:</p>
            <p style="margin: 0; font-size: 16px; font-weight: bold;">${documentName}</p>
          </div>
          
          <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6;">
            You can access the signed document using the link below:
          </p>
          
          <p style="margin: 0 0 24px 0; font-size: 14px; word-break: break-all;">
            <a href="${documentUrl}" style="color: #3b82f6;">${documentUrl}</a>
          </p>
          
          <p style="margin: 0; font-size: 14px; color: #666;">
            Please keep this email for your records.
          </p>
        </div>
        
        <p style="margin-top: 30px; color: #666;">Best regards,<br>MyProMovers Management</p>
      </div>
    `;

    const emailResponse = await resend.emails.send({
      from: fromEmail,
      to: [toEmail],
      subject,
      html: htmlContent,
    });

    console.log("Consent notification sent successfully:", emailResponse);

    // Log the email
    await logEmail({
      from_email: fromEmail,
      to_emails: [toEmail],
      subject,
      body_html: htmlContent,
      email_type: "consent_document_signed",
      status: "sent",
      resend_id: (emailResponse as any)?.data?.id || (emailResponse as any)?.id,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-consent-notification function:", error);

    await logEmail({
      from_email: fromEmail,
      to_emails: toEmail ? [toEmail] : [],
      subject,
      email_type: "consent_document_signed",
      status: "failed",
      error_message: error?.message || "Unknown error",
    });

    return new Response(
      JSON.stringify({ error: "Failed to send notification" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEmail } from "../_shared/emailLogger.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AdminNotificationRequest {
  moverName: string;
  moverEmail: string;
  documentName: string;
  signedAt: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const fromEmail = "MyProMovers <notifications@mypromoversreimbursements.com>";
  const toEmail = "Daniel@mypromoversdc.com";
  const subject = "Consent Document Signed by Mover - MyProMovers";

  try {
    const { moverName, moverEmail, documentName, signedAt }: AdminNotificationRequest = await req.json();

    console.log("Sending consent admin notification for mover:", moverName);

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
          <h2 style="color: #1a1a1a; margin-bottom: 20px;">Consent Document Signed</h2>
          
          <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6;">
            A mover has signed the Terms and Conditions document.
          </p>
          
          <div style="margin: 20px 0; padding: 16px; background-color: #ffffff; border-left: 4px solid #3b82f6; border-radius: 4px;">
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #666;">Mover Name:</p>
            <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: bold;">${moverName}</p>
            
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #666;">Mover Email:</p>
            <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: bold;">${moverEmail}</p>
            
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #666;">Document:</p>
            <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: bold;">${documentName}</p>
            
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #666;">Signed At (EST):</p>
            <p style="margin: 0; font-size: 16px; font-weight: bold;">${signedAt}</p>
          </div>
        </div>
        
        <p style="margin-top: 30px; color: #666;">Best regards,<br>MyProMovers System</p>
      </div>
    `;

    const emailResponse = await resend.emails.send({
      from: fromEmail,
      to: [toEmail],
      subject,
      html: htmlContent,
    });

    console.log("Admin consent notification sent successfully:", emailResponse);

    // Log the email
    await logEmail({
      from_email: fromEmail,
      to_emails: [toEmail],
      subject,
      body_html: htmlContent,
      email_type: "consent_document_admin_notification",
      status: "sent",
      resend_id: (emailResponse as any)?.data?.id || (emailResponse as any)?.id,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-consent-admin-notification function:", error);

    await logEmail({
      from_email: fromEmail,
      to_emails: [toEmail],
      subject,
      email_type: "consent_document_admin_notification",
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

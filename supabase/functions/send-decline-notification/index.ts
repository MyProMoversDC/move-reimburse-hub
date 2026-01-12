import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { z } from "https://esm.sh/zod@3.22.4";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEmail } from "../_shared/emailLogger.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const declineEmailSchema = z.object({
  reimbursementNumber: z.string().min(1).max(10),
  moverEmail: z.string().email().max(255),
  moverName: z.string().min(1).max(200),
  declineReason: z.string().min(1).max(1000),
});

// Sanitize string for HTML to prevent injection
const sanitizeHtml = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const fromEmail = "MyProMovers <reimbursements@mypromoversreimbursements.com>";
  let toEmails: string[] = [];
  let subject = 'Reimbursement Decline Notification';

  try {
    // Authorization check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
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

    // Verify user is admin
    const { data: roleData, error: roleError } = await supabaseClient
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    if (roleError || !roleData) {
      console.error("Role check failed:", roleError);
      return new Response(
        JSON.stringify({ error: "Forbidden - Admin access required" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const rawData = await req.json();
    
    // Validate input
    const validationResult = declineEmailSchema.safeParse(rawData);
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error);
      return new Response(
        JSON.stringify({ error: "Invalid input data", details: validationResult.error.issues }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    const data = validationResult.data;
    toEmails = [data.moverEmail];
    
    // Sanitize all user-provided content for HTML
    const safeReimbursementNumber = sanitizeHtml(data.reimbursementNumber);
    const safeMoverName = sanitizeHtml(data.moverName);
    const safeDeclineReason = sanitizeHtml(data.declineReason);

    subject = `Reimbursement Request #${safeReimbursementNumber} Declined`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Reimbursement Request Declined</h1>
        <p>Hello ${safeMoverName},</p>
        <p>Your reimbursement request <strong>#${safeReimbursementNumber}</strong> has been declined.</p>
        
        <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #dc3545;">
          <p style="margin: 0;"><strong>Reason for Decline:</strong></p>
          <p style="margin: 10px 0 0 0;">${safeDeclineReason}</p>
        </div>
        
        <p style="margin-top: 20px;">If you have questions or would like to resubmit with corrections, please contact your administrator.</p>
        
        <p style="margin-top: 30px; color: #666;">Thank you,<br>MyProMovers Team</p>
      </div>
    `;

    console.log("Sending decline notification:", {
      reimbursementNumber: data.reimbursementNumber,
      moverEmail: data.moverEmail,
      moverName: data.moverName,
      adminId: user.id
    });

    const emailResponse = await resend.emails.send({
      from: fromEmail,
      to: toEmails,
      subject,
      html: htmlContent,
    });

    // Log the email
    await logEmail({
      from_email: fromEmail,
      to_emails: toEmails,
      subject,
      body_html: htmlContent,
      email_type: 'reimbursement_decline',
      reference_id: data.reimbursementNumber,
      reference_type: 'reimbursement',
      status: 'sent',
      resend_id: (emailResponse as any)?.data?.id || (emailResponse as any)?.id,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-decline-notification function:", error);
    
    await logEmail({
      from_email: fromEmail,
      to_emails: toEmails,
      subject,
      email_type: 'reimbursement_decline',
      reference_type: 'reimbursement',
      status: 'failed',
      error_message: error?.message || 'Unknown error',
    });

    return new Response(
      JSON.stringify({ error: "Failed to send notification" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

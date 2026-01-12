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
const confirmationEmailSchema = z.object({
  reimbursementNumber: z.string().min(1).max(10),
  reimbursementId: z.string().uuid(),
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
  const toEmails = ["mark@mypromoversdc.com", "Daniel@mypromoversdc.com"];
  let subject = 'Reimbursement Confirmation';

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
    const validationResult = confirmationEmailSchema.safeParse(rawData);
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error);
      return new Response(
        JSON.stringify({ error: "Invalid input data", details: validationResult.error.issues }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    const data = validationResult.data;

    // Verify reimbursement exists
    const { data: reimbursement, error: reimbursementError } = await supabaseClient
      .from('reimbursements')
      .select('id')
      .eq('id', data.reimbursementId)
      .single();

    if (reimbursementError || !reimbursement) {
      console.error("Reimbursement not found:", reimbursementError);
      return new Response(
        JSON.stringify({ error: "Reimbursement not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const safeReimbursementNumber = sanitizeHtml(data.reimbursementNumber);
    subject = `Reimbursement Request #${safeReimbursementNumber} Approved`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Reimbursement Approved</h1>
        <p>Admin has approved reimbursement request <strong>#${safeReimbursementNumber}</strong></p>
        <p>Please process the payment and update the status in the accountant portal.</p>
      </div>
    `;

    console.log("Sending confirmation email for reimbursement:", data.reimbursementNumber, "by admin:", user.id);

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
      email_type: 'reimbursement_confirmation',
      reference_id: data.reimbursementNumber,
      reference_type: 'reimbursement',
      status: 'sent',
      resend_id: (emailResponse as any)?.data?.id || (emailResponse as any)?.id,
    });

    console.log("Confirmation email sent:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending confirmation:", error);
    
    await logEmail({
      from_email: fromEmail,
      to_emails: toEmails,
      subject,
      email_type: 'reimbursement_confirmation',
      reference_type: 'reimbursement',
      status: 'failed',
      error_message: error?.message || 'Unknown error',
    });

    return new Response(JSON.stringify({ error: "Failed to send notification" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);

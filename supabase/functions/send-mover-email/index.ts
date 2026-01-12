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
const emailSchema = z.object({
  recipients: z.array(z.object({
    email: z.string().email(),
    name: z.string().min(1).max(200),
  })).min(1),
  additionalMessage: z.string().min(1).max(5000),
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
  const subject = "Important Notice from MyProMovers Management";

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
    const validationResult = emailSchema.safeParse(rawData);
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error);
      return new Response(
        JSON.stringify({ error: "Invalid input data", details: validationResult.error.issues }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    const data = validationResult.data;
    
    console.log("Sending email to movers:", {
      recipientCount: data.recipients.length,
      adminUserId: user.id
    });

    // Send individual emails to each recipient with personalized greeting
    const emailPromises = data.recipients.map(async (recipient) => {
      const safeName = sanitizeHtml(recipient.name);
      const safeMessage = sanitizeHtml(data.additionalMessage).replace(/\n/g, '<br>');

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
            <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6;">
              Dear <strong>${safeName}</strong>,
            </p>
            
            <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6;">
              I am reaching out to you on behalf of the MyProMovers management with a following statement:
            </p>
            
            <div style="margin: 20px 0; padding: 16px; background-color: #ffffff; border-left: 4px solid #3b82f6; border-radius: 4px;">
              <p style="margin: 0; font-size: 16px; line-height: 1.6;">
                ${safeMessage}
              </p>
            </div>
          </div>
          
          <p style="margin-top: 30px; color: #666;">Best regards,<br>MyProMovers Management</p>
        </div>
      `;

      const result = await resend.emails.send({
        from: fromEmail,
        to: [recipient.email],
        subject,
        html: htmlContent,
      });

      // Log each email
      await logEmail({
        from_email: fromEmail,
        to_emails: [recipient.email],
        subject,
        body_html: htmlContent,
        email_type: 'admin_mover_email',
        status: 'sent',
        resend_id: (result as any)?.data?.id || (result as any)?.id,
      });

      return result;
    });

    const results = await Promise.all(emailPromises);
    console.log("Emails sent successfully:", results.length);

    return new Response(JSON.stringify({ success: true, sentCount: results.length }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-mover-email function:", error);
    
    await logEmail({
      from_email: fromEmail,
      to_emails: [],
      subject,
      email_type: 'admin_mover_email',
      status: 'failed',
      error_message: error?.message || 'Unknown error',
    });

    return new Response(
      JSON.stringify({ error: "Failed to send email" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

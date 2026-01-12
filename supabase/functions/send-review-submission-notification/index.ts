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
const reviewSubmissionSchema = z.object({
  foremanName: z.string().min(1).max(100),
  jobDate: z.string().min(1).max(20),
  clientFullName: z.string().min(1).max(200),
  invoiceNumber: z.string().min(1).max(50),
  reviewUrl: z.string().url().max(500),
  crewMembers: z.array(z.string()).min(2),
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

  const fromEmail = "MyProMovers <notifications@mypromoversreimbursements.com>";
  const toEmails = ["Sam@mypromoversdc.com"];
  let subject = 'Customer Review Submission';

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

    const rawData = await req.json();
    
    // Validate input
    const validationResult = reviewSubmissionSchema.safeParse(rawData);
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error);
      return new Response(
        JSON.stringify({ error: "Invalid input data", details: validationResult.error.issues }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    const data = validationResult.data;

    // Sanitize all input data
    const safeForemanName = sanitizeHtml(data.foremanName);
    const safeJobDate = sanitizeHtml(data.jobDate);
    const safeClientFullName = sanitizeHtml(data.clientFullName);
    const safeInvoiceNumber = sanitizeHtml(data.invoiceNumber);
    const safeReviewUrl = sanitizeHtml(data.reviewUrl);
    const safeCrewMembers = data.crewMembers.filter(m => m.trim()).map(m => sanitizeHtml(m));

    subject = `New Customer Review Submitted - Invoice #${safeInvoiceNumber}`;

    const crewMembersList = safeCrewMembers.map((member, index) => 
      `<p style="margin: 4px 0;"><strong>Crew Member ${index + 1}:</strong> ${member}</p>`
    ).join('');

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">New Customer Review Form Submitted</h1>
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #555; margin-top: 0;">Submission Details</h2>
          
          <p style="margin: 8px 0;"><strong>Submitted By:</strong> ${safeForemanName}</p>
          <p style="margin: 8px 0;"><strong>Job Date:</strong> ${safeJobDate}</p>
          <p style="margin: 8px 0;"><strong>Client Name:</strong> ${safeClientFullName}</p>
          <p style="margin: 8px 0;"><strong>Invoice Number:</strong> ${safeInvoiceNumber}</p>
          <p style="margin: 8px 0;"><strong>Review URL:</strong> ${safeReviewUrl}</p>
          
          <div style="margin-top: 16px;">
            <h3 style="color: #555; margin-bottom: 8px;">Crew Members:</h3>
            ${crewMembersList}
          </div>
        </div>
        
        <p style="color: #666; font-size: 14px;">
          Please review this submission in the admin portal.
        </p>
      </div>
    `;

    console.log("Sending customer review submission notification for invoice:", data.invoiceNumber, "by user:", user.id);

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
      email_type: 'review_submission',
      reference_id: data.invoiceNumber,
      reference_type: 'review_bonus',
      status: 'sent',
      resend_id: (emailResponse as any)?.data?.id || (emailResponse as any)?.id,
    });

    console.log("Customer review submission notification sent:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending review submission notification:", error);
    
    await logEmail({
      from_email: fromEmail,
      to_emails: toEmails,
      subject,
      email_type: 'review_submission',
      reference_type: 'review_bonus',
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

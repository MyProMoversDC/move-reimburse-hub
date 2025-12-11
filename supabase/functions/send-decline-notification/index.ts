import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { z } from "https://esm.sh/zod@3.22.4";

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

  try {
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
    
    // Sanitize all user-provided content for HTML
    const safeReimbursementNumber = sanitizeHtml(data.reimbursementNumber);
    const safeMoverName = sanitizeHtml(data.moverName);
    const safeDeclineReason = sanitizeHtml(data.declineReason);

    console.log("Sending decline notification:", {
      reimbursementNumber: data.reimbursementNumber,
      moverEmail: data.moverEmail,
      moverName: data.moverName,
    });

    const emailResponse = await resend.emails.send({
      from: "MyProMovers <reimbursements@mypromoversreimbursements.com>",
      to: [data.moverEmail],
      subject: `Reimbursement Request #${safeReimbursementNumber} Declined`,
      html: `
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
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-decline-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

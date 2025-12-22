import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { z } from "https://esm.sh/zod@3.22.4";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const approvalEmailSchema = z.object({
  type: z.enum(["reimbursement", "review"]),
  moverEmail: z.string().email(),
  moverName: z.string().min(1).max(200),
  referenceNumber: z.string().min(1).max(50),
  action: z.enum(["approved", "paid"]),
  amount: z.number().optional(),
});

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

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const rawData = await req.json();
    const validationResult = approvalEmailSchema.safeParse(rawData);
    
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error);
      return new Response(
        JSON.stringify({ error: "Invalid input data", details: validationResult.error.issues }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const data = validationResult.data;
    const safeName = sanitizeHtml(data.moverName);
    const safeRef = sanitizeHtml(data.referenceNumber);

    let subject = "";
    let bodyContent = "";

    if (data.type === "reimbursement") {
      if (data.action === "approved") {
        subject = `Your Reimbursement Request #${safeRef} Has Been Approved`;
        bodyContent = `
          <h1 style="color: #333;">Reimbursement Approved!</h1>
          <p>Dear ${safeName},</p>
          <p>Great news! Your reimbursement request <strong>#${safeRef}</strong> has been approved by the admin.</p>
          <p>The payment will be processed shortly by our accounting team.</p>
          <p>You will receive another notification once the payment has been made.</p>
        `;
      } else {
        subject = `Your Reimbursement Request #${safeRef} Has Been Paid`;
        bodyContent = `
          <h1 style="color: #333;">Payment Processed!</h1>
          <p>Dear ${safeName},</p>
          <p>Your reimbursement request <strong>#${safeRef}</strong> has been paid!</p>
          ${data.amount ? `<p>Amount: <strong>$${data.amount.toFixed(2)}</strong></p>` : ''}
          <p>Please check your Zelle account for the payment.</p>
        `;
      }
    } else {
      if (data.action === "approved") {
        subject = `Your Customer Review Bonus Has Been Approved`;
        bodyContent = `
          <h1 style="color: #333;">Review Bonus Approved!</h1>
          <p>Dear ${safeName},</p>
          <p>Great news! Your customer review bonus submission (Invoice #${safeRef}) has been approved.</p>
          <p>The bonus will be processed with your next payroll.</p>
        `;
      }
    }

    console.log("Sending approval notification to:", data.moverEmail);

    const emailResponse = await resend.emails.send({
      from: "MyProMovers <notifications@mypromoversreimbursements.com>",
      to: [data.moverEmail],
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          ${bodyContent}
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">This is an automated message from MyProMovers.</p>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending notification:", error);
    return new Response(JSON.stringify({ error: "Failed to send notification" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
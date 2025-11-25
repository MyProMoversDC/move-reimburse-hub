import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConfirmationEmailRequest {
  reimbursementNumber: string;
  reimbursementId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: ConfirmationEmailRequest = await req.json();
    
    const loginUrl = `${req.headers.get('origin')}/auth`;

    const emailResponse = await resend.emails.send({
      from: "MyProMovers <onboarding@resend.dev>",
      to: ["mark@mypromoversdc.com"],
      subject: `Reimbursement Request #${data.reimbursementNumber} Approved`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Reimbursement Approved</h1>
          <p>Admin has approved reimbursement request <strong>#${data.reimbursementNumber}</strong></p>
          <p>Please process the payment and update the status in the accountant portal.</p>
          
          <div style="margin-top: 30px; text-align: center;">
            <a href="${loginUrl}" style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Process Payment
            </a>
          </div>
          
          <div style="margin-top: 30px; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #007bff;">
            <p style="margin: 0;"><strong>Accountant Login:</strong></p>
            <p style="margin: 5px 0 0 0;">Username: accountingmpm</p>
            <p style="margin: 5px 0 0 0;">Password: accrempm!@#2025</p>
          </div>
        </div>
      `,
    });

    console.log("Confirmation email sent:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending confirmation:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);

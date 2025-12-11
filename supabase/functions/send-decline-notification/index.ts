import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeclineEmailRequest {
  reimbursementNumber: string;
  moverEmail: string;
  moverName: string;
  declineReason: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: DeclineEmailRequest = await req.json();

    console.log("Sending decline notification:", {
      reimbursementNumber: data.reimbursementNumber,
      moverEmail: data.moverEmail,
      moverName: data.moverName,
    });

    const emailResponse = await resend.emails.send({
      from: "MyProMovers <reimbursements@mypromoversreimbursements.com>",
      to: [data.moverEmail],
      subject: `Reimbursement Request #${data.reimbursementNumber} Declined`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Reimbursement Request Declined</h1>
          <p>Hello ${data.moverName},</p>
          <p>Your reimbursement request <strong>#${data.reimbursementNumber}</strong> has been declined.</p>
          
          <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #dc3545;">
            <p style="margin: 0;"><strong>Reason for Decline:</strong></p>
            <p style="margin: 10px 0 0 0;">${data.declineReason}</p>
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

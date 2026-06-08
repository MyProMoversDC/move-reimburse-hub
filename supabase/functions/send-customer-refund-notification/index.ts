import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { logEmail } from "../_shared/emailLogger.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { customerName, reason, requestDate, amount, paymentMethod, checkAddress, zellePhone, comments, refundId, submitterName } = await req.json();

    if (!customerName || !reason || !requestDate || !amount || !paymentMethod) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const sanitize = (v: string) => String(v).replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const fromEmail = "MyProMovers <notifications@mypromoversreimbursements.com>";
    const toEmails = [
      "Daniel@mypromoversdc.com",
      "mark@mypromoversdc.com",
      "management@mypromovers.com",
    ];
    const emailSubject = `New Customer Refund Request - ${sanitize(customerName)} - $${Number(amount).toFixed(2)}`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Customer Refund Request Submitted</h2>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Submitted By:</strong> ${sanitize(submitterName || 'N/A')}</p>
          <p style="margin: 5px 0;"><strong>Customer Name:</strong> ${sanitize(customerName)}</p>
          <p style="margin: 5px 0;"><strong>Request Date:</strong> ${sanitize(requestDate)}</p>
          <p style="margin: 5px 0;"><strong>Amount:</strong> $${Number(amount).toFixed(2)}</p>
          <p style="margin: 5px 0;"><strong>Payment Method:</strong> ${sanitize(paymentMethod)}</p>
          ${checkAddress ? `<p style="margin: 5px 0;"><strong>Check Mailing Address:</strong> ${sanitize(checkAddress)}</p>` : ''}
          ${zellePhone ? `<p style="margin: 5px 0;"><strong>Zelle Phone / Digits:</strong> ${sanitize(zellePhone)}</p>` : ''}
        </div>
        
        <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Reimbursement Reason:</strong></p>
          <p style="margin: 0;">${sanitize(reason).replace(/\n/g, "<br>")}</p>
        </div>
        
        ${comments ? `
        <div style="background-color: #e8f4fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Comments:</strong></p>
          <p style="margin: 0;">${sanitize(comments).replace(/\n/g, "<br>")}</p>
        </div>
        ` : ''}
        
        <p>Please review this customer refund request in the admin portal.</p>
        
        <p style="margin-top: 30px;">Best regards,<br>MyProMovers System</p>
      </div>
    `;

    try {
      const emailResponse = await resend.emails.send({
        from: fromEmail,
        to: toEmails,
        subject: emailSubject,
        html: htmlContent,
      });

      await logEmail({
        email_type: "customer_refund_notification",
        from_email: fromEmail,
        to_emails: toEmails,
        subject: emailSubject,
        body_html: htmlContent,
        status: "sent",
        resend_id: (emailResponse as any).id,
        reference_type: "customer_refund",
        reference_id: refundId,
      });
    } catch (emailError: any) {
      console.error("Error sending email:", emailError);
      await logEmail({
        email_type: "customer_refund_notification",
        from_email: fromEmail,
        to_emails: toEmails,
        subject: emailSubject,
        body_html: htmlContent,
        status: "failed",
        error_message: emailError.message,
        reference_type: "customer_refund",
        reference_id: refundId,
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);

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
    const { moverName, subject, jobNumber, questionDetails, questionId } = await req.json();

    if (!moverName || !subject || !jobNumber || !questionDetails) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const sanitizedName = moverName.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const sanitizedSubject = String(subject).replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const sanitizedJob = String(jobNumber).replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const sanitizedDetails = String(questionDetails).replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");

    const fromEmail = "MyProMovers <notifications@mypromoversreimbursements.com>";
    const toEmails = [
      "Daniel@mypromoversdc.com",
      "mark@mypromoversdc.com",
      "accounting@mypromoversdc.com",
    ];
    const emailSubject = `New Payment Question from ${sanitizedName} - ${sanitizedSubject}`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Payment Question Submitted</h2>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Mover Name:</strong> ${sanitizedName}</p>
          <p style="margin: 5px 0;"><strong>Subject:</strong> ${sanitizedSubject}</p>
          <p style="margin: 5px 0;"><strong>Job #:</strong> ${sanitizedJob}</p>
        </div>
        
        <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Question Details:</strong></p>
          <p style="margin: 0;">${sanitizedDetails}</p>
        </div>
        
        <p>Please review and respond to this question in the admin portal.</p>
        
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
        email_type: "payment_question_notification",
        from_email: fromEmail,
        to_emails: toEmails,
        subject: emailSubject,
        body_html: htmlContent,
        status: "sent",
        resend_id: (emailResponse as any).id,
        reference_type: "payment_question",
        reference_id: questionId,
      });
    } catch (emailError: any) {
      console.error("Error sending email:", emailError);
      await logEmail({
        email_type: "payment_question_notification",
        from_email: fromEmail,
        to_emails: toEmails,
        subject: emailSubject,
        body_html: htmlContent,
        status: "failed",
        error_message: emailError.message,
        reference_type: "payment_question",
        reference_id: questionId,
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

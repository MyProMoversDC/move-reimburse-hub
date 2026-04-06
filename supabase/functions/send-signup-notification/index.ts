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
    const { firstName, lastName, email, phone, selectedRole, dateOfBirth, nickname } = await req.json();

    if (!firstName || !lastName || !email) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const sanitize = (v: string) => String(v || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const roleLabel = selectedRole === 'office_staff' ? 'Office Staff' : 'Mover';
    const fromEmail = "MyProMovers <notifications@mypromoversreimbursements.com>";
    const toEmails = [
      "Daniel@mypromoversdc.com",
      "mark@mypromoversdc.com",
      "management@mypromovers.com",
    ];
    const emailSubject = `New Sign-Up Request - ${sanitize(firstName)} ${sanitize(lastName)} (${roleLabel})`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Sign-Up Request Pending Approval</h2>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Name:</strong> ${sanitize(firstName)} ${sanitize(lastName)}</p>
          <p style="margin: 5px 0;"><strong>Email:</strong> ${sanitize(email)}</p>
          <p style="margin: 5px 0;"><strong>Phone:</strong> ${sanitize(phone)}</p>
          <p style="margin: 5px 0;"><strong>Role:</strong> ${roleLabel}</p>
          <p style="margin: 5px 0;"><strong>Date of Birth:</strong> ${sanitize(dateOfBirth)}</p>
          ${nickname ? `<p style="margin: 5px 0;"><strong>Nickname:</strong> ${sanitize(nickname)}</p>` : ''}
        </div>
        
        <p>Please review and approve or decline this sign-up request in the admin portal under "SignUp Approvals".</p>
        
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
        email_type: "signup_notification",
        from_email: fromEmail,
        to_emails: toEmails,
        subject: emailSubject,
        body_html: htmlContent,
        status: "sent",
        resend_id: (emailResponse as any).id,
        reference_type: "signup",
      });
    } catch (emailError: any) {
      console.error("Error sending email:", emailError);
      await logEmail({
        email_type: "signup_notification",
        from_email: fromEmail,
        to_emails: toEmails,
        subject: emailSubject,
        body_html: htmlContent,
        status: "failed",
        error_message: emailError.message,
        reference_type: "signup",
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

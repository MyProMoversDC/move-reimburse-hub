import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEmail } from "../_shared/emailLogger.ts";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();
    const { type } = body;

    let toEmails: string[] = [];
    let subject = "";
    let htmlContent = "";

    switch (type) {
      case "day_off_request": {
        toEmails = [
          "Daniel@mypromoversdc.com",
          "Uliana@mypromoversdc.com",
          "mark@mypromoversdc.com",
          "management@mypromovers.com",
        ];
        subject = `Day Off Request from ${body.userName}`;
        htmlContent = `
          <h2>Day Off / Hours Off Request</h2>
          <p><strong>Employee:</strong> ${body.userName}</p>
          <p><strong>Date(s):</strong> ${body.startDate}${body.startDate !== body.endDate ? ` to ${body.endDate}` : ""}</p>
          ${body.isPartial ? `<p><strong>Hours Off:</strong> ${body.partialTimes}</p>` : "<p><strong>Type:</strong> Full Day(s)</p>"}
          <p><strong>Reason:</strong> ${body.reason}</p>
          <p>Please review this request in the Admin Dashboard.</p>
        `;
        break;
      }

      case "shift_assigned": {
        if (!body.userEmail) break;
        toEmails = [body.userEmail];
        subject = `New Shift Assigned - ${body.shiftDate}`;
        htmlContent = `
          <h2>New Shift Assigned</h2>
          <p>Hello ${body.userName},</p>
          <p>A new shift has been assigned to you:</p>
          <p><strong>Date:</strong> ${body.shiftDate}</p>
          <p><strong>Time:</strong> ${body.shiftTime}</p>
          <p>Please log in to confirm your shift.</p>
        `;
        break;
      }

      case "schedule_set": {
        if (!body.userEmail) break;
        toEmails = [body.userEmail];
        subject = `Your Schedule Has Been Set (${body.startDate} - ${body.endDate})`;
        htmlContent = `
          <h2>Schedule Set</h2>
          <p>Hello ${body.userName},</p>
          <p>Your schedule has been set for the following period:</p>
          <p><strong>From:</strong> ${body.startDate}</p>
          <p><strong>To:</strong> ${body.endDate}</p>
          <p><strong>Shift Time:</strong> ${body.shiftTime}</p>
          <p>Please log in to confirm your shifts.</p>
        `;
        break;
      }

      case "day_off_approved": {
        if (!body.userEmail) break;
        toEmails = [body.userEmail];
        subject = "Your Day Off Request Has Been Approved";
        htmlContent = `
          <h2>Day Off Request Approved</h2>
          <p>Hello ${body.userName},</p>
          <p>Your day off request for ${body.startDate}${body.startDate !== body.endDate ? ` to ${body.endDate}` : ""} has been approved.</p>
        `;
        break;
      }

      case "day_off_declined": {
        if (!body.userEmail) break;
        toEmails = [body.userEmail];
        subject = "Your Day Off Request Has Been Declined";
        htmlContent = `
          <h2>Day Off Request Declined</h2>
          <p>Hello ${body.userName},</p>
          <p>Your day off request for ${body.startDate}${body.startDate !== body.endDate ? ` to ${body.endDate}` : ""} has been declined.</p>
          ${body.reason ? `<p><strong>Reason:</strong> ${body.reason}</p>` : ""}
        `;
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown notification type" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    if (toEmails.length === 0) {
      return new Response(JSON.stringify({ message: "No recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailResponse = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
        "X-Connection-Api-Key": resendApiKey,
      },
      body: JSON.stringify({
        from: "MyProMovers <notifications@mypromoversreimbursements.com>",
        to: toEmails,
        subject,
        html: htmlContent,
      }),
    });

    const emailResult = await emailResponse.json();

    await logEmail({
      email_type: `shift_${type}`,
      from_email: "notifications@mypromoversreimbursements.com",
      to_emails: toEmails,
      subject,
      body_html: htmlContent,
      status: emailResponse.ok ? "sent" : "failed",
      resend_id: emailResult?.id || null,
      error_message: emailResponse.ok ? undefined : JSON.stringify(emailResult),
      reference_type: "shift",
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

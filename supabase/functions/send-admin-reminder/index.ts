import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEmail } from "../_shared/emailLogger.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAILS = [
  "mark@mypromoversdc.com",
  "Daniel@mypromoversdc.com",
  "Tony@mypromoversdc.com",
];

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting admin reminder check...");

    // Initialize Supabase client with service role for admin access
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate 72 hours ago
    const seventyTwoHoursAgo = new Date();
    seventyTwoHoursAgo.setHours(seventyTwoHoursAgo.getHours() - 72);

    // Fetch old pending reimbursements
    const { data: oldReimbursements, error: reimbError } = await supabase
      .from("reimbursements")
      .select("id, reimbursement_number, mover_full_name, created_at")
      .in("status", ["pending", "appeal"])
      .lt("created_at", seventyTwoHoursAgo.toISOString())
      .order("created_at", { ascending: true });

    if (reimbError) {
      console.error("Error fetching reimbursements:", reimbError);
      throw reimbError;
    }

    // Fetch old pending reviews
    const { data: oldReviews, error: reviewError } = await supabase
      .from("review_bonuses")
      .select("id, invoice_number, foreman_name, client_full_name, submission_date")
      .in("status", ["pending", "appeal"])
      .lt("submission_date", seventyTwoHoursAgo.toISOString())
      .order("submission_date", { ascending: true });

    if (reviewError) {
      console.error("Error fetching reviews:", reviewError);
      throw reviewError;
    }

    const totalPending = (oldReimbursements?.length || 0) + (oldReviews?.length || 0);

    if (totalPending === 0) {
      console.log("No overdue items found, skipping email");
      return new Response(
        JSON.stringify({ message: "No overdue items" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${totalPending} overdue items`);

    // Build email content
    let reimbursementsList = "";
    if (oldReimbursements && oldReimbursements.length > 0) {
      reimbursementsList = oldReimbursements.map((r) => 
        `<li>Reimbursement #${String(r.reimbursement_number).padStart(5, "0")} - ${r.mover_full_name} (submitted ${new Date(r.created_at).toLocaleDateString()})</li>`
      ).join("");
    }

    let reviewsList = "";
    if (oldReviews && oldReviews.length > 0) {
      reviewsList = oldReviews.map((r) => 
        `<li>Review ${r.invoice_number} - ${r.foreman_name} / ${r.client_full_name} (submitted ${new Date(r.submission_date).toLocaleDateString()})</li>`
      ).join("");
    }

    const fromEmail = "MyProMovers <notifications@resend.dev>";
    const toEmails = ADMIN_EMAILS;
    const subject = `Reminder: ${totalPending} Items Awaiting Review (72+ hours)`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Reminder: Pending Items Awaiting Review</h1>
        <p>The following items have been awaiting review for more than 72 hours:</p>
        
        ${oldReimbursements && oldReimbursements.length > 0 ? `
          <h2 style="color: #555;">Pending Reimbursements (${oldReimbursements.length})</h2>
          <ul>${reimbursementsList}</ul>
        ` : ""}
        
        ${oldReviews && oldReviews.length > 0 ? `
          <h2 style="color: #555;">Pending Review Bonuses (${oldReviews.length})</h2>
          <ul>${reviewsList}</ul>
        ` : ""}
        
        <p>Please log in to the admin portal to review these items.</p>
        <p>Best regards,<br>MyProMovers System</p>
      </div>
    `;

    try {
      // Send email to all admin recipients
      const emailResponse = await resend.emails.send({
        from: fromEmail,
        to: toEmails,
        subject: subject,
        html: emailHtml,
      });

      console.log("Reminder email sent successfully:", emailResponse);

      // Log the email
      await logEmail({
        email_type: "admin_reminder",
        from_email: fromEmail,
        to_emails: toEmails,
        subject,
        body_html: emailHtml,
        status: "sent",
        resend_id: (emailResponse as any).id,
        reference_type: "system",
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          itemsCount: totalPending,
          emailResponse 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (emailError: any) {
      console.error("Error sending email:", emailError);

      // Log the failed email
      await logEmail({
        email_type: "admin_reminder",
        from_email: fromEmail,
        to_emails: toEmails,
        subject,
        body_html: emailHtml,
        status: "failed",
        error_message: emailError.message,
        reference_type: "system",
      });

      throw emailError;
    }
  } catch (error: any) {
    console.error("Error in send-admin-reminder function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);

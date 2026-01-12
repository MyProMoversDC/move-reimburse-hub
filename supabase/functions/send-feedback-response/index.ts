import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEmail } from "../_shared/emailLogger.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FeedbackResponseRequest {
  feedbackId: string;
  moverId: string;
  moverEmail: string;
  moverName: string;
  responseMessage: string;
  feedbackType: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get the user from the auth header
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { feedbackId, moverId, moverEmail, moverName, responseMessage, feedbackType }: FeedbackResponseRequest = await req.json();

    // Validate required fields
    if (!feedbackId || !moverId || !responseMessage) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Save the response to the database
    const { error: insertError } = await supabaseClient
      .from("mover_feedback_responses")
      .insert({
        feedback_id: feedbackId,
        admin_id: userData.user.id,
        response_message: responseMessage,
      });

    if (insertError) {
      console.error("Error inserting response:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save response" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Update feedback status to 'responded'
    const { error: updateError } = await supabaseClient
      .from("mover_feedback")
      .update({ status: "responded", reviewed_at: new Date().toISOString() })
      .eq("id", feedbackId);

    if (updateError) {
      console.error("Error updating feedback status:", updateError);
    }

    // Send email notification if email is available
    if (moverEmail) {
      const sanitizedName = moverName.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const sanitizedFeedback = feedbackType.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const sanitizedResponse = responseMessage.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");

      const fromEmail = "MyProMovers <noreply@mypromoversreimbursements.com>";
      const toEmails = [moverEmail];
      const subject = "Response to Your Feedback - MyProMovers";
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Response to Your Feedback</h2>
          
          <p>Dear ${sanitizedName},</p>
          
          <p>Management has reviewed and responded to your recent feedback submission.</p>
          
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0;"><strong>Your Feedback:</strong></p>
            <p style="margin: 0; color: #666;">${sanitizedFeedback}</p>
          </div>
          
          <div style="background-color: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0;"><strong>Management Response:</strong></p>
            <p style="margin: 0;">${sanitizedResponse}</p>
          </div>
          
          <p>You can also view this response in your Mover Cabinet under the Feedback & Improvement section.</p>
          
          <p>Thank you for taking the time to share your thoughts with us. Your input helps us improve as a team.</p>
          
          <p style="margin-top: 30px;">Best regards,<br>MyProMovers Management</p>
        </div>
      `;

      try {
        const emailResponse = await resend.emails.send({
          from: fromEmail,
          to: toEmails,
          subject: subject,
          html: htmlContent,
        });
        console.log("Email sent successfully to:", moverEmail);

        // Log the email
        await logEmail({
          email_type: "feedback_response",
          from_email: fromEmail,
          to_emails: toEmails,
          subject,
          body_html: htmlContent,
          status: "sent",
          resend_id: (emailResponse as any).id,
          reference_type: "mover_feedback",
          reference_id: feedbackId,
        });
      } catch (emailError: any) {
        console.error("Error sending email:", emailError);
        
        // Log the failed email
        await logEmail({
          email_type: "feedback_response",
          from_email: fromEmail,
          to_emails: toEmails,
          subject,
          body_html: htmlContent,
          status: "failed",
          error_message: emailError.message,
          reference_type: "mover_feedback",
          reference_id: feedbackId,
        });
        // Don't fail the whole request if email fails
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-feedback-response:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);

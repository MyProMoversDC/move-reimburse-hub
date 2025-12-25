import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { z } from "https://esm.sh/zod@3.22.4";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const replySchema = z.object({
  reportTitle: z.string().min(1).max(500),
  message: z.string().min(1).max(5000),
  adminId: z.string().uuid(),
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
    // Authorization check
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

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const rawData = await req.json();
    
    // Validate input
    const validationResult = replySchema.safeParse(rawData);
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error);
      return new Response(
        JSON.stringify({ error: "Invalid input data", details: validationResult.error.issues }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    const data = validationResult.data;

    // Get mover's profile
    const { data: moverProfile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("id", user.id)
      .single();

    if (profileError || !moverProfile) {
      console.error("Profile fetch error:", profileError);
      return new Response(
        JSON.stringify({ error: "Could not fetch mover profile" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const moverName = `${moverProfile.first_name} ${moverProfile.last_name}`;
    
    console.log("Sending misconduct reply email:", {
      moverName,
      reportTitle: data.reportTitle,
      adminId: data.adminId,
    });

    // Save the reply message to the database
    const { error: insertError } = await supabaseClient
      .from("performance_misconduct_messages")
      .insert({
        report_title: data.reportTitle,
        sender_id: user.id,
        recipient_id: data.adminId,
        message: data.message,
        is_admin_message: false,
        is_read: false,
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to save reply" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Send email to management
    const safeMessage = sanitizeHtml(data.message).replace(/\n/g, '<br>');
    const safeReportTitle = sanitizeHtml(data.reportTitle);
    const safeMoverName = sanitizeHtml(moverName);

    const emailResult = await resend.emails.send({
      from: "MyProMovers <reimbursements@mypromoversreimbursements.com>",
      to: ["management@mypromovers.com"],
      subject: `Reply from ${moverName} - ${data.reportTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
            <h2 style="margin: 0 0 16px 0; color: #333;">
              Reply to Misconduct Case
            </h2>
            
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #666;">
              <strong>From:</strong> ${safeMoverName} (${moverProfile.email})
            </p>
            
            <p style="margin: 0 0 16px 0; font-size: 14px; color: #666;">
              <strong>Regarding:</strong> ${safeReportTitle}
            </p>
            
            <div style="margin: 20px 0; padding: 16px; background-color: #ffffff; border-left: 4px solid #22c55e; border-radius: 4px;">
              <p style="margin: 0; font-size: 16px; line-height: 1.6;">
                ${safeMessage}
              </p>
            </div>
          </div>
          
          <p style="margin-top: 30px; color: #666; font-size: 12px;">
            This is an automated message from the MyProMovers Reimbursement Portal.
          </p>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResult);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-misconduct-reply function:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send reply" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
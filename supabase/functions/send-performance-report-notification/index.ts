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
const reportEmailSchema = z.object({
  title: z.string().min(1).max(200),
  workerName: z.string().min(1).max(200),
  incidentCategory: z.string().min(1).max(200),
  severityLevel: z.string().min(1).max(50),
  incidentDatetime: z.string().min(1),
  submittedBy: z.string().min(1).max(200),
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

const getSeverityColor = (severity: string): string => {
  switch (severity.toLowerCase()) {
    case 'critical': return '#dc2626';
    case 'high': return '#ea580c';
    case 'medium': return '#ca8a04';
    case 'low': return '#16a34a';
    default: return '#6b7280';
  }
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

    // Verify user is operations_manager
    const { data: roleData, error: roleError } = await supabaseClient
      .rpc('has_role', { _user_id: user.id, _role: 'operations_manager' });

    if (roleError || !roleData) {
      console.error("Role check failed:", roleError);
      return new Response(
        JSON.stringify({ error: "Forbidden - Operations Manager access required" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const rawData = await req.json();
    
    // Validate input
    const validationResult = reportEmailSchema.safeParse(rawData);
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error);
      return new Response(
        JSON.stringify({ error: "Invalid input data", details: validationResult.error.issues }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    const data = validationResult.data;
    
    // Sanitize all user-provided content for HTML
    const safeTitle = sanitizeHtml(data.title);
    const safeWorkerName = sanitizeHtml(data.workerName);
    const safeIncidentCategory = sanitizeHtml(data.incidentCategory);
    const safeSeverityLevel = sanitizeHtml(data.severityLevel);
    const safeSubmittedBy = sanitizeHtml(data.submittedBy);
    
    // Format the date
    const incidentDate = new Date(data.incidentDatetime).toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'short'
    });

    console.log("Sending performance report notification:", {
      title: data.title,
      workerName: data.workerName,
      submittedBy: data.submittedBy,
      userId: user.id
    });

    const severityColor = getSeverityColor(data.severityLevel);

    const emailResponse = await resend.emails.send({
      from: "MyProMovers <reimbursements@mypromoversreimbursements.com>",
      to: ["Daniel@mypromoversdc.com"],
      subject: `New Performance/Misconduct Report: ${safeTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">New Performance/Misconduct Report Submitted</h1>
          
          <p>A new performance/misconduct report has been submitted for your review.</p>
          
          <div style="margin-top: 20px; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555; width: 140px;">Title:</td>
                <td style="padding: 8px 0;">${safeTitle}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555;">Worker Name:</td>
                <td style="padding: 8px 0;">${safeWorkerName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555;">Category:</td>
                <td style="padding: 8px 0;">${safeIncidentCategory}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555;">Severity Level:</td>
                <td style="padding: 8px 0;">
                  <span style="display: inline-block; padding: 4px 12px; background-color: ${severityColor}; color: white; border-radius: 4px; font-weight: bold;">
                    ${safeSeverityLevel}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555;">Incident Date:</td>
                <td style="padding: 8px 0;">${incidentDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555;">Submitted By:</td>
                <td style="padding: 8px 0;">${safeSubmittedBy}</td>
              </tr>
            </table>
          </div>
          
          <p style="margin-top: 20px;">Please log in to the dashboard to review the full report details.</p>
          
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
    console.error("Error in send-performance-report-notification function:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send notification" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

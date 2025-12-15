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
const reimbursementEmailSchema = z.object({
  reimbursementNumber: z.string().min(1).max(10),
  moverFullName: z.string().min(1).max(200),
  jobNumber: z.string().min(1).max(50),
  truckNumber: z.string().min(1).max(50),
  customerName: z.string().min(1).max(200),
  gasExpenses: z.number().min(0).max(100000),
  roadExpenses: z.number().min(0).max(100000),
  hotelExpenses: z.number().min(0).max(100000),
  otherExpenses: z.number().min(0).max(100000),
  totalExpenses: z.number().min(0).max(500000),
  zelleInfo: z.string().min(1).max(200),
  attachmentCount: z.number().int().min(0).max(100),
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

    // Verify user has mover role (any authenticated mover can submit their own reimbursement)
    const { data: roleData, error: roleError } = await supabaseClient
      .rpc('has_role', { _user_id: user.id, _role: 'mover' });

    if (roleError || !roleData) {
      console.error("Role check failed:", roleError);
      return new Response(
        JSON.stringify({ error: "Forbidden - Mover access required" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const rawData = await req.json();
    
    // Validate input
    const validationResult = reimbursementEmailSchema.safeParse(rawData);
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error);
      return new Response(
        JSON.stringify({ error: "Invalid input data", details: validationResult.error.issues }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    const data = validationResult.data;

    // Sanitize all user-provided content for HTML
    const safeReimbursementNumber = sanitizeHtml(data.reimbursementNumber);
    const safeMoverFullName = sanitizeHtml(data.moverFullName);
    const safeJobNumber = sanitizeHtml(data.jobNumber);
    const safeTruckNumber = sanitizeHtml(data.truckNumber);
    const safeCustomerName = sanitizeHtml(data.customerName);
    const safeZelleInfo = sanitizeHtml(data.zelleInfo);

    console.log("Sending reimbursement notification:", {
      reimbursementNumber: data.reimbursementNumber,
      moverFullName: data.moverFullName,
      totalExpenses: data.totalExpenses,
      userId: user.id
    });

    const emailResponse = await resend.emails.send({
      from: "MyProMovers Reimbursements <reimbursements@mypromoversreimbursements.com>",
      to: ["mark@mypromoversdc.com", "Tony@mypromoversdc.com", "Daniel@mypromoversdc.com"],
      subject: `New Reimbursement Request #${safeReimbursementNumber} - ${safeMoverFullName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">New Reimbursement Request</h1>
          <p><strong>Reimbursement #:</strong> ${safeReimbursementNumber}</p>
          <hr style="border: 1px solid #eee; margin: 20px 0;">
          
          <h2 style="color: #555;">Details</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Mover Name:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${safeMoverFullName}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Job #:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${safeJobNumber}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Truck #:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${safeTruckNumber}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Customer Name:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${safeCustomerName}</td>
            </tr>
          </table>
          
          <h3 style="color: #555; margin-top: 20px;">Expenses</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Gas:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">$${data.gasExpenses.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Road/Tolls:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">$${data.roadExpenses.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Hotel:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">$${data.hotelExpenses.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Other:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">$${data.otherExpenses.toFixed(2)}</td>
            </tr>
            <tr style="background-color: #f5f5f5;">
              <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Total:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>$${data.totalExpenses.toFixed(2)}</strong></td>
            </tr>
          </table>
          
          <p style="margin-top: 20px;"><strong>Zelle Payment Info:</strong> ${safeZelleInfo}</p>
          <p><strong>Attachments:</strong> ${data.attachmentCount} file(s)</p>
        </div>
      `,
    });

    console.log("Notification email sent:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending notification:", error);
    return new Response(JSON.stringify({ error: "Failed to send notification" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { z } from "https://esm.sh/zod@3.22.4";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const appealEmailSchema = z.object({
  type: z.enum(["reimbursement", "review"]),
  moverName: z.string().min(1).max(200),
  referenceNumber: z.string().min(1).max(50),
  appealNote: z.string().min(1).max(2000),
});

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

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const rawData = await req.json();
    const validationResult = appealEmailSchema.safeParse(rawData);
    
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error);
      return new Response(
        JSON.stringify({ error: "Invalid input data", details: validationResult.error.issues }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const data = validationResult.data;
    const safeName = sanitizeHtml(data.moverName);
    const safeRef = sanitizeHtml(data.referenceNumber);
    const safeNote = sanitizeHtml(data.appealNote);

    const typeLabel = data.type === "reimbursement" ? "Reimbursement" : "Customer Review Bonus";
    const subject = `Appeal Submitted: ${typeLabel} #${safeRef}`;

    console.log("Sending appeal notification to admins");

    const emailResponse = await resend.emails.send({
      from: "MyProMovers <notifications@mypromoversreimbursements.com>",
      to: ["mark@mypromoversdc.com", "Daniel@mypromoversdc.com", "Tony@mypromoversdc.com"],
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Appeal Submitted</h1>
          <p>A mover has submitted an appeal for a declined ${typeLabel.toLowerCase()}.</p>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Mover:</strong> ${safeName}</p>
            <p><strong>Reference:</strong> #${safeRef}</p>
            <p><strong>Type:</strong> ${typeLabel}</p>
          </div>
          
          <h3>Appeal Note:</h3>
          <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107;">
            <p style="margin: 0;">${safeNote}</p>
          </div>
          
          <p style="margin-top: 20px;">Please log in to the admin portal to review this appeal.</p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">This is an automated message from MyProMovers.</p>
        </div>
      `,
    });

    console.log("Appeal notification sent:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending appeal notification:", error);
    return new Response(JSON.stringify({ error: "Failed to send notification" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
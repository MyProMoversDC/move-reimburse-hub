import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReimbursementEmailRequest {
  reimbursementNumber: string;
  moverFullName: string;
  jobNumber: string;
  truckNumber: string;
  customerName: string;
  gasExpenses: number;
  roadExpenses: number;
  hotelExpenses: number;
  otherExpenses: number;
  totalExpenses: number;
  zelleInfo: string;
  attachmentCount: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: ReimbursementEmailRequest = await req.json();
    
    const loginUrl = `${req.headers.get('origin')}/auth`;

    const emailResponse = await resend.emails.send({
      from: "MyProMovers <onboarding@resend.dev>",
      to: ["mark@mypromoversdc.com"],
      subject: `New Reimbursement Request #${data.reimbursementNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">New Reimbursement Request</h1>
          <p><strong>Reimbursement #:</strong> ${data.reimbursementNumber}</p>
          <hr style="border: 1px solid #eee; margin: 20px 0;">
          
          <h2 style="color: #555;">Details</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Mover Name:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${data.moverFullName}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Job #:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${data.jobNumber}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Truck #:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${data.truckNumber}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Customer Name:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${data.customerName}</td>
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
          
          <p style="margin-top: 20px;"><strong>Zelle Payment Info:</strong> ${data.zelleInfo}</p>
          <p><strong>Attachments:</strong> ${data.attachmentCount} file(s)</p>
          
          <div style="margin-top: 30px; text-align: center;">
            <a href="${loginUrl}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Review in Portal
            </a>
          </div>
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);

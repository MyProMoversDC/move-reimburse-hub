import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AlertRequest {
  workerName: string;
  testerName: string;
  testDate: string;
  testTime: string;
  finalResult: string;
  bacReading: string;
  actionsTaken: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const { workerName, testerName, testDate, testTime, finalResult, bacReading, actionsTaken }: AlertRequest = await req.json();

    const resultText = finalResult === "fail" ? "FAIL - Alcohol Detected" : "REFUSAL TO TEST";
    const actionsText = actionsTaken.map(a => {
      const labels: Record<string, string> = {
        cleared: "Cleared to work",
        removed: "Removed from duty",
        sentHome: "Sent home",
        transportation: "Transportation arranged",
        escalated: "Escalated to HR / Ownership"
      };
      return labels[a] || a;
    }).join(", ");

    const emailContent = `
URGENT: Alcohol Test Alert

A ${resultText} result has been recorded.

Worker: ${workerName}
Tester: ${testerName}
Date: ${testDate}
Time: ${testTime}
BAC Reading: ${bacReading}
Result: ${resultText}

Actions Taken:
${actionsText}

This is an automated alert. Please review and take appropriate action.
    `.trim();

    const toEmails = ["Daniel@mypromovers.com", "mark@mypromovers.com"];

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "notifications@mypromoversreimbursements.com",
        to: toEmails,
        subject: `URGENT: Alcohol Test ${resultText} - ${workerName}`,
        text: emailContent,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send email: ${error}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error sending alcohol test alert:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEmail } from "../_shared/emailLogger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate the start (Monday) and end (Sunday) of the previous week
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Calculate days since last Monday (for this week's Monday)
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    // Get this week's Monday at 00:00:00
    const thisWeekMonday = new Date(now);
    thisWeekMonday.setDate(now.getDate() - daysSinceMonday);
    thisWeekMonday.setHours(0, 0, 0, 0);
    
    // Get last week's Monday (7 days before this week's Monday)
    const lastWeekMonday = new Date(thisWeekMonday);
    lastWeekMonday.setDate(thisWeekMonday.getDate() - 7);
    
    // Get last week's Sunday (end of last week)
    const lastWeekSunday = new Date(thisWeekMonday);
    lastWeekSunday.setDate(thisWeekMonday.getDate() - 1);
    lastWeekSunday.setHours(23, 59, 59, 999);

    console.log(`Checking for missing alcohol tests from ${lastWeekMonday.toISOString()} to ${lastWeekSunday.toISOString()}`);

    // Get all movers (users with 'mover' role)
    const { data: moverRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "mover");

    if (rolesError) {
      throw new Error(`Failed to fetch mover roles: ${rolesError.message}`);
    }

    if (!moverRoles || moverRoles.length === 0) {
      console.log("No movers found in the system");
      return new Response(JSON.stringify({ success: true, message: "No movers found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const moverIds = moverRoles.map((r) => r.user_id);

    // Get mover profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", moverIds);

    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }

    // Get alcohol test reports for the last week
    const { data: reports, error: reportsError } = await supabase
      .from("alcohol_test_reports")
      .select("worker_id")
      .gte("test_date", lastWeekMonday.toISOString().split("T")[0])
      .lte("test_date", lastWeekSunday.toISOString().split("T")[0]);

    if (reportsError) {
      throw new Error(`Failed to fetch alcohol test reports: ${reportsError.message}`);
    }

    // Get unique worker IDs that have reports
    const workersWithReports = new Set(reports?.map((r) => r.worker_id) || []);

    // Count how many movers have at least one test
    const moversWithTests = profiles?.filter((p) => workersWithReports.has(p.id)) || [];

    console.log(`Found ${moversWithTests.length} movers with alcohol test reports`);

    // Check if at least 1 mover had a test - if so, no alert needed
    if (moversWithTests.length > 0) {
      console.log("At least 1 mover had an alcohol test report for the week - no alert needed");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "At least 1 mover had a test - no alert needed",
          moversWithTests: moversWithTests.length 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // No movers had a test - send alert
    console.log("No movers had an alcohol test report for the week - sending alert");

    // Format the week range for the email
    const weekRange = `${lastWeekMonday.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })} - ${lastWeekSunday.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;

    const emailContent = `
Missing Alcohol Test Alert

No alcohol test reports were submitted for ANY mover during the week of ${weekRange}.

Total movers in system: ${profiles?.length || 0}

At least 1 mover is required to have an alcohol test each week.

Please ensure alcohol test compliance is maintained.

This is an automated weekly compliance check (runs every Tuesday at 8:00 AM EST).
    `.trim();

    const toEmail = "Daniel@mypromoversdc.com";
    const subject = `Missing Alcohol Test Reports - Week of ${weekRange}`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "notifications@mypromoversreimbursements.com",
        to: [toEmail],
        subject: subject,
        text: emailContent,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send email: ${error}`);
    }

    const emailResponse = await response.json();

    // Log the email
    await logEmail({
      from_email: "notifications@mypromoversreimbursements.com",
      to_emails: [toEmail],
      subject: subject,
      body_text: emailContent,
      email_type: "missing_alcohol_test_alert",
      status: "sent",
      resend_id: emailResponse.id,
    });

    console.log("Missing alcohol test alert sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({
        success: true,
        alertSent: true,
        totalMovers: profiles?.length || 0,
        message: "No movers had tests this week - alert sent to Daniel",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error checking missing alcohol tests:", error);

    // Try to log the failed email attempt
    try {
      await logEmail({
        from_email: "notifications@mypromoversreimbursements.com",
        to_emails: ["Daniel@mypromoversdc.com"],
        subject: "Missing Alcohol Test Reports",
        email_type: "missing_alcohol_test_alert",
        status: "failed",
        error_message: error instanceof Error ? error.message : String(error),
      });
    } catch (logError) {
      console.error("Failed to log email error:", logError);
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

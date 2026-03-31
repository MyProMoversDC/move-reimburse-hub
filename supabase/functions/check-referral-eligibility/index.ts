import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Find approved referrals where 3 months have passed since admin_start_date
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const { data: eligibleReferrals, error } = await supabaseAdmin
      .from("referral_requests")
      .select("*")
      .eq("status", "approved")
      .lte("admin_start_date", threeMonthsAgo.toISOString().split("T")[0]);

    if (error) throw error;

    let updatedCount = 0;
    for (const referral of eligibleReferrals || []) {
      // Update status to bonus_eligible
      await supabaseAdmin
        .from("referral_requests")
        .update({
          status: "bonus_eligible",
          bonus_eligible_at: new Date().toISOString(),
        })
        .eq("id", referral.id);

      // Send email notification to the referrer
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
      const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

      await fetch(`${SUPABASE_URL}/functions/v1/send-referral-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          type: "bonus_eligible",
          referrerName: referral.referrer_name,
          referredName: referral.referred_name,
          referrerId: referral.referrer_id,
        }),
      });

      updatedCount++;
    }

    return new Response(JSON.stringify({ success: true, updatedCount }), {
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

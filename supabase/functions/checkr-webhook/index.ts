import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const eventType = body.type;

    console.log("Checkr webhook received:", eventType);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    if (eventType === "invitation.completed") {
      const candidateId = body.data?.object?.candidate_id;
      if (candidateId) {
        await supabaseAdmin
          .from("checkr_candidates")
          .update({ status: "pending" })
          .eq("checkr_candidate_id", candidateId);
        console.log("Invitation completed for candidate:", candidateId);
      }
    } else if (eventType === "report.completed") {
      const candidateId = body.data?.object?.candidate_id;
      const reportId = body.data?.object?.id;
      const result = body.data?.object?.result; // "clear" or "consider"

      if (candidateId) {
        const newStatus = result === "clear" ? "clear" : "consider";
        await supabaseAdmin
          .from("checkr_candidates")
          .update({
            status: newStatus,
            report_id: reportId,
            checkr_result: result,
          })
          .eq("checkr_candidate_id", candidateId);
        console.log(`Report completed for candidate ${candidateId}: ${result}`);
      }
    } else if (eventType === "report.suspended") {
      const candidateId = body.data?.object?.candidate_id;
      if (candidateId) {
        await supabaseAdmin
          .from("checkr_candidates")
          .update({ status: "suspended" })
          .eq("checkr_candidate_id", candidateId);
      }
    } else if (eventType === "report.disputed") {
      const candidateId = body.data?.object?.candidate_id;
      if (candidateId) {
        await supabaseAdmin
          .from("checkr_candidates")
          .update({ status: "dispute" })
          .eq("checkr_candidate_id", candidateId);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing Checkr webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);

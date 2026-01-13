import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find all scheduled posts that should be published now
    const now = new Date().toISOString();
    
    const { data: postsToPublish, error: fetchError } = await supabase
      .from("feed_posts")
      .select("id, scheduled_at")
      .eq("is_published", false)
      .not("scheduled_at", "is", null)
      .lte("scheduled_at", now);

    if (fetchError) {
      throw fetchError;
    }

    if (!postsToPublish || postsToPublish.length === 0) {
      return new Response(
        JSON.stringify({ message: "No scheduled posts to publish", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update posts to published
    const postIds = postsToPublish.map(p => p.id);
    
    const { error: updateError } = await supabase
      .from("feed_posts")
      .update({ is_published: true })
      .in("id", postIds);

    if (updateError) {
      throw updateError;
    }

    console.log(`Published ${postIds.length} scheduled posts`);

    return new Response(
      JSON.stringify({ 
        message: "Scheduled posts published successfully", 
        count: postIds.length,
        postIds 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error publishing scheduled posts:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

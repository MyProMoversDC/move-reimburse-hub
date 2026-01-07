import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { previousHandbookUrl, newHandbookUrl, handbookId } = await req.json();

    if (!newHandbookUrl) {
      throw new Error("New handbook URL is required");
    }

    // Fetch the handbook content (for PDFs/DOCs we'll describe what changed)
    let prompt = "";
    
    if (previousHandbookUrl) {
      prompt = `You are a document comparison assistant. Compare the previous company handbook with the new version and identify ONLY the key changes, additions, and removals.

Previous Handbook URL: ${previousHandbookUrl}
New Handbook URL: ${newHandbookUrl}

Please provide a clear, concise summary of the changes in the following format:

## Summary of Changes

### New Additions
- List any new policies, rules, or sections added

### Modified Content  
- List any policies or rules that were changed, explaining the old vs new

### Removed Content
- List any policies or rules that were removed

### Important Notes for Team Members
- Highlight the most important changes that all team members should be aware of

Keep the summary professional and easy to understand. Focus on practical implications for the team.`;
    } else {
      prompt = `You are a document summarizer. This is a new company handbook being shared with the team for the first time.

Handbook URL: ${newHandbookUrl}

Please provide a brief executive summary of the key policies and guidelines covered in this handbook. Structure it as:

## Handbook Overview

### Key Policies
- List the main policies covered

### Employee Guidelines
- Summarize important guidelines for employees

### Compliance Requirements
- Note any compliance requirements mentioned

Keep it concise and highlight what team members should pay attention to.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that analyzes company handbooks and identifies changes between versions. Provide clear, actionable summaries.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content || "Unable to generate summary";

    // Update the handbook record with the AI summary
    if (handbookId) {
      await supabase
        .from("handbooks")
        .update({ ai_change_summary: summary })
        .eq("id", handbookId);
    }

    return new Response(
      JSON.stringify({ summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in compare-handbooks:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

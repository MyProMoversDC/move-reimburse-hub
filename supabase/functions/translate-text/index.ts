import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { texts } = await req.json();
    
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'texts array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Filter out empty texts and create a map of original indices
    const nonEmptyTexts: { index: number; text: string }[] = [];
    texts.forEach((text, index) => {
      if (text && text.trim()) {
        nonEmptyTexts.push({ index, text: text.trim() });
      }
    });

    if (nonEmptyTexts.length === 0) {
      return new Response(
        JSON.stringify({ translations: texts }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const prompt = `Translate the following texts to English. If the text is already in English, return it unchanged. Return ONLY a JSON array of translated strings in the same order, nothing else.

Texts to translate:
${nonEmptyTexts.map((item, i) => `${i + 1}. "${item.text}"`).join('\n')}

Return format: ["translated text 1", "translated text 2", ...]`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { 
            role: "system", 
            content: "You are a translation assistant. Translate texts to English accurately while preserving the original meaning. Return only the JSON array of translations, no other text or markdown formatting." 
          },
          { role: "user", content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add funds to continue using AI features." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Translation service unavailable");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No translation received from AI");
    }

    // Parse the JSON array from the response
    let translatedTexts: string[];
    try {
      // Clean up the response - remove markdown code blocks if present
      const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      translatedTexts = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("Failed to parse translation response:", content);
      throw new Error("Failed to parse translation response");
    }

    // Reconstruct the full array with original empty values preserved
    const result = [...texts];
    nonEmptyTexts.forEach((item, i) => {
      if (translatedTexts[i]) {
        result[item.index] = translatedTexts[i];
      }
    });

    return new Response(
      JSON.stringify({ translations: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Translation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Translation failed" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

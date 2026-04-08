import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { images, filename } = await req.json();

    if (!images || !Array.isArray(images) || images.length === 0) {
      return new Response(JSON.stringify({ error: "No images provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process pages in batches of 5 to avoid token limits
    const batchSize = 5;
    let fullText = "";

    for (let i = 0; i < images.length; i += batchSize) {
      const batch = images.slice(i, i + batchSize);
      const pageStart = i + 1;
      const pageEnd = Math.min(i + batchSize, images.length);

      const content: any[] = [
        {
          type: "text",
          text: `Extract ALL text content from these PDF pages (pages ${pageStart}-${pageEnd} of ${images.length}). This is from "${filename || "document.pdf"}".

INSTRUCTIONS:
- Extract EVERY piece of text, equation, diagram label, table, and heading
- For mathematical equations, use LaTeX notation (e.g., $E = mc^2$, $$\\int f(x)dx$$)
- Preserve the document structure: headings, bullet points, numbered lists, tables
- For diagrams/figures, describe what they show in detail
- Include ALL content — do not skip or summarize
- Format output as clean markdown
- Label each page clearly`,
        },
      ];

      for (let j = 0; j < batch.length; j++) {
        content.push({
          type: "image_url",
          image_url: { url: batch[j], detail: "high" },
        });
      }

      const response = await fetch(LOVABLE_AI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content,
            },
          ],
          max_tokens: 8000,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[ocr-pdf] AI error ${response.status}:`, errText.slice(0, 300));

        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again shortly." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        throw new Error(`AI gateway error: ${response.status}`);
      }

      const data = await response.json();
      const extracted = data.choices?.[0]?.message?.content || "";
      fullText += `\n${extracted}\n`;

      console.log(`[ocr-pdf] Processed pages ${pageStart}-${pageEnd} of ${images.length}`);
    }

    return new Response(JSON.stringify({ text: fullText.trim(), pages: images.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[ocr-pdf] error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "OCR failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

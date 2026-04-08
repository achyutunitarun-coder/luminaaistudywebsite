import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const VISION_MODELS = [
  "nvidia/nemotron-nano-12b-v2-vl:free",
  "google/gemma-3-27b-it:free",
  "google/gemma-3-12b-it:free",
  "google/gemma-3-4b-it:free",
];

const TIMEOUT_MS = 30000;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const images = Array.isArray(body?.images) ? body.images : [];
    const filename = typeof body?.filename === "string" ? body.filename : "document.pdf";
    const parsedPageOffset = Number(body?.pageOffset ?? 0);
    const parsedTotalPages = Number(body?.totalPages ?? images.length);
    const pageOffset = Number.isFinite(parsedPageOffset) ? Math.max(0, Math.trunc(parsedPageOffset)) : 0;
    const totalPages = Number.isFinite(parsedTotalPages) ? Math.max(images.length, Math.trunc(parsedTotalPages)) : images.length;

    if (images.length === 0) {
      return new Response(JSON.stringify({ error: "No images provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");

    const batchSize = 4;
    let fullText = "";

    for (let i = 0; i < images.length; i += batchSize) {
      const batch = images.slice(i, i + batchSize);
      const pageStart = pageOffset + i + 1;
      const pageEnd = pageOffset + Math.min(i + batchSize, images.length);

      const content: any[] = [
        {
          type: "text",
          text: `Extract ALL text content from these PDF pages (pages ${pageStart}-${pageEnd} of ${totalPages}) from "${filename}".

INSTRUCTIONS:
- Extract EVERY piece of text, equation, diagram label, table, and heading
- For math equations, use LaTeX: $E = mc^2$, $$\\int f(x)dx$$
- Preserve structure: headings, bullets, numbered lists, tables
- For diagrams/figures, describe what they show in detail
- Include ALL content — do not skip or summarize
- Format as clean markdown
- Label each page clearly`,
        },
      ];

      for (const img of batch) {
        content.push({ type: "image_url", image_url: { url: img } });
      }

      let extracted = "";
      for (const model of VISION_MODELS) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

          const res = await fetch(OPENROUTER_URL, {
            method: "POST",
            signal: controller.signal,
            headers: {
              Authorization: `Bearer ${OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              messages: [{ role: "user", content }],
              max_tokens: 8000,
              temperature: 0.1,
            }),
          });
          clearTimeout(timeout);

          if (!res.ok) {
            const errText = await res.text();
            console.error(`[ocr-pdf] ${model} ${res.status}: ${errText.slice(0, 200)}`);
            continue;
          }

          const data = await res.json();
          if (data.error) {
            console.error(`[ocr-pdf] ${model} body error:`, data.error);
            continue;
          }

          extracted = typeof data.choices?.[0]?.message?.content === "string"
            ? data.choices[0].message.content
            : "";

          if (extracted.trim()) {
            console.log(`[ocr-pdf] ✓ ${model} pages ${pageStart}-${pageEnd}`);
            break;
          }
        } catch (e) {
          const isTimeout = e instanceof DOMException && e.name === "AbortError";
          console.error(`[ocr-pdf] ${model} ${isTimeout ? "TIMEOUT" : "err"}:`, isTimeout ? `>${TIMEOUT_MS}ms` : e);
        }
      }

      if (extracted) {
        fullText += `\n${extracted}\n`;
      } else {
        fullText += `\n[Pages ${pageStart}-${pageEnd}: OCR failed - all models busy]\n`;
      }
    }

    return new Response(JSON.stringify({ text: fullText.trim(), pages: images.length, totalPages, pageOffset }), {
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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { OPENROUTER_URL, MODELS_VISION, getApiKey, fetchWithTimeout } from "../_shared/models.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const images = Array.isArray(body?.images) ? body.images : [];
    const filename = typeof body?.filename === "string" ? body.filename : "document.pdf";
    const pageOffset = Math.max(0, Math.trunc(Number(body?.pageOffset ?? 0)));
    const totalPages = Math.max(images.length, Math.trunc(Number(body?.totalPages ?? images.length)));

    if (images.length === 0) {
      return new Response(JSON.stringify({ error: "No images provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = getApiKey();
    const pageStart = pageOffset + 1;
    const pageEnd = pageOffset + images.length;

    const content: any[] = [
      {
        type: "text",
        text: `Extract ALL text from these PDF pages (pages ${pageStart}-${pageEnd} of ${totalPages}) from "${filename}". Extract EVERY piece of text, equation, diagram label, table, heading. Use LaTeX for math. Preserve structure. Format as clean markdown. Label each page.`,
      },
    ];
    for (const img of images) {
      content.push({ type: "image_url", image_url: { url: img } });
    }

    let extracted = "";
    let lastError = "";

    for (const model of MODELS_VISION) {
      try {
        const res = await fetchWithTimeout(OPENROUTER_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://luminaaistudywebsite.lovable.app",
            "X-Title": "Lumina AI Study",
          },
          body: JSON.stringify({ model, messages: [{ role: "user", content }], max_tokens: 8000, temperature: 0.1 }),
        }, 60000);

        if (!res.ok) {
          const e = await res.text();
          lastError = `${model} ${res.status}`;
          console.error(`[ocr-pdf] ${lastError}: ${e.slice(0, 200)}`);
          continue;
        }
        const data = await res.json();
        extracted = typeof data.choices?.[0]?.message?.content === "string" ? data.choices[0].message.content : "";
        if (extracted.trim()) {
          console.log(`[ocr-pdf] ✓ ${model} pages ${pageStart}-${pageEnd}`);
          break;
        }
      } catch (e) {
        const isTimeout = e instanceof DOMException && e.name === "AbortError";
        lastError = `${model} ${isTimeout ? "TIMEOUT" : "err"}`;
        console.error(`[ocr-pdf] ${lastError}`);
      }
    }

    if (!extracted.trim()) extracted = `[Pages ${pageStart}-${pageEnd}: OCR failed - ${lastError || "unavailable"}]`;

    return new Response(JSON.stringify({ text: extracted.trim(), pages: images.length, totalPages, pageOffset }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[ocr-pdf] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "OCR failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

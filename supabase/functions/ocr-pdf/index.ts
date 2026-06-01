import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser } from "../_shared/auth.ts";
import { callWithFallback, MODELS_VISION } from "../_shared/models.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const _auth = await requireUser(req, corsHeaders);
    if ("error" in _auth) return _auth.error;
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

    // Limit batch size to 3 pages at a time for speed
    const batch = images.slice(0, 3);
    const pageStart = pageOffset + 1;
    const pageEnd = pageOffset + batch.length;

    const content: any[] = [
      {
        type: "text",
        text: `Extract ALL text from these PDF pages (pages ${pageStart}-${pageEnd} of ${totalPages}) from "${filename}". Extract every piece of text, equation, diagram label, table, heading. Use LaTeX for math. Format as clean markdown. Be fast and thorough.`,
      },
    ];
    for (const img of batch) {
      content.push({ type: "image_url", image_url: { url: img } });
    }

    let extracted = "";
    let lastError = "";

    try {
      const res = await callWithFallback(
        [{ role: "user", content }],
        MODELS_VISION,
        5000,
        0.1,
        45_000,
        "ocr-pdf",
      );
      const data = await res.json();
      extracted = typeof data?.choices?.[0]?.message?.content === "string"
        ? data.choices[0].message.content
        : "";
    } catch (e) {
      lastError = e instanceof Error ? e.message : "unavailable";
      console.error("[ocr-pdf] routing error:", lastError);
    }

    if (!extracted.trim()) {
      extracted = `[Pages ${pageStart}-${pageEnd}: Text extraction incomplete — ${lastError || "model unavailable"}]`;
    }

    return new Response(JSON.stringify({ text: extracted.trim(), pages: batch.length, totalPages, pageOffset }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[ocr-pdf] error:", e);
    const msg = e instanceof Error ? e.message : "OCR failed";
    const userMsg = msg.includes("high demand") || msg.includes("busy")
      ? "OCR is busy right now — please try again in a moment."
      : "OCR processing failed — please try again.";
    return new Response(JSON.stringify({ error: userMsg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

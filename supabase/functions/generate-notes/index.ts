import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser } from "../_shared/auth.ts";
import { streamAI, MODELS_BALANCED } from "../_shared/models.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STYLE_PROMPTS: Record<string, string> = {
  bullet: `Prioritize scannability with numbered sections and bold key terms. Structure should follow whatever the source material's own divisions are — not a fixed set of sections imposed regardless of content.`,
  hyphen: `Use Roman numerals for major sections, bold subtopic headers. Let the material's natural divisions determine the section count and ordering.`,
  paragraph: `Formal academic prose. Bold key terms on first use. Section count and structure driven by the content's own logic, not a fixed template.`,
  mindmap: `Start with a text-based concept map tree, then expand each branch. Show cross-connections where the material actually has them.`,
  root_cause: `Focus on WHY students fail on this specific material. Include diagnosis and corrective plan tailored to the actual concepts being covered.`,
  detailed: `Be exhaustive within the bounds of what the material actually covers. Include definitions, explanations, formulas, and examples for each concept the material addresses.`,
  exam: `Focus on what's testable from this specific material. Include worked examples, common mistakes, and practice opportunities driven by the actual content.`,
  simple: `Explain like talking to a friend. Use analogies for abstract concepts. Structure follows the material's logic, not a fixed outline.`,
  cornell: `Use two-column Cornell format. Left = cue questions derived from the actual content, right = comprehensive answers. Summary at the end.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const _auth = await requireUser(req, corsHeaders);
    if ("error" in _auth) return _auth.error;
    {
      const { enforceUsage } = await import("../_shared/usage-gate.ts");
      const gate = await enforceUsage(_auth.user.id, "notes_generations", corsHeaders);
      if (!gate.ok) return gate.response;
    }
    const body = await req.text();
    if (body.length > 4_000_000) return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { topic, sourceText, style, isRefinement } = JSON.parse(body);

    const stylePrompt = STYLE_PROMPTS[style || "bullet"] || STYLE_PROMPTS.bullet;
    const systemPrompt = isRefinement
      ? `You are Lumina AI's study notes assistant. Refine the existing notes per user instructions. Output COMPLETE updated notes.`
      : `[Applies the NOTES_PROMPT logic — see artifact-prompts.ts.] Let the source material's own structure lead your notes organization. Style: ${stylePrompt}`;

    const userContent = sourceText ? `Create comprehensive study notes from this material:\n\n${sourceText}` : `Create thorough study notes on "${topic}".`;

    const res = await streamAI(
      [{ role: "system", content: systemPrompt }, { role: "user", content: userContent }],
      MODELS_BALANCED, 4000, 0.65, 60_000, "notes"
    );
    return new Response(res.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  } catch (e) {
    console.error("generate-notes error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

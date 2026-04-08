import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { streamAI, MODELS_BALANCED } from "../_shared/models.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STYLE_PROMPTS: Record<string, string> = {
  bullet: `Use numbered sections (1, 2, 3...) with bold key terms and em-dashes for definitions. Include Common Mistakes, Quick Revision Checklist, and Memory Aids sections.`,
  hyphen: `Use Roman numerals for major sections. Bold all subtopic headers. Include a definitions table and revision checklist.`,
  paragraph: `Write in formal academic prose with flowing paragraphs. Bold key terms on first use. Include Summary and Key Takeaways sections.`,
  mindmap: `Start with a text-based concept map tree, then expand each branch. Show cross-connections. Include a summary table.`,
  root_cause: `Focus on WHY students fail. Include Core Principles, Common Misconceptions with root causes, Diagnostic Self-Test, and Corrective Study Plan.`,
  detailed: `Be exhaustive. Include Definition, Explanation, Formula, Example for each concept. Use tables for comparisons. Include Chapter Summary.`,
  exam: `Focus on what's testable. Include Key Definitions table, Worked Examples, Common Mistakes (Mark Killers), Predicted Exam Questions, Last-Minute Revision, Pre-Exam Checklist.`,
  simple: `Explain like talking to a friend. Use analogies for every abstract concept. Include Common Confusions Q&A, Cheat Sheet table, Memory Tricks.`,
  cornell: `Use two-column Cornell format: left = cue questions, right = comprehensive answers. Every section ends with a summary. Include Master Summary and Key Terms Glossary.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.text();
    if (body.length > 100_000) return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { topic, sourceText, style, isRefinement } = JSON.parse(body);

    const stylePrompt = STYLE_PROMPTS[style || "bullet"] || STYLE_PROMPTS.bullet;
    const systemPrompt = isRefinement
      ? `You are Lumina AI's study notes assistant. Refine the existing notes per user instructions. Output COMPLETE updated notes.`
      : `You are Lumina AI — a world-class academic notes generator. Create formal, precise, beautifully structured notes.\n\nSTYLE: ${stylePrompt}\n\nRULES:\n- Bold every key term. Use proper spacing.\n- Include worked examples, common mistakes, mnemonics.\n- Use tables for comparisons. Use blockquotes for key insights.\n- Be EXHAUSTIVE. Never output placeholder text.`;

    const userContent = sourceText ? `Create comprehensive study notes from this material:\n\n${sourceText}` : `Create thorough study notes on "${topic}".`;

    const res = await streamAI(
      [{ role: "system", content: systemPrompt }, { role: "user", content: userContent }],
      MODELS_BALANCED, 4000, 0.65, 45000, "notes"
    );
    return new Response(res.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  } catch (e) {
    console.error("generate-notes error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

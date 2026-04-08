import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const MODELS = [
  "openrouter/auto",
  "qwen/qwen3-235b-a22b:free",
  "meta-llama/llama-4-maverick:free",
  "google/gemma-3-27b-it:free",
  "nvidia/llama-3.1-nemotron-70b-instruct:free",
  "deepseek/deepseek-chat-v3-0324:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-3-12b-it:free",
];

const TIMEOUT_MS = 15000;

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

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");

    const stylePrompt = STYLE_PROMPTS[style || "bullet"] || STYLE_PROMPTS.bullet;

    const systemPrompt = isRefinement
      ? `You are Lumina AI's study notes assistant. Refine the existing notes per user instructions. Output COMPLETE updated notes.`
      : `You are Lumina AI — a world-class academic notes generator. Create formal, precise, beautifully structured notes.\n\nSTYLE: ${stylePrompt}\n\nRULES:\n- Bold every key term. Use proper spacing.\n- Include worked examples, common mistakes, mnemonics.\n- Use tables for comparisons. Use blockquotes for key insights.\n- Be EXHAUSTIVE. Never output placeholder text.`;

    const userContent = sourceText
      ? `Create comprehensive study notes from this material:\n\n${sourceText}`
      : `Create thorough study notes on "${topic}".`;

    const aiMessages = [{ role: "system", content: systemPrompt }, { role: "user", content: userContent }];

    for (const model of MODELS) {
      try {
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), TIMEOUT_MS);
        const res = await fetch(OPENROUTER_URL, {
          method: "POST", signal: c.signal,
          headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, messages: aiMessages, max_tokens: 3800, temperature: 0.65, stream: true }),
        }, );
        clearTimeout(t);
        if (!res.ok) { const e = await res.text(); console.error(`[notes] ${model} ${res.status}: ${e.slice(0,200)}`); continue; }
        console.log(`[notes] ✓ ${model}`);
        return new Response(res.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
      } catch (e) { console.error(`[notes] ${model}:`, e); }
    }
    throw new Error("All models are busy — please try again in a moment");
  } catch (e) {
    console.error("generate-notes error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

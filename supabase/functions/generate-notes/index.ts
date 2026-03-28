import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODELS = [
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "google/gemma-3-27b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "qwen/qwen3-coder:free",
];

const STYLE_PROMPTS: Record<string, string> = {
  bullet: `Format with clear hierarchical bullet-point structure. Use ## for major sections, ### for subsections. Include key formulas, definitions in bold, mnemonics where helpful, and a final "Quick Revision" recap section.`,
  hyphen: `Format as a professional hyphen-style outline. Main topics as headers, subtopics with hyphen-led lines, progressive indentation for details. Include a revision checklist at the end.`,
  paragraph: `Format in rich, flowing paragraph style. Well-crafted connected paragraphs with strong transitions, embedded examples, real-world applications, and an executive summary at the end.`,
  mindmap: `Format as a text-based mind map. Central topic at top, branches using indentation and symbols (├── ├── └──). Sub-branches for key facts, formulas, and connections between ideas.`,
  root_cause: `Format as deep root-cause analysis. Start with core principles, then map common misconceptions and WHY they happen, diagnostic patterns to identify gaps, step-by-step correction plans, and a "Master Plan" summary.`,
};

async function searchSerper(query: string, apiKey: string): Promise<string> {
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num: 4, gl: "us", hl: "en" }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    let ctx = "";
    if (data.knowledgeGraph?.description) ctx += `${data.knowledgeGraph.title}: ${data.knowledgeGraph.description}\n`;
    for (const r of (data.organic ?? []).slice(0, 4)) ctx += `${r.title}: ${r.snippet ?? ""}\n`;
    return ctx;
  } catch { return ""; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic, sourceText, style, isRefinement } = await req.json();
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");

    const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY");
    const stylePrompt = STYLE_PROMPTS[style || "bullet"] || STYLE_PROMPTS.bullet;

    let searchContext = "";
    if (!sourceText && topic && SERPER_API_KEY) {
      searchContext = await searchSerper(`${topic} study notes key concepts`, SERPER_API_KEY);
    }

    const systemPrompt = isRefinement
      ? `You are Lumina AI's study notes assistant. Refine the existing notes per user instructions. Output the COMPLETE updated notes.`
      : `You are Lumina AI's premium study notes generator — create the kind of notes that make students say "I wish I had these before the exam."

${stylePrompt}

Rules:
- Be EXHAUSTIVE. Cover every major concept, sub-concept, formula, definition, and edge case
- Use **bold** for key terms, *italics* for emphasis
- Include real-world examples and exam-relevant tips
- Add "⚠️ Common Mistake" callouts where students typically go wrong
- Include mnemonics or memory tricks where applicable
- Make it feel like the best study resource ever created for this topic
${searchContext ? `\nREFERENCE DATA (enhance your notes with this):\n${searchContext}` : ""}`;

    const userContent = sourceText
      ? `Create comprehensive study notes from this material:\n\n${sourceText}`
      : `Create the most thorough, exam-ready study notes possible on "${topic}".`;

    const aiMessages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ];

    for (const model of MODELS) {
      try {
        const res = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: aiMessages,
            max_tokens: 3000,
            temperature: 0.7,
            stream: true,
          }),
        });

        if (!res.ok) { console.error(`${model} error ${res.status}`); continue; }

        return new Response(res.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      } catch (e) { console.error(`${model} exception:`, e); }
    }

    throw new Error("All models failed");
  } catch (e) {
    console.error("generate-notes error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

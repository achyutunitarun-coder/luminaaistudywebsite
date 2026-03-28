import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const PRIMARY_MODELS = [
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "google/gemma-3-27b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "qwen/qwen3-coder:free",
];

const AUTO_ROUTER = "openrouter/auto";

const FALLBACK_MODELS = [
  "deepseek/deepseek-chat-v3-0324:free",
  "deepseek/deepseek-r1-0528:free",
  "qwen/qwq-32b:free",
  "qwen/qwen-2.5-coder-32b-instruct:free",
  "deepseek/deepseek-r1:free",
  "microsoft/phi-4-reasoning-plus:free",
  "microsoft/phi-4-reasoning:free",
  "microsoft/mai-ds-r1:free",
  "rekaai/reka-flash-3:free",
  "moonshotai/kimi-vl-a3b-thinking:free",
  "nvidia/llama-3.1-nemotron-ultra-253b:free",
  "open-r1/olympiccoder-32b:free",
  "allenai/olmo-2-0325-32b-instruct:free",
  "google/gemma-3-4b-it:free",
  "google/gemma-3-12b-it:free",
  "google/gemma-3-1b-it:free",
];

function getModelsToTry(): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const m of [...PRIMARY_MODELS, AUTO_ROUTER, ...FALLBACK_MODELS]) {
    if (!seen.has(m)) { seen.add(m); result.push(m); }
  }
  return result;
}

const STYLE_PROMPTS: Record<string, string> = {
  bullet: `Format with clear hierarchical bullet-point structure. Use ## for major sections, ### for subsections. Include key formulas, definitions in bold, mnemonics where helpful, and a final "Quick Revision" recap section.`,
  hyphen: `Format as a professional hyphen-style outline. Main topics as headers, subtopics with hyphen-led lines, progressive indentation for details. Include a revision checklist at the end.`,
  paragraph: `Format in rich, flowing paragraph style. Well-crafted connected paragraphs with strong transitions, embedded examples, real-world applications, and an executive summary at the end.`,
  mindmap: `Format as a text-based mind map. Central topic at top, branches using indentation and symbols (├── ├── └──). Sub-branches for key facts, formulas, and connections between ideas.`,
  root_cause: `Format as deep root-cause analysis. Start with core principles, then map common misconceptions and WHY they happen, diagnostic patterns to identify gaps, step-by-step correction plans, and a "Master Plan" summary.`,
  detailed: `Format with comprehensive headings, subheadings, and deep explanations. Use ## for major sections, ### for subsections. Include key formulas, definitions in bold, examples, and a final summary.`,
  exam: `Focus on key facts, definitions, formulas, and potential exam questions. Use clear headers and bullet points. Include "⚠️ Common Mistake" callouts and a quick revision checklist.`,
  simple: `Use easy-to-understand language with examples and analogies. Keep explanations clear and concise. Include real-world comparisons to aid understanding.`,
  cornell: `Format in Cornell note-taking style with three sections: Cues (key questions/terms on the left), Notes (detailed explanations on the right), and Summary (brief recap at the bottom).`,
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

    const models = getModelsToTry();
    console.log(`[generate-notes] Trying ${models.length} models`);

    for (const model of models) {
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

        if (!res.ok) {
          const errText = await res.text();
          console.error(`[generate-notes] ${model} error ${res.status}: ${errText}`);
          continue;
        }

        console.log(`[generate-notes] Success with model: ${model}`);
        return new Response(res.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      } catch (e) { console.error(`[generate-notes] ${model} exception:`, e); }
    }

    throw new Error("All models failed");
  } catch (e) {
    console.error("generate-notes error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

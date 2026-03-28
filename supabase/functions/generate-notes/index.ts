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
  bullet: `Format the notes with clear bullet-point structure. Include major sections as headings, nested bullet points for concepts, short scannable explanations, and a final recap section.`,
  hyphen: `Format the notes as a hyphen-style outline with main topics and subtopics using hyphen-led lines, progressive indentation, and a revision checklist.`,
  paragraph: `Format the notes in rich paragraph style with well-written connected paragraphs, strong transitions, embedded examples, and a summary at the end.`,
  mindmap: `Format the notes as a text-based mind map with a central topic, branches for major ideas, sub-branches for key facts and formulas, and visual hierarchy using indentation.`,
  root_cause: `Format as deep root-cause analysis notes with core concepts first, then common errors and why they happen, diagnostic cues, step-by-step correction plans, and a "Fix Plan" summary.`,
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

async function callOpenRouter(apiKey: string, messages: any[], maxTokens = 1500): Promise<string> {
  for (const model of MODELS) {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.7 }),
      });
      if (!res.ok) { console.error(`${model} error ${res.status}`); continue; }
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (content) return content;
    } catch (e) { console.error(`${model} exception:`, e); }
  }
  throw new Error("All models failed");
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
      : `You are Lumina AI's premium study notes generator.\n\n${stylePrompt}\n\nBe THOROUGH. Cover every concept. Use markdown. Never skip details.${searchContext ? `\n\nREFERENCE DATA:\n${searchContext}` : ""}`;

    const userContent = sourceText || `Create comprehensive study notes on "${topic}".`;
    const aiMessages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ];

    const output = await callOpenRouter(OPENROUTER_API_KEY, aiMessages, 1500);

    return new Response(
      JSON.stringify({ choices: [{ message: { content: output.trim() } }] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-notes error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

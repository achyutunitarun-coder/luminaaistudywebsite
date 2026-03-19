import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STYLE_PROMPTS: Record<string, string> = {
  bullet: `Format the notes with clear bullet-point structure. Include:
- Major sections as headings
- Nested bullet points for concepts and sub-concepts
- Short, scannable explanations per bullet
- A final bullet-point recap section
- Clean markdown formatting optimized for quick revision`,

  hyphen: `Format the notes as a hyphen-style outline. Include:
- Main topics and subtopics using hyphen-led outline lines
- Progressive indentation for hierarchy
- Concise, logical flow from basics to advanced points
- A final hyphenated revision checklist`,

  paragraph: `Format the notes in rich paragraph style. Include:
- Well-written, connected paragraphs under each heading
- Strong transitions between sections
- Examples embedded naturally in prose
- A concise paragraph summary at the end`,

  mindmap: `Format the notes as a text-based mind map in markdown. Include:
- A central topic heading
- Branches for major ideas
- Sub-branches for key facts, formulas, and examples
- Visual hierarchy using indentation and symbols
- A short "how to revise this mind map" section`,

  root_cause: `Format the notes as deep root-cause analysis notes. Include:
- Core concepts first, then common errors and why they happen
- "Root Cause" sections for each difficult sub-topic
- Diagnostic cues to identify misunderstanding
- Step-by-step correction plans and drills
- A "Fix Plan" summary for rapid improvement`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic, sourceText, style, isRefinement } = await req.json();
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured");
    const stylePrompt = STYLE_PROMPTS[style || "detailed"] || STYLE_PROMPTS.detailed;

    const systemPrompt = isRefinement
      ? `You are Lumina AI's study notes assistant. The user wants to refine their existing notes. Follow their instructions precisely. Maintain the same style and format but apply the requested changes. Output the COMPLETE updated notes, not just the changes. Use markdown formatting.`
      : `You are Lumina AI's premium study notes generator. Your job is to create the most comprehensive, well-organized, and pedagogically effective study notes possible.

${stylePrompt}

CRITICAL RULES:
- Be THOROUGH. Cover every concept mentioned in the source material.
- Use markdown formatting extensively.
- Never skip details — if something is mentioned, explain it fully.
- Include transitions between sections for reading flow.
- Add "Key Insight" callouts for particularly important points.
- The notes should be LONG and DETAILED enough that a student never needs to refer back to the original lecture.`;

    const userContent = sourceText
      ? sourceText
      : `Create comprehensive study notes on "${topic}".`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-r1-0528:free",
        models: ["deepseek/deepseek-r1-0528:free", "openrouter/hunter-alpha", "nvidia/nemotron-3-super-120b-a12b:free"],
        max_tokens: 6000,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Failed to generate notes" }), {
        status: response.status === 429 ? 429 : response.status === 402 ? 402 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-notes error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

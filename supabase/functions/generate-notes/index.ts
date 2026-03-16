import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STYLE_PROMPTS: Record<string, string> = {
  detailed: `Create extremely thorough and detailed study notes. Include:
- Multiple levels of headings (H1, H2, H3) for clear hierarchy
- Every key concept explained in depth with 2-3 sentences minimum
- Bold key terms and italicize supporting details
- Bullet points AND numbered lists where appropriate
- Important formulas, definitions, and theorems in blockquotes
- Real-world examples and analogies for complex concepts
- "Common Mistakes" or "Watch Out" sections
- Connections between different concepts
- A detailed summary section at the end
- Memory aids, mnemonics, and visualization tips
- At least 2000-3000 words of content
Be exhaustive — a student should be able to study ONLY from these notes.`,

  exam: `Create exam-focused study notes optimized for test preparation. Include:
- Key definitions in blockquotes with precise wording
- All formulas with variable explanations
- "Likely Exam Questions" sections after each topic
- Quick-recall tables for comparing concepts
- Highlighted "Must Remember" points in bold
- Common exam traps and how to avoid them
- Step-by-step problem-solving frameworks
- Summary tables and comparison charts
- Practice question hints at the end
- At least 2000 words of focused content`,

  simple: `Create clear, beginner-friendly study notes. Include:
- Simple language — explain like teaching a friend
- Lots of real-world analogies and examples
- Visual descriptions (describe diagrams in words)
- "Think of it this way..." sections for hard concepts
- Key takeaways in bold
- Short paragraphs with plenty of whitespace
- Step-by-step breakdowns of processes
- "In simple terms..." summaries after complex sections
- Recap at the end with the 5 most important points
- At least 1800 words of content`,

  cornell: `Create notes in Cornell Method format. Structure:
## Main Topic

| Cues / Questions | Notes |
|---|---|
| Key question 1 | Detailed answer with examples |
| Key question 2 | Detailed answer with examples |

### Summary
Concise summary paragraph.

Follow this format for EVERY major section. Include:
- Thoughtful cue questions that test understanding
- Detailed notes with examples and connections
- Comprehensive summaries
- At least 2000 words of content`,
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

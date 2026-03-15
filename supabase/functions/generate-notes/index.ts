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
- Practice question hints at the end`,

  simple: `Create clear, beginner-friendly study notes. Include:
- Simple language — explain like teaching a friend
- Lots of real-world analogies and examples
- Visual descriptions (describe diagrams in words)
- "Think of it this way..." sections for hard concepts
- Key takeaways in bold
- Short paragraphs with plenty of whitespace
- Step-by-step breakdowns of processes
- "In simple terms..." summaries after complex sections
- Recap at the end with the 5 most important points`,

  cornell: `Create notes using the Cornell Method. Use this EXACT format for each major section:

## [Section Title]

### Cues & Questions
- **Q: [Key question about this section]**
- **Q: [Another important question]**
- **Q: [Testing question]**

### Notes
[Detailed notes with examples, bullet points, and explanations. Each note should be 2-3 sentences with supporting details.]

- **Key Point 1:** Detailed explanation with example
- **Key Point 2:** Detailed explanation with example
- **Key Point 3:** Detailed explanation with example

### Section Summary
> [2-3 sentence concise summary of this section's key ideas]

---

Repeat this structure for EVERY major topic. At the very end, include:

## 📋 Master Summary
> [Comprehensive summary of ALL sections in one paragraph]

IMPORTANT: Use proper spacing between sections. Each section must have Cues, Notes, AND Summary. Do NOT pack everything into one block.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic, sourceText, style, isRefinement } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    const stylePrompt = STYLE_PROMPTS[style || "detailed"] || STYLE_PROMPTS.detailed;

    const systemPrompt = isRefinement
      ? `You are a study notes assistant. The user wants to refine their existing notes. Follow their instructions precisely. Maintain the same style and format but apply the requested changes. Output the COMPLETE updated notes, not just the changes. Use markdown formatting.`
      : `You are a premium study notes generator. Create the most comprehensive, well-organized, and pedagogically effective study notes possible.

${stylePrompt}

CRITICAL RULES:
- Be THOROUGH. Cover every concept mentioned.
- Use markdown formatting extensively with proper spacing.
- Never skip details.
- Include transitions between sections for reading flow.
- Add "💡 Key Insight" callouts for important points.
- The notes should be LONG and DETAILED enough that a student never needs to refer back to the original source.
- Use clean formatting with proper line breaks between sections.
- Do NOT reference NotebookLM or any other product.`;

    const userContent = sourceText
      ? sourceText
      : `Create comprehensive study notes on "${topic}".`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const errText = await response.text();
      console.error("generate-notes error:", status, errText);
      return new Response(JSON.stringify({ error: status === 429 ? "Rate limited, try again." : status === 402 ? "Credits required." : "Failed to generate notes" }), {
        status: status === 429 ? 429 : status === 402 ? 402 : 500,
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

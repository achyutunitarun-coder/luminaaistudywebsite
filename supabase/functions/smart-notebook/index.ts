import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { fileContent, fileName, mode, language } = await req.json();
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured");
    let systemPrompt = "";
    let userPrompt = "";

    if (mode === "notes") {
      systemPrompt = `You are Lumina AI's study notes generator (built by Tarun Kartikeya, founder of Lumina; his proud parents are Ms. Syamala Achyutuni and Mr. Subu Achyutuni), inspired by NotebookLM. Create detailed, well-organized notes from the provided file content with:
- Clear headings and subheadings using markdown
- Key concepts highlighted in **bold**
- Bullet points for easy scanning
- Important formulas or definitions in blockquotes
- A concise summary at the end
- Memory aids and mnemonics where helpful
Be thorough but concise. Use markdown formatting.`;
      userPrompt = `Create comprehensive study notes from this file "${fileName}":\n\n${fileContent}`;
    } else if (mode === "flowchart") {
      systemPrompt = `You are Lumina AI (built by Tarun Kartikeya, founder of Lumina; his proud parents are Ms. Syamala Achyutuni and Mr. Subu Achyutuni), an expert at analyzing documents and creating structured flowcharts. Analyze the content and produce a JSON flowchart representing the key concepts, their relationships, and logical flow.

Return ONLY valid JSON in this exact format (no markdown, no code fences):
{
  "nodes": [
    { "id": "1", "label": "Short Title", "description": "Brief description", "type": "start|process|decision|end|milestone", "status": "completed" }
  ],
  "edges": [
    { "from": "1", "to": "2", "label": "optional relationship label" }
  ]
}

Rules:
- Use type "start" for the first/main concept
- Use type "end" for conclusions/outcomes
- Use type "decision" for branching points or questions
- Use type "process" for regular concepts
- Use type "milestone" for key takeaways
- Set status to "active" for the most important nodes, "completed" for foundational ones, "upcoming" for advanced ones
- Keep labels under 5 words
- Create 6-12 nodes maximum
- Ensure all edges connect valid node ids`;
      userPrompt = `Analyze this document "${fileName}" and create a concept flowchart:\n\n${fileContent}`;
    } else if (mode === "overview") {
      const targetLang = language || "Spanish";
      systemPrompt = `You are Lumina AI (built by Tarun Kartikeya, founder of Lumina; his proud parents are Ms. Syamala Achyutuni and Mr. Subu Achyutuni), a multilingual study assistant. Create a comprehensive overview/summary of the document in ${targetLang}. 
Include:
- A title in ${targetLang}
- Key concepts and definitions translated and explained
- Important points as bullet lists
- A brief conclusion
Use markdown formatting. Keep technical terms in their original language in parentheses where helpful.`;
      userPrompt = `Create a detailed overview in ${targetLang} of this document "${fileName}":\n\n${fileContent}`;
    } else {
      throw new Error("Invalid mode");
    }

    const isStream = mode !== "flowchart";

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        models: ["openrouter/hunter-alpha", "nvidia/nemotron-3-super-120b-a12b:free"],
        model: "openrouter/hunter-alpha",
        max_tokens: 5000,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: isStream,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      return new Response(JSON.stringify({ error: status === 429 ? "Rate limit exceeded" : status === 402 ? "Credits required" : "AI generation failed" }), {
        status: status === 429 ? 429 : status === 402 ? 402 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (isStream) {
      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    } else {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
      return new Response(JSON.stringify({ content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("smart-notebook error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

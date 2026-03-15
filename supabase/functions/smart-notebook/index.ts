import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { fileContent, fileName, mode, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    let systemPrompt = "";
    let userPrompt = "";

    if (mode === "notes") {
      systemPrompt = `You are a study notes generator. Create detailed, well-organized notes from the provided file content with:
- Clear headings and subheadings using markdown
- Key concepts highlighted in **bold**
- Bullet points for easy scanning
- Important formulas or definitions in blockquotes
- A concise summary at the end
- Memory aids and mnemonics where helpful
Be thorough but concise. Use markdown formatting.`;
      userPrompt = `Create comprehensive study notes from this file "${fileName}":\n\n${fileContent}`;
    } else if (mode === "flowchart") {
      systemPrompt = `You are an expert at analyzing documents and creating structured flowcharts. Analyze the content and produce a JSON flowchart.

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
- Use type "decision" for branching points
- Use type "process" for regular concepts
- Use type "milestone" for key takeaways
- Keep labels under 5 words
- Create 6-12 nodes maximum`;
      userPrompt = `Analyze this document "${fileName}" and create a concept flowchart:\n\n${fileContent}`;
    } else if (mode === "overview") {
      const targetLang = language || "Spanish";
      systemPrompt = `You are a multilingual study assistant. Create a comprehensive overview/summary of the document in ${targetLang}. 
Include:
- A title in ${targetLang}
- Key concepts and definitions translated and explained
- Important points as bullet lists
- A brief conclusion
Use markdown formatting.`;
      userPrompt = `Create a detailed overview in ${targetLang} of this document "${fileName}":\n\n${fileContent}`;
    } else {
      throw new Error("Invalid mode");
    }

    const isStream = mode !== "flowchart";

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

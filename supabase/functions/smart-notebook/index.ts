import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { fileContent, fileName, mode, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt = "";
    let userPrompt = "";

    if (mode === "notes") {
      systemPrompt = `You are Lumina AI's study notes generator. Create detailed, well-organized notes with clear headings, key concepts in bold, bullet points, and a concise summary. Use markdown formatting.`;
      userPrompt = `Create comprehensive study notes from this file "${fileName}":\n\n${fileContent}`;
    } else if (mode === "flowchart") {
      systemPrompt = `Analyze the content and produce a JSON flowchart. Return ONLY valid JSON (no markdown, no code fences): {"nodes": [{"id": "1", "label": "Short Title", "description": "Brief description", "type": "start", "status": "completed"}], "edges": [{"from": "1", "to": "2", "label": "relationship"}]}. Use types: start, process, decision, end, milestone. Create 6-12 nodes.`;
      userPrompt = `Analyze "${fileName}" and create a concept flowchart:\n\n${fileContent}`;
    } else if (mode === "overview") {
      const targetLang = language || "Spanish";
      systemPrompt = `Create a comprehensive overview/summary in ${targetLang}. Include key concepts, important points as bullet lists, and a conclusion. Use markdown. Keep technical terms in original language in parentheses.`;
      userPrompt = `Create a detailed overview in ${targetLang} of "${fileName}":\n\n${fileContent}`;
    } else {
      throw new Error("Invalid mode");
    }

    const isStream = mode !== "flowchart";

    const response = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        stream: isStream,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      return new Response(JSON.stringify({ error: status === 429 ? "Rate limit exceeded" : "AI generation failed" }), {
        status: status === 429 ? 429 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (isStream) {
      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      });
    } else {
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || "";
      return new Response(JSON.stringify({ content: text.trim() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("smart-notebook error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

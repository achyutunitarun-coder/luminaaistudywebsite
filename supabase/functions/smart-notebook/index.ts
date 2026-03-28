import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HF_MODEL = "iamdago/Lumina-Ultimate";
const HF_API_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { fileContent, fileName, mode, language } = await req.json();
    const HF_TOKEN = Deno.env.get("HF_TOKEN");
    if (!HF_TOKEN) throw new Error("HF_TOKEN not set");

    let prompt = "";

    if (mode === "notes") {
      prompt = `You are Lumina AI's study notes generator. Create detailed, well-organized notes with clear headings, key concepts in bold, bullet points, and a concise summary. Use markdown formatting.

Create comprehensive study notes from this file "${fileName}":

${fileContent}

Notes:`;
    } else if (mode === "flowchart") {
      prompt = `Analyze the content and produce a JSON flowchart. Return ONLY valid JSON (no markdown, no code fences): {"nodes": [{"id": "1", "label": "Short Title", "description": "Brief description", "type": "start", "status": "completed"}], "edges": [{"from": "1", "to": "2", "label": "relationship"}]}. Use types: start, process, decision, end, milestone. Create 6-12 nodes.

Analyze "${fileName}" and create a concept flowchart:

${fileContent}

JSON:`;
    } else if (mode === "overview") {
      const targetLang = language || "Spanish";
      prompt = `Create a comprehensive overview/summary in ${targetLang}. Include key concepts, important points as bullet lists, and a conclusion. Use markdown. Keep technical terms in original language in parentheses.

Create a detailed overview in ${targetLang} of "${fileName}":

${fileContent}

Overview:`;
    } else {
      throw new Error("Invalid mode");
    }

    const response = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { max_new_tokens: 2000, temperature: 0.6, return_full_text: false },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(JSON.stringify({ error: err }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const text = data?.[0]?.generated_text || "";

    if (mode === "flowchart") {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return new Response(JSON.stringify({ content: jsonMatch[0] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ content: text.trim() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For notes and overview, return OpenAI-compatible format
    return new Response(
      JSON.stringify({ choices: [{ message: { content: text.trim() } }] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("smart-notebook error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

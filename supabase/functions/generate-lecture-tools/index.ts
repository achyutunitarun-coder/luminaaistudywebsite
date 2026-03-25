import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { notes, type } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const prompts: Record<string, string> = {
      flashcards: `From these lecture notes, generate 10-15 flashcards. Return ONLY valid JSON array: [{"front": "question", "back": "answer"}]. No other text.\n\nNotes:\n${notes}`,
      quiz: `From these lecture notes, generate 8-10 MCQ quiz questions. Return ONLY valid JSON array: [{"question": "...", "options": ["A","B","C","D"], "correct": 0, "explanation": "..."}]. No other text.\n\nNotes:\n${notes}`,
      summary: `Create a condensed "Exam Revision" summary from these notes. Use bullet points, bold key terms, keep under 500 words.\n\nNotes:\n${notes}`,
    };

    const isStreaming = type === "summary";

    const response = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        stream: isStreaming,
        messages: [
          { role: "system", content: "You are Lumina AI's study tool generator." },
          { role: "user", content: prompts[type] || prompts.summary },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      return new Response(JSON.stringify({ error: status === 429 ? "Rate limited" : "AI error" }), {
        status: status === 429 ? 429 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (isStreaming) {
      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    return new Response(JSON.stringify({ content: text.trim() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-lecture-tools error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

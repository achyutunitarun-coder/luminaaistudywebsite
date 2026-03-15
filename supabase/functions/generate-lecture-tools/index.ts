import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { notes, type } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    const prompts: Record<string, string> = {
      flashcards: `From these lecture notes, generate 10-15 flashcards. Return valid JSON array: [{"front": "question", "back": "answer"}]. Only return the JSON, no other text.\n\nNotes:\n${notes}`,
      quiz: `From these lecture notes, generate 8-10 multiple choice quiz questions. Return valid JSON array: [{"question": "...", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "..."}] where correct is the 0-based index. Only return the JSON.\n\nNotes:\n${notes}`,
      summary: `Create a condensed "Exam Revision" summary from these notes. Use bullet points, bold key terms, and keep it under 500 words. Focus on what's most likely to appear on an exam.\n\nNotes:\n${notes}`,
    };

    const systemPrompt = type === "summary"
      ? "You are an exam revision expert. Create focused, exam-ready study material."
      : "You are a study tool generator. Generate structured study materials from lecture notes.";

    const isStreaming = type === "summary";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompts[type] || prompts.summary },
        ],
        stream: isStreaming,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      return new Response(JSON.stringify({ error: status === 429 ? "Rate limited" : status === 402 ? "Credits required" : "AI error" }), {
        status: status === 429 ? 429 : status === 402 ? 402 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (isStreaming) {
      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-lecture-tools error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

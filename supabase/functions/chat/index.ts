import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, memoryContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    let systemPrompt = `You are Lumina AI, an expert study tutor. You help students understand concepts deeply. You provide:
- Clear explanations with examples
- Step-by-step solutions for math/science problems
- Diagrams described in text when useful
- Practice questions after explanations
- Encourage and motivate students
Keep responses well-structured using markdown. Be concise but thorough.`;

    if (memoryContext && memoryContext.length > 0) {
      systemPrompt += `\n\n## Memory from past conversations\n`;
      for (const conv of memoryContext) {
        systemPrompt += `### "${conv.title}"\n`;
        for (const msg of conv.messages) {
          systemPrompt += `${msg.role === 'user' ? 'Student' : 'Lumina'}: ${msg.content}\n`;
        }
        systemPrompt += '\n';
      }
    }

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
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const rawError = await response.text();
      let providerMessage = "";
      try {
        const parsed = JSON.parse(rawError);
        providerMessage = parsed?.error?.message || parsed?.error || "";
      } catch {
        providerMessage = rawError;
      }

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: providerMessage || "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: providerMessage || "This request needs more available credits or fewer max_tokens." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI provider error:", response.status, rawError);
      return new Response(JSON.stringify({ error: providerMessage || "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
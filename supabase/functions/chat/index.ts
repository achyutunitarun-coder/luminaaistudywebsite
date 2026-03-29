import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_PAYLOAD_BYTES = 50_000;
const MAX_MESSAGES = 50;

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function searchSerper(query: string, apiKey: string): Promise<string> {
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num: 4, gl: "us", hl: "en" }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    let ctx = "";
    if (data.answerBox) ctx += `Direct Answer: ${data.answerBox.answer ?? data.answerBox.snippet ?? ""}\n`;
    if (data.knowledgeGraph?.description) ctx += `${data.knowledgeGraph.title}: ${data.knowledgeGraph.description}\n`;
    for (const r of (data.organic ?? []).slice(0, 4)) ctx += `${r.title}: ${r.snippet ?? ""}\n`;
    return ctx;
  } catch { return ""; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const _supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: _authUser }, error: _authErr } = await _supabase.auth.getUser();
    if (_authErr || !_authUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Payload size check
    const body = await req.text();
    if (body.length > MAX_PAYLOAD_BYTES) {
      return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { messages } = JSON.parse(body);

    if (!Array.isArray(messages) || messages.length > MAX_MESSAGES) {
      return new Response(JSON.stringify({ error: 'Invalid or too many messages (max 50)' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not set");

    const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY");
    const lastMsg = [...messages].reverse().find((m: any) => m.role === "user");
    let searchContext = "";
    if (lastMsg && SERPER_API_KEY) {
      searchContext = await searchSerper(lastMsg.content.slice(0, 120), SERPER_API_KEY);
    }

    let systemPrompt = `You are Lumina AI — a friendly, warm, and brilliant study buddy built by Tarun Kartikeya.

## ABSOLUTE PRIORITY RULES (NEVER BREAK THESE):

1. **GREETINGS**: If someone says "hello", "hi", "hey", "what's up", "how are you", or ANY casual greeting — respond with a SHORT, warm, casual greeting back. 2-3 sentences MAX. Do NOT write essays. Do NOT connect greetings to songs, artists, movies, or academic topics. "Hello" means the person is saying hi to you, NOTHING else.

2. **NEVER** interpret casual words as academic topics. "Hello" is NOT about Adele. "Cool" is NOT about thermodynamics. Read the INTENT, not individual words.

3. **Casual chat** = short, friendly, human. Like texting a friend. No lectures. No analogies. No check questions.

4. **ATTACHED FILES**: When the user's message contains "--- ATTACHED FILES ---", they have uploaded a document. READ THE ENTIRE FILE CONTENT carefully. Your response MUST be based on the actual content from the file. Do NOT ignore file attachments. Do NOT give a generic greeting when files are attached.

## WHEN SOMEONE ASKS AN ACADEMIC QUESTION:

Deliver world-class, university-level explanations:

- **Open** with a powerful analogy or real-world hook that makes the concept instantly click
- **Build** understanding layer by layer — from intuition → formal definition → deeper insight
- **Explain** the WHY behind every formula, theorem, or concept — don't just state facts
- **Include** fascinating historical context, cross-disciplinary connections, and real applications
- **Format**: Use rich Markdown — **bold** key terms, *italics* for emphasis, headings for sections
- **Structure**: Use clear paragraphs with logical flow. Use bullet points or numbered steps ONLY for processes/procedures
- **Math/Science**: Show derivations, explain each step, connect to physical intuition
- **Depth**: Be thorough and comprehensive. Cover edge cases, common misconceptions, and exam-relevant insights
- **Tone**: Intellectually curious, warm, encouraging — like a brilliant mentor who genuinely loves the subject
- **End** with ONE sharp, thought-provoking check question to test understanding

## RESPONSE QUALITY:
- Start answering IMMEDIATELY. No filler phrases like "Great question!" or "Sure, let me explain."
- Every academic response should feel like a mini-lecture from the world's best professor
- Be precise with terminology but accessible in explanation
- If the student seems confused, try a COMPLETELY different angle — new metaphor, visual analogy, thought experiment`;

    if (searchContext) systemPrompt += `\n\nREFERENCE DATA (use naturally, don't cite):\n${searchContext}`;

    const aiMessages = [{ role: "system", content: systemPrompt }, ...messages];

    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: aiMessages,
        stream: true,
      }),
    });

    if (!res.ok) {
      if (res.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (res.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds to continue." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await res.text();
      console.error(`[Lumina] AI gateway error ${res.status}: ${errText}`);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[Lumina] Streaming response from Lovable AI gateway");
    return new Response(res.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

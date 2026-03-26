import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const HF_MODEL = "iamdago/Lumina-Ultimate";
const HF_API_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();

    const HF_TOKEN = Deno.env.get("HF_TOKEN");
    if (!HF_TOKEN) throw new Error("HF_TOKEN not set");

    // 🧠 SYSTEM PROMPT
    const systemPrompt = `You are Lumina AI — the smartest, most supportive study companion a student could have.

## RESPONSE STYLE
Write in clear flowing paragraphs. No bullet points. No lists. Be natural and helpful.

## SPEED
Start answering immediately. No filler.

## TEACHING STYLE
Explain simply first, then build up. Always help the student understand deeply.

## ENDING
Always end with a short check question.`;

    // 🧱 Convert messages → prompt
    let prompt = systemPrompt + "\n\n";

    for (const msg of messages) {
      if (msg.role === "user") {
        prompt += `User: ${msg.content}\n`;
      } else if (msg.role === "assistant") {
        prompt += `Lumina: ${msg.content}\n`;
      }
    }

    prompt += "Lumina:";

    // 🚀 CALL YOUR MODEL
    const response = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 300,
          temperature: 0.7,
          return_full_text: false
        }
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("HF ERROR:", err);
      return new Response(JSON.stringify({ error: "Model failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    // 🧠 Extract response safely
    const output =
      data?.[0]?.generated_text ||
      "Sorry, I couldn't generate a response.";

    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: output,
            },
          },
        ],
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: unknown) {
    console.error("ERROR:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

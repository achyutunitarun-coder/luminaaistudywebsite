import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;
    if (!audioFile) throw new Error("No audio file provided");

    const arrayBuffer = await audioFile.arrayBuffer();
    const base64Audio = base64Encode(arrayBuffer);

    // Determine mime type
    const name = audioFile.name.toLowerCase();
    let mimeType = "audio/webm";
    if (name.endsWith(".mp3")) mimeType = "audio/mpeg";
    else if (name.endsWith(".wav")) mimeType = "audio/wav";
    else if (name.endsWith(".m4a")) mimeType = "audio/mp4";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a precise audio transcription engine. Your task:
1. Transcribe ALL spoken words from the audio accurately, even if the speaker is quiet or there's background noise.
2. Output a JSON object with this exact structure:
{
  "text": "full transcript text here",
  "words": [
    {"text": "word", "start": 0.0, "end": 0.5, "speaker": "A"},
    ...
  ]
}
3. If you can distinguish different speakers, label them "A", "B", etc.
4. Estimate timestamps in seconds for each word/phrase group (groups of 5-10 words are fine).
5. Include EVERYTHING said - don't skip quiet parts or mumbling. Do your best to capture it.
6. Output ONLY the JSON, no markdown, no code blocks, no explanation.`,
          },
          {
            role: "user",
            content: [
              {
                type: "input_audio",
                input_audio: {
                  data: base64Audio,
                  format: mimeType === "audio/wav" ? "wav" : "mp3",
                },
              },
              {
                type: "text",
                text: "Transcribe this audio completely. The speaker may be quiet - capture everything.",
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const errText = await response.text();
      console.error("AI transcription error:", status, errText);
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Transcription failed: ${status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse the JSON response
    let transcript;
    try {
      // Try to extract JSON from possible code blocks
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        transcript = JSON.parse(jsonMatch[0]);
      } else {
        transcript = { text: content, words: [] };
      }
    } catch {
      transcript = { text: content, words: [] };
    }

    return new Response(JSON.stringify(transcript), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("transcribe-lecture error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

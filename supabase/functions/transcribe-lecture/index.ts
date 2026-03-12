import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
    const json = atob(padded);

    return JSON.parse(json);
  } catch {
    return null;
  }
};

const extractUserId = (authHeader: string | null): string => {
  const token = authHeader?.replace("Bearer ", "").trim() || "";
  if (token.split(".").length === 3) {
    const payload = decodeJwtPayload(token);
    const sub = typeof payload?.sub === "string" ? payload.sub : null;
    if (sub && UUID_REGEX.test(sub)) return sub;
  }

  return crypto.randomUUID();
};

async function processTranscription(jobId: string, base64Audio: string, mimeType: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
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
      const errText = await response.text();
      throw new Error(`Transcription API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let transcript;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      transcript = jsonMatch ? JSON.parse(jsonMatch[0]) : { text: content, words: [] };
    } catch {
      transcript = { text: content, words: [] };
    }

    await supabase
      .from("transcription_jobs")
      .update({ status: "complete", result: transcript })
      .eq("id", jobId);
  } catch (e) {
    console.error("Background transcription error:", e);
    await supabase
      .from("transcription_jobs")
      .update({ status: "failed", error: e instanceof Error ? e.message : "Unknown error" })
      .eq("id", jobId);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const jobId = url.searchParams.get("job_id");

    if (jobId) {
      const { data, error } = await supabase
        .from("transcription_jobs")
        .select("status, result, error")
        .eq("id", jobId)
        .single();

      if (error) throw new Error("Job not found");

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) throw new Error("No audio file provided");
    if (audioFile.size === 0) throw new Error("Audio file is empty");

    const userId = extractUserId(req.headers.get("authorization"));

    const arrayBuffer = await audioFile.arrayBuffer();
    const base64Audio = base64Encode(new Uint8Array(arrayBuffer));

    const fileType = (audioFile.type || "").toLowerCase();
    const name = audioFile.name.toLowerCase();

    let mimeType = "audio/webm";
    if (fileType.includes("wav") || name.endsWith(".wav")) mimeType = "audio/wav";
    else if (fileType.includes("mpeg") || name.endsWith(".mp3")) mimeType = "audio/mpeg";
    else if (fileType.includes("mp4") || name.endsWith(".m4a")) mimeType = "audio/mp4";

    const { data: job, error: insertError } = await supabase
      .from("transcription_jobs")
      .insert({ user_id: userId, status: "processing" })
      .select("id")
      .single();

    if (insertError || !job) {
      throw new Error(`Failed to create job: ${insertError?.message ?? "Unknown insert error"}`);
    }

    EdgeRuntime.waitUntil(processTranscription(job.id, base64Audio, mimeType));

    return new Response(JSON.stringify({ job_id: job.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("transcribe-lecture error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

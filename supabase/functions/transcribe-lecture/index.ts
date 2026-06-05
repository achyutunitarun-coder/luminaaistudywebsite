import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function processTranscription(jobId: string, audioBytes: Uint8Array, mimeType: string) {
  const DEEPGRAM_API_KEY = Deno.env.get("DEEPGRAM_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    if (!DEEPGRAM_API_KEY) throw new Error("DEEPGRAM_API_KEY is not configured");

    console.log(`[Job ${jobId}] Sending ${audioBytes.length} bytes to Deepgram (${mimeType})`);

    // Use Deepgram's listen API for real audio transcription
    const response = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&paragraphs=true&diarize=true&utterances=true&punctuate=true&language=en", {
      method: "POST",
      headers: {
        Authorization: `Token ${DEEPGRAM_API_KEY}`,
        "Content-Type": mimeType,
      },
      body: audioBytes as unknown as BodyInit,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Deepgram API error:", response.status, errText);
      
      let errorMessage = `Transcription failed (${response.status})`;
      try {
        const parsed = JSON.parse(errText);
        errorMessage = parsed?.err_msg || parsed?.error || errorMessage;
      } catch {}
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log(`[Job ${jobId}] Deepgram response received`);

    // Extract transcript from Deepgram response
    const channel = data.results?.channels?.[0];
    const alternatives = channel?.alternatives?.[0];
    const fullText = alternatives?.transcript || "";
    
    // Build word-level timestamps from utterances or paragraphs
    const words: Array<{ text: string; start: number; end: number; speaker: string }> = [];
    
    if (data.results?.utterances) {
      for (const utt of data.results.utterances) {
        words.push({
          text: utt.transcript,
          start: utt.start,
          end: utt.end,
          speaker: String.fromCharCode(65 + (utt.speaker || 0)), // 0 -> "A", 1 -> "B"
        });
      }
    } else if (alternatives?.words) {
      // Group words into phrases
      let phrase = { text: "", start: 0, end: 0, speaker: "A" };
      let wordCount = 0;
      
      for (const w of alternatives.words) {
        if (wordCount === 0) {
          phrase.start = w.start;
          phrase.speaker = String.fromCharCode(65 + (w.speaker || 0));
        }
        phrase.text += (phrase.text ? " " : "") + w.punctuated_word || w.word;
        phrase.end = w.end;
        wordCount++;
        
        if (wordCount >= 12 || w.punctuated_word?.endsWith(".") || w.punctuated_word?.endsWith("?")) {
          words.push({ ...phrase });
          phrase = { text: "", start: 0, end: 0, speaker: "A" };
          wordCount = 0;
        }
      }
      if (phrase.text) words.push(phrase);
    }

    const transcript = { text: fullText, words };

    await supabase
      .from("transcription_jobs")
      .update({ status: "complete", result: transcript })
      .eq("id", jobId);
      
    console.log(`[Job ${jobId}] Complete. Text length: ${fullText.length}`);
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
    const _auth = await requireUser(req, corsHeaders);
    if ("error" in _auth) return _auth.error;
    const userId = _auth.user.id;

    const DEEPGRAM_API_KEY = Deno.env.get("DEEPGRAM_API_KEY");
    if (!DEEPGRAM_API_KEY) throw new Error("DEEPGRAM_API_KEY is not configured. Please add your Deepgram API key.");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const jobId = url.searchParams.get("job_id");

    // Poll for job status — must belong to caller
    if (jobId) {
      const { data, error } = await supabase
        .from("transcription_jobs")
        .select("status, result, error")
        .eq("id", jobId)
        .eq("user_id", userId)
        .single();
      if (error) return new Response(JSON.stringify({ error: "Job not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contentLength = Number(req.headers.get("content-length") ?? 0);
    const maxRequestBytes = 25 * 1024 * 1024;
    if (Number.isFinite(contentLength) && contentLength > maxRequestBytes) {
      return new Response(
        JSON.stringify({ error: "Audio chunk too large (max 25MB)." }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    if (!audioFile) throw new Error("No audio file provided");
    if (audioFile.size === 0) throw new Error("Audio file is empty");



    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBytes = new Uint8Array(arrayBuffer);

    const fileType = (audioFile.type || "").toLowerCase();
    const name = audioFile.name.toLowerCase();

    let mimeType = "audio/webm";
    if (fileType.includes("wav") || name.endsWith(".wav")) mimeType = "audio/wav";
    else if (fileType.includes("mpeg") || name.endsWith(".mp3")) mimeType = "audio/mpeg";
    else if (fileType.includes("mp4") || name.endsWith(".m4a")) mimeType = "audio/mp4";
    else if (fileType.includes("ogg") || name.endsWith(".ogg")) mimeType = "audio/ogg";
    else if (fileType.includes("flac") || name.endsWith(".flac")) mimeType = "audio/flac";

    const { data: job, error: insertError } = await supabase
      .from("transcription_jobs")
      .insert({ user_id: userId, status: "processing" })
      .select("id")
      .single();

    if (insertError || !job) {
      throw new Error(`Failed to create job: ${insertError?.message ?? "Unknown insert error"}`);
    }

    // Process in background
    // Process in background (fire-and-forget)
    processTranscription(job.id, audioBytes, mimeType).catch(console.error);

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

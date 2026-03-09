import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

async function getTranscript(videoId: string): Promise<string> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const res = await fetch(watchUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });
  const html = await res.text();

  // Extract title
  const titleMatch = html.match(/<title>(.+?)<\/title>/);
  const title = titleMatch ? titleMatch[1].replace(" - YouTube", "").trim() : "Unknown";

  // Try to get captions URL from player response
  const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
  if (captionMatch) {
    try {
      const tracks = JSON.parse(captionMatch[1]);
      if (tracks.length > 0) {
        // Prefer English, fall back to first track
        const enTrack = tracks.find((t: any) => t.languageCode === "en") || tracks[0];
        const captionUrl = enTrack.baseUrl.replace(/\\u0026/g, "&");
        const capRes = await fetch(captionUrl);
        const capXml = await capRes.text();
        // Parse XML captions
        const textParts = capXml.match(/<text[^>]*>(.*?)<\/text>/gs) || [];
        const transcript = textParts
          .map((t: string) => t.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"'))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        if (transcript) {
          return `Title: ${title}\n\nTranscript:\n${transcript}`;
        }
      }
    } catch (e) {
      console.error("Caption parse error:", e);
    }
  }

  // Fallback: extract description from meta
  const descMatch = html.match(/property="og:description"\s+content="([^"]*)/);
  const description = descMatch ? descMatch[1] : "";

  if (description) {
    return `Title: ${title}\n\nDescription: ${description}\n\n(No transcript available — summary based on available metadata)`;
  }

  return `Title: ${title}\n\n(No transcript or description available)`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { url } = await req.json();
    if (!url) throw new Error("YouTube URL is required");

    const videoId = extractVideoId(url);
    if (!videoId) throw new Error("Invalid YouTube URL");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const content = await getTranscript(videoId);
    console.log("Transcript length:", content.length);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are Lumina AI's video summarizer, built by Tarun Kartikeya (founder of Lumina). Given a YouTube video's transcript (or metadata), create a comprehensive summary with:
- **Video Overview**: 2-3 sentence summary
- **Key Points**: Bullet points of main ideas
- **Detailed Summary**: Organized by topics/sections
- **Key Takeaways**: Most important lessons or facts
- **Notable Quotes**: If any stand out from the transcript

Use markdown formatting. Be thorough but concise. If only metadata is available (no transcript), acknowledge this limitation and provide what you can.`,
          },
          { role: "user", content: `Summarize this YouTube video:\n\n${content.substring(0, 30000)}` },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      return new Response(
        JSON.stringify({ error: status === 429 ? "Rate limit exceeded, try again later." : status === 402 ? "Payment required." : "Failed to generate summary" }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("youtube-summary error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

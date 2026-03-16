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
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

async function fetchTranscriptFromInnerTube(videoId: string): Promise<{ title: string; description: string; transcript: string }> {
  let title = "Unknown";
  let description = "";
  let transcript = "";

  // Method 1: InnerTube Player API
  try {
    const playerRes = await fetch("https://www.youtube.com/youtubei/v1/player", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: {
          client: { clientName: "WEB", clientVersion: "2.20240101.00.00", hl: "en" },
        },
        videoId,
      }),
    });

    if (playerRes.ok) {
      const playerData = await playerRes.json();
      title = playerData?.videoDetails?.title || title;
      description = playerData?.videoDetails?.shortDescription || "";

      const captionTracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (captionTracks && captionTracks.length > 0) {
        const enTrack = captionTracks.find((t: any) => t.languageCode === "en" && !t.kind)
          || captionTracks.find((t: any) => t.languageCode === "en")
          || captionTracks[0];

        if (enTrack?.baseUrl) {
          const capUrl = enTrack.baseUrl + "&fmt=srv3";
          const capRes = await fetch(capUrl);
          if (capRes.ok) {
            const capXml = await capRes.text();
            const textParts = capXml.match(/<text[^>]*>([\s\S]*?)<\/text>/g) || [];
            transcript = textParts
              .map((t: string) =>
                t.replace(/<[^>]+>/g, "")
                  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
                  .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\n/g, " ")
              )
              .join(" ").replace(/\s+/g, " ").trim();
          }
        }
      }
    }
  } catch (e) {
    console.error("InnerTube error:", e);
  }

  // Method 2: HTML scrape fallback
  if (!transcript) {
    try {
      const watchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      const html = await watchRes.text();

      const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
      if (captionMatch) {
        const tracks = JSON.parse(captionMatch[1]);
        if (tracks.length > 0) {
          const enTrack = tracks.find((t: any) => t.languageCode === "en") || tracks[0];
          const capUrl = enTrack.baseUrl.replace(/\\u0026/g, "&");
          const capRes = await fetch(capUrl);
          if (capRes.ok) {
            const capXml = await capRes.text();
            const textParts = capXml.match(/<text[^>]*>([\s\S]*?)<\/text>/g) || [];
            transcript = textParts
              .map((t: string) =>
                t.replace(/<[^>]+>/g, "")
                  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
                  .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\n/g, " ")
              )
              .join(" ").replace(/\s+/g, " ").trim();
          }
        }
      }

      if (title === "Unknown") {
        const titleMatch = html.match(/<title>(.+?)<\/title>/);
        if (titleMatch) title = titleMatch[1].replace(" - YouTube", "").trim();
      }
      if (!description) {
        const descMatch = html.match(/property="og:description"\s+content="([^"]*)/);
        if (descMatch) description = descMatch[1];
      }
    } catch (e) {
      console.error("HTML scrape error:", e);
    }
  }

  // Method 3: oEmbed for title fallback
  if (title === "Unknown") {
    try {
      const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
      if (oembedRes.ok) {
        const oembed = await oembedRes.json();
        title = oembed.title || title;
      }
    } catch {}
  }

  return { title, description, transcript };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { url } = await req.json();
    if (!url) throw new Error("YouTube URL is required");

    const videoId = extractVideoId(url);
    if (!videoId) throw new Error("Invalid YouTube URL");

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured");

    const { title, description, transcript } = await fetchTranscriptFromInnerTube(videoId);

    console.log("Video:", title, "| Transcript length:", transcript.length, "| Description length:", description.length);

    // Build the content to send to AI — prioritize transcript
    let content = `Video Title: ${title}\n\n`;
    let hasFullContent = false;

    if (transcript && transcript.length > 100) {
      // Use full transcript, split into chunks if very long
      const maxChars = 60000;
      const trimmedTranscript = transcript.length > maxChars ? transcript.substring(0, maxChars) + "\n\n[Transcript truncated due to length]" : transcript;
      content += `Full Video Transcript:\n${trimmedTranscript}`;
      hasFullContent = true;
      console.log("Using full transcript for analysis");
    } else if (description && description.length > 50) {
      content += `Video Description:\n${description}\n\n⚠️ Note: No captions/transcript available for this video. This summary is based on the video description only, not the actual spoken content.`;
      console.log("Using description only — no transcript available");
    } else {
      content += `⚠️ No transcript or description available for this video. Only the title is known. The summary will be very limited.`;
      console.log("No transcript or description — title only");
    }

    const systemPrompt = hasFullContent
      ? `You are Lumina AI's video analyzer. You have the FULL TRANSCRIPT of this video. Create an extremely thorough, detailed summary:

## 📺 Video Overview
2-3 sentence summary of what the video covers.

## 🎯 Key Points
- Bullet points of every major idea discussed (aim for 10-15 points)

## 📝 Detailed Summary
Organize by topics/sections as they appear in the video. Be thorough — cover every important concept discussed. Use sub-headings for each section.

## 💡 Key Takeaways
The 5-7 most important lessons, facts, or insights from this video.

## 📌 Notable Quotes
Any memorable or impactful quotes from the video.

## 🔗 Topics Mentioned
List all specific topics, people, books, or resources mentioned.

Use markdown formatting. Be comprehensive — the user should not need to watch the video after reading this summary.`
      : `You are Lumina AI's video analyzer. Unfortunately, no transcript was available for this video. Summarize based on the available metadata (title and description). Be transparent about this limitation and provide what analysis you can. Suggest the user try a video with captions enabled for better results.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-r1:free",
        max_tokens: 6000,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyze and summarize this YouTube video thoroughly:\n\n${content}` },
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

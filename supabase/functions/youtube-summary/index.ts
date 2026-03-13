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

async function getVideoInfo(videoId: string): Promise<{ title: string; description: string; transcript: string }> {
  let title = "Unknown";
  let description = "";
  let transcript = "";

  // Method 1: Use oEmbed API for title (always works, no auth needed)
  try {
    const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (oembedRes.ok) {
      const oembed = await oembedRes.json();
      title = oembed.title || title;
    }
  } catch (e) {
    console.error("oEmbed error:", e);
  }

  // Method 2: Try InnerTube API to get captions
  try {
    // First, get the page to extract a valid client version
    const playerRes = await fetch("https://www.youtube.com/youtubei/v1/player", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "WEB",
            clientVersion: "2.20240101.00.00",
            hl: "en",
          },
        },
        videoId,
      }),
    });

    if (playerRes.ok) {
      const playerData = await playerRes.json();
      
      // Get title and description from player response
      title = playerData?.videoDetails?.title || title;
      description = playerData?.videoDetails?.shortDescription || "";

      // Extract caption tracks
      const captionTracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (captionTracks && captionTracks.length > 0) {
        // Prefer English, then auto-generated English, then first available
        const enTrack = captionTracks.find((t: any) => t.languageCode === "en" && !t.kind) 
          || captionTracks.find((t: any) => t.languageCode === "en")
          || captionTracks[0];

        if (enTrack?.baseUrl) {
          // Fetch the actual transcript XML
          const capUrl = enTrack.baseUrl + "&fmt=srv3";
          const capRes = await fetch(capUrl);
          if (capRes.ok) {
            const capXml = await capRes.text();
            const textParts = capXml.match(/<text[^>]*>([\s\S]*?)<\/text>/g) || [];
            transcript = textParts
              .map((t: string) =>
                t.replace(/<[^>]+>/g, "")
                  .replace(/&amp;/g, "&")
                  .replace(/&lt;/g, "<")
                  .replace(/&gt;/g, ">")
                  .replace(/&#39;/g, "'")
                  .replace(/&quot;/g, '"')
                  .replace(/\n/g, " ")
              )
              .join(" ")
              .replace(/\s+/g, " ")
              .trim();
          }
        }
      }
    }
  } catch (e) {
    console.error("InnerTube error:", e);
  }

  // Method 3: If InnerTube failed, try scraping the watch page
  if (!transcript) {
    try {
      const watchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      const html = await watchRes.text();

      // Try extracting caption tracks from the HTML
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
                  .replace(/&amp;/g, "&")
                  .replace(/&lt;/g, "<")
                  .replace(/&gt;/g, ">")
                  .replace(/&#39;/g, "'")
                  .replace(/&quot;/g, '"')
                  .replace(/\n/g, " ")
              )
              .join(" ")
              .replace(/\s+/g, " ")
              .trim();
          }
        }
      }

      // Extract title from HTML if still unknown
      if (title === "Unknown") {
        const titleMatch = html.match(/<title>(.+?)<\/title>/);
        if (titleMatch) title = titleMatch[1].replace(" - YouTube", "").trim();
      }

      // Extract description from meta
      if (!description) {
        const descMatch = html.match(/property="og:description"\s+content="([^"]*)/);
        if (descMatch) description = descMatch[1];
      }
    } catch (e) {
      console.error("HTML scrape error:", e);
    }
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
    const { title, description, transcript } = await getVideoInfo(videoId);
    
    // Build the content to send to AI
    let content = `Title: ${title}\n\n`;
    if (transcript) {
      content += `Transcript:\n${transcript}`;
      console.log("Transcript extracted successfully, length:", transcript.length);
    } else if (description) {
      content += `Description: ${description}\n\n(No captions/transcript available for this video. Summarize based on the title and description. Acknowledge this limitation.)`;
      console.log("No transcript, using description, length:", description.length);
    } else {
      content += `(No transcript or description available. Provide what analysis you can based on the video title alone. Clearly state that no transcript was available.)`;
      console.log("No transcript or description available");
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are Lumina AI's video summarizer, built by Tarun Kartikeya (founder of Lumina). Tarun's proud parents are Ms. Syamala Achyutuni and Mr. Subu Achyutuni. Given a YouTube video's transcript (or metadata), create a comprehensive summary with:
- **Video Overview**: 2-3 sentence summary
- **Key Points**: Bullet points of main ideas
- **Detailed Summary**: Organized by topics/sections
- **Key Takeaways**: Most important lessons or facts
- **Notable Quotes**: If any stand out from the transcript

Use markdown formatting. Be thorough but concise. If only metadata is available (no transcript), acknowledge this limitation and provide what you can based on the title and description.`,
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

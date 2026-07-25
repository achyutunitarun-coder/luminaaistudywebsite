export const config = {
  runtime: "edge",
};

export default async function handler(req: Request) {
  try {
    const { message } = await req.json();
    const token = process.env.HF_TOKEN;

    if (!token) {
      return new Response(
        JSON.stringify({ reply: "HF_TOKEN is not configured on this server." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const response = await fetch(
      "https://api-inference.huggingface.co/models/iamdago/Lumina-Ultimate",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: `You are Lumina, a helpful study AI.\nUser: ${message}\nLumina:`,
          parameters: {
            max_new_tokens: 200,
            temperature: 0.7,
            top_p: 0.9,
            return_full_text: false
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return new Response(
        JSON.stringify({ reply: `Hugging Face request failed: ${response.status} ${errorText}` }),
        { status: response.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    return new Response(
      JSON.stringify({
        reply: data?.[0]?.generated_text || "No response"
      }),
      { status: 200 }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ reply: message }),
      { status: 500 }
    );
  }
}

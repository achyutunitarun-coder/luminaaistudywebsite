export const config = {
  runtime: "edge",
};

export default async function handler(req: Request) {
  try {
    const { message } = await req.json();

    const response = await fetch(
      "https://api-inference.huggingface.co/models/iamdago/Lumina-Ultimate",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.HF_TOKEN}`,
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

    const data = await response.json();

    return new Response(
      JSON.stringify({
        reply: data?.[0]?.generated_text || "No response"
      }),
      { status: 200 }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ reply: err.message }),
      { status: 500 }
    );
  }
}

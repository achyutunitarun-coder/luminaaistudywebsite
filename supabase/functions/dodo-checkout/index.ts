// Creates a Dodo Payments checkout session for an exam pack product_id

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const DODO_API_KEY = Deno.env.get("DODO_API_KEY");
    if (!DODO_API_KEY) throw new Error("DODO_API_KEY not configured");

    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "No auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { product_id, pack_id, return_url } = await req.json();
    if (!product_id || !pack_id) {
      return new Response(JSON.stringify({ error: "Missing product_id or pack_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Insert pending unlock row
    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await service.from("user_unlocked_packs").upsert({
      user_id: user.id,
      pack_id,
      product_id,
      payment_status: "pending",
    }, { onConflict: "user_id,pack_id" });

    // Create Dodo payment link
    const dodoRes = await fetch("https://live.dodopayments.com/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DODO_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payment_link: true,
        product_cart: [{ product_id, quantity: 1 }],
        customer: { email: user.email, name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Student" },
        billing: { city: "NA", country: "IN", state: "NA", street: "NA", zipcode: "000000" },
        return_url: return_url || "https://luminaai.co.in/exam-packs",
        metadata: { user_id: user.id, pack_id, product_id },
      }),
    });

    if (!dodoRes.ok) {
      const errText = await dodoRes.text();
      console.error("Dodo error:", dodoRes.status, errText);
      return new Response(JSON.stringify({ error: `Dodo: ${dodoRes.status}`, detail: errText }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const dodoData = await dodoRes.json();
    const checkoutUrl = dodoData.payment_link || dodoData.checkout_url || dodoData.url;

    return new Response(JSON.stringify({ checkout_url: checkoutUrl, payment_id: dodoData.payment_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown";
    console.error("dodo-checkout error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

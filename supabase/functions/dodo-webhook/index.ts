import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  const secret = Deno.env.get("DODO_WEBHOOK_SECRET");
  if (!secret) {
    console.error("[dodo-webhook] DODO_WEBHOOK_SECRET not configured — rejecting all webhooks for safety");
    return false;
  }
  const id = req.headers.get("webhook-id");
  const timestamp = req.headers.get("webhook-timestamp");
  const sigHeader = req.headers.get("webhook-signature");
  if (!id || !timestamp || !sigHeader) return false;

  // Replay protection — reject events older than 5 minutes
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const signedPayload = `${id}.${timestamp}.${rawBody}`;
  // Secret format from Standard Webhooks: "whsec_<base64>"
  const secretBytes = secret.startsWith("whsec_")
    ? Uint8Array.from(atob(secret.slice(6)), (c) => c.charCodeAt(0))
    : new TextEncoder().encode(secret);
  const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const macBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const expected = btoa(String.fromCharCode(...new Uint8Array(macBuf)));
  // Header looks like "v1,<base64sig> v1,<base64sig> ..."
  return sigHeader.split(" ").some((part) => {
    const [, sig] = part.split(",");
    return sig && sig === expected;
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    const valid = await verifySignature(req, rawBody);
    if (!valid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const payload = JSON.parse(rawBody);
    const { type, data } = payload;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Extract customer email from Dodo payload
    const customerEmail = data?.customer?.email || data?.customer_email || data?.email;
    const subscriptionId = data?.subscription_id || data?.subscription?.id || data?.id;
    const status = String(data?.status || data?.payment_status || '').toLowerCase();
    const paymentId = data?.payment_id || data?.payment?.id || data?.order_id || data?.id;
    const productId = data?.product_id || data?.product?.id || data?.items?.[0]?.product_id || data?.items?.[0]?.product?.id || '';

    // Determine plan tier from product ID
    const ULTIMATE_PRODUCT_ID = 'pdt_0NbKNHJ5nK556qajM5MKa';
    const PRO_PLUS_PRODUCT_ID = 'pdt_0Nbybrhl2M0GdzScdoAwb';
    let planTier = 'ultimate'; // default paid subscription tier
    if (productId === PRO_PLUS_PRODUCT_ID) planTier = 'pro_plus';
    const CREDIT_PRODUCTS: Record<string, number> = {
      pdt_0NdcF1gd6Z5PBeFx8gbiE: 30,
      pdt_0NdcF1o3DQYEdtVQBA8MG: 100,
      pdt_0NdcF1rKPidZVQ4vdzt5u: 300,
      pdt_0NdcF1ua83g4FRUO1LhKt: 800,
      pdt_0NbKNHJ5nK556qajM5MKa: 40,
      pdt_0Nbybrhl2M0GdzScdoAwb: 150,
    };

    if (!customerEmail) {
      console.error("No customer email in webhook payload");
      return new Response(JSON.stringify({ error: "No customer email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find user by email
    const { data: userData } = await supabase.auth.admin.listUsers();
    const user = userData?.users?.find((u: { email?: string }) => u.email === customerEmail);

    if (!user) {
      console.error("User not found for email:", customerEmail);
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const isActive = ["active", "paid", "succeeded", "success", "completed", "approved"].includes(status);

    if (isActive && productId && CREDIT_PRODUCTS[productId]) {
      const { error: creditError } = await supabase.rpc("apply_dodo_credits_for_user", {
        _user_id: userId,
        _product_id: productId,
        _payment_id: String(paymentId || subscriptionId || `${type}:${productId}:${userId}`),
        _source: "dodo_webhook",
      });
      if (creditError) console.error("Credit allocation failed:", creditError);
    }

    if (productId === ULTIMATE_PRODUCT_ID || productId === PRO_PLUS_PRODUCT_ID || subscriptionId) {
      const { error } = await supabase
        .from("subscriptions")
        .upsert({
          user_id: userId,
          subscription_id: subscriptionId,
          status: isActive ? "active" : "inactive",
          plan: isActive ? planTier : "basic",
          current_period_end: data?.current_period_end || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      if (error) {
        console.error("DB error:", error);
        return new Response(JSON.stringify({ error: "DB update failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log(`Subscription ${type} processed: ${isActive ? planTier.toUpperCase() : 'BASIC'}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

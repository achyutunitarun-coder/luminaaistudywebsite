import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ACTIVE_STATUSES = new Set(["active", "paid", "succeeded", "success", "completed", "approved", "renewed", "on_trial"]);
const INACTIVE_STATUSES = new Set(["cancelled", "canceled", "failed", "expired", "inactive", "past_due", "unpaid"]);

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

    const customerEmail = String(data?.customer?.email || data?.customer_email || data?.email || "").toLowerCase();
    const subscriptionId = data?.subscription_id || data?.subscription?.id || (String(type).startsWith("subscription.") ? data?.id : null);
    const rawStatus = String(data?.status || data?.payment_status || type?.split(".")?.[1] || "").toLowerCase();
    const status = ACTIVE_STATUSES.has(rawStatus) ? "active" : INACTIVE_STATUSES.has(rawStatus) ? "inactive" : rawStatus;
    const paymentId = data?.payment_id || data?.payment?.id || data?.order_id || (!String(type).startsWith("subscription.") ? data?.id : null);
    const productId = data?.product_id || data?.product?.id || data?.items?.[0]?.product_id || data?.items?.[0]?.product?.id || data?.product_cart?.[0]?.product_id || "";

    // Determine plan tier from product ID
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

    let user: { id: string; email?: string } | undefined;
    for (let page = 1; page <= 20 && !user; page++) {
      const { data: userData, error: listError } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
      if (listError) throw listError;
      user = userData?.users?.find((u: { email?: string }) => u.email?.toLowerCase() === customerEmail);
      if (!userData?.users?.length || userData.users.length < 100) break;
    }

    if (!user) {
      console.error("User not found for email:", customerEmail);
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const isActive = status === "active" || ACTIVE_STATUSES.has(rawStatus);

    if (productId && CREDIT_PRODUCTS[productId]) {
      const { error: creditError } = await supabase.rpc("sync_dodo_entitlement_for_user", {
        _user_id: userId,
        _product_id: productId,
        _payment_id: String(paymentId || subscriptionId || `${type}:${productId}:${userId}`),
        _subscription_id: subscriptionId ? String(subscriptionId) : null,
        _status: isActive ? "active" : "inactive",
        _current_period_end: data?.current_period_end || data?.current_period_end_at || data?.next_billing_date || null,
        _source: "dodo_webhook",
      });
      if (creditError) console.error("Credit allocation failed:", creditError);
      if (creditError) {
        return new Response(JSON.stringify({ error: "Entitlement sync failed" }), {
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

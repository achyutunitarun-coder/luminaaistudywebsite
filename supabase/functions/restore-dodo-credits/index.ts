// Verifies a Dodo payment against Dodo's API before applying credits.
// Replaces the unsafe client-callable `apply_dodo_credits` RPC.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireUser } from "../_shared/auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DODO_API_KEY = Deno.env.get("DODO_API_KEY") ?? "";
const SR_URL = Deno.env.get("SUPABASE_URL")!;
const SR_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function verifyDodoPayment(paymentId: string, productId: string, userId: string): Promise<boolean> {
  if (!DODO_API_KEY) return false;
  // Try payments endpoint first, then subscriptions as fallback.
  const endpoints = [
    `https://live.dodopayments.com/payments/${encodeURIComponent(paymentId)}`,
    `https://live.dodopayments.com/subscriptions/${encodeURIComponent(paymentId)}`,
  ];
  for (const url of endpoints) {
    try {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${DODO_API_KEY}` } });
      if (!r.ok) continue;
      const d = await r.json();
      const status = String(d.status ?? d.payment_status ?? "").toLowerCase();
      const ok = ["succeeded", "active", "paid", "completed", "success"].includes(status);
      if (!ok) continue;
      // Match the product
      const matchProduct =
        d.product_id === productId ||
        d.product?.id === productId ||
        (Array.isArray(d.product_cart) && d.product_cart.some((p: any) => p.product_id === productId)) ||
        (Array.isArray(d.items) && d.items.some((p: any) => p.product_id === productId));
      if (!matchProduct) continue;
      // Match the customer to the calling user when available
      const customerEmail = String(d.customer?.email ?? d.customer_email ?? "").toLowerCase();
      const metadataUid = String(d.metadata?.user_id ?? "").toLowerCase();
      if (metadataUid && metadataUid !== userId.toLowerCase()) return false;
      // Fetch user's email server-side to compare (best-effort)
      if (customerEmail) {
        const sr = createClient(SR_URL, SR_KEY);
        const { data: u } = await sr.auth.admin.getUserById(userId);
        const myEmail = u?.user?.email?.toLowerCase();
        if (myEmail && myEmail !== customerEmail) return false;
      }
      return true;
    } catch { /* try next */ }
  }
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = await requireUser(req, cors);
    if ("error" in auth) return auth.error;

    const body = await req.json().catch(() => ({}));
    const productId = String(body.product_id ?? "").trim();
    const paymentId = String(body.payment_id ?? "").trim();
    if (!productId || !paymentId || paymentId.length > 200 || productId.length > 200) {
      return new Response(JSON.stringify({ error: "product_id and payment_id required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const verified = await verifyDodoPayment(paymentId, productId, auth.user.id);
    if (!verified) {
      return new Response(JSON.stringify({ applied: false, error: "payment_not_verified" }), {
        status: 402, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sr = createClient(SR_URL, SR_KEY);
    const { data, error } = await sr.rpc("apply_dodo_credits_for_user", {
      _user_id: auth.user.id,
      _product_id: productId,
      _payment_id: paymentId,
      _source: "restore_verified",
    });
    if (error) {
      return new Response(JSON.stringify({ applied: false, error: error.message }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const row = Array.isArray(data) ? data[0] : data;
    return new Response(JSON.stringify(row ?? { applied: false }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

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

type VerifiedDodoPayment = {
  ok: boolean;
  paymentId?: string;
  subscriptionId?: string | null;
  status?: string;
  currentPeriodEnd?: string | null;
};

function productMatches(d: any, productId: string): boolean {
  return d.product_id === productId ||
    d.product?.id === productId ||
    (Array.isArray(d.product_cart) && d.product_cart.some((p: any) => p.product_id === productId || p.product?.id === productId)) ||
    (Array.isArray(d.items) && d.items.some((p: any) => p.product_id === productId || p.product?.id === productId));
}

async function userEmail(userId: string): Promise<string | null> {
  const sr = createClient(SR_URL, SR_KEY);
  const { data: u } = await sr.auth.admin.getUserById(userId);
  return u?.user?.email?.toLowerCase() ?? null;
}

async function matchesUser(d: any, userId: string): Promise<boolean> {
  const metadataUid = String(d.metadata?.user_id ?? "").toLowerCase();
  if (metadataUid && metadataUid !== userId.toLowerCase()) return false;
  const customerEmail = String(d.customer?.email ?? d.customer_email ?? "").toLowerCase();
  if (!customerEmail) return true;
  const myEmail = await userEmail(userId);
  return !!myEmail && myEmail === customerEmail;
}

async function findRecentDodoPayment(productId: string, userId: string): Promise<VerifiedDodoPayment> {
  const email = await userEmail(userId);
  if (!email) return { ok: false };
  const p = new URLSearchParams({ product_id: productId, status: "succeeded", page_size: "25" });
  const r = await fetch(`https://live.dodopayments.com/payments?${p}`, {
    headers: { Authorization: `Bearer ${DODO_API_KEY}` },
  });
  if (!r.ok) return { ok: false };
  const list = await r.json();
  const items = Array.isArray(list.items) ? list.items : [];
  const since = Date.now() - 48 * 60 * 60 * 1000;
  const hit = items.find((d: any) => {
    const created = d.created_at ? new Date(d.created_at).getTime() : Date.now();
    const customerEmail = String(d.customer?.email ?? d.customer_email ?? "").toLowerCase();
    return created >= since && customerEmail === email && productMatches(d, productId);
  });
  if (!hit?.payment_id) return { ok: false };
  return {
    ok: true,
    paymentId: String(hit.payment_id),
    subscriptionId: hit.subscription_id ?? null,
    status: String(hit.status ?? "succeeded").toLowerCase(),
    currentPeriodEnd: hit.current_period_end ?? hit.current_period_end_at ?? null,
  };
}

async function verifyDodoPayment(paymentId: string, productId: string, userId: string): Promise<VerifiedDodoPayment> {
  if (!DODO_API_KEY) return { ok: false };
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
      const ok = ["succeeded", "active", "paid", "completed", "success", "approved", "renewed", "on_trial"].includes(status);
      if (!ok) continue;
      if (!productMatches(d, productId)) continue;
      if (!(await matchesUser(d, userId))) return { ok: false };
      return {
        ok: true,
        paymentId: String(d.payment_id ?? paymentId),
        subscriptionId: d.subscription_id ?? d.id ?? null,
        status,
        currentPeriodEnd: d.current_period_end ?? d.current_period_end_at ?? d.next_billing_date ?? null,
      };
    } catch { /* try next */ }
  }
  return { ok: false };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = await requireUser(req, cors);
    if ("error" in auth) return auth.error;

    const body = await req.json().catch(() => ({}));
    const productId = String(body.product_id ?? "").trim();
    const paymentId = String(body.payment_id ?? "").trim();
    if (!productId || paymentId.length > 200 || productId.length > 200) {
      return new Response(JSON.stringify({ error: "product_id required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const verified = paymentId
      ? await verifyDodoPayment(paymentId, productId, auth.user.id)
      : await findRecentDodoPayment(productId, auth.user.id);
    if (!verified.ok || !verified.paymentId) {
      return new Response(JSON.stringify({ applied: false, error: "payment_not_verified" }), {
        status: 402, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sr = createClient(SR_URL, SR_KEY);
    const { data, error } = await sr.rpc("sync_dodo_entitlement_for_user", {
      _user_id: auth.user.id,
      _product_id: productId,
      _payment_id: verified.paymentId,
      _subscription_id: verified.subscriptionId ?? null,
      _status: verified.status ?? "active",
      _current_period_end: verified.currentPeriodEnd ?? null,
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

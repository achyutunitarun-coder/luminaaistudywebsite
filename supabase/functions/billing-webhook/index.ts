// Billing Webhook — handles Dodo one-time payment events.
// Source of truth for entitlement updates. Never trusts frontend redirects.
// Idempotent: replayed events return 200 without side effects.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonOk = { ...corsHeaders, "Content-Type": "application/json" };

interface DodoWebhookPayload {
  id: string;
  type: string;
  data: Record<string, unknown>;
  created: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // 1. Signature verification
    const signature = req.headers.get("x-dodo-signature") || "";
    const body = await req.text();
    const secret = Deno.env.get("DODO_WEBHOOK_SECRET") || "";
    if (secret && !(await verifySignature(body, signature, secret))) {
      console.error("[billing-webhook] Invalid signature");
      return new Response(JSON.stringify({ error: "invalid_signature" }), { status: 401, headers: jsonOk });
    }

    const payload: DodoWebhookPayload = JSON.parse(body);
    const eventId = payload.id;
    const eventType = payload.type;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 2. Idempotency check
    const { data: existing } = await admin
      .from("webhook_events")
      .select("id, status")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ status: "already_processed", id: existing.id }), { status: 200, headers: jsonOk });
    }

    // 3. Record incoming event
    const { data: event, error: eventErr } = await admin
      .from("webhook_events")
      .insert({
        event_id: eventId,
        event_type: eventType,
        payload: payload.data,
        status: "processed",
      })
      .select("id")
      .single();

    if (eventErr) {
      console.error("[billing-webhook] Failed to record event:", eventErr);
      return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: jsonOk });
    }

    // 4. Handle payment.succeeded
    if (eventType === "payment.succeeded") {
      const paymentData = payload.data as Record<string, any>;
      const dodoPaymentId = paymentData.id as string || "";

      // Find the matching invoice by dodo_payment_id
      const { data: invoice } = await admin
        .from("renewal_invoices")
        .select("id, membership_id, status")
        .eq("dodo_payment_id", dodoPaymentId)
        .maybeSingle();

      if (invoice && invoice.status === "pending") {
        // Extend membership via DB function
        const { data: extResult } = await admin.rpc("extend_membership_on_payment", {
          p_membership_id: invoice.membership_id,
          p_dodo_payment_id: dodoPaymentId,
          p_dodo_payment_link: null,
        });

        console.log("[billing-webhook] Membership extended:", JSON.stringify(extResult));
      } else if (!invoice) {
        // Could be a credit pack purchase — route to legacy handler
        const productId = paymentData.product_cart?.[0]?.product_id as string || "";
        const customerEmail = (paymentData.customer?.email as string) || "";

        if (productId && customerEmail) {
          // Find user by email and apply credits
          const { data: userProfile } = await admin
            .from("profiles")
            .select("user_id")
            .eq("email", customerEmail)
            .maybeSingle();

          if (userProfile) {
            await admin.rpc("sync_dodo_entitlement_for_user", {
              _user_id: userProfile.user_id,
              _product_id: productId,
              _payment_id: dodoPaymentId,
              _source: "webhook",
              _status: "active",
              _subscription_id: null,
              _current_period_end: null,
            });
            console.log("[billing-webhook] Legacy credits applied for", customerEmail);
          }
        }
      }
    }

    // 5. Handle payment.failed
    if (eventType === "payment.failed") {
      const paymentData = payload.data as Record<string, any>;
      const dodoPaymentId = paymentData.id as string || "";

      const { data: invoice } = await admin
        .from("renewal_invoices")
        .select("id, status")
        .eq("dodo_payment_id", dodoPaymentId)
        .maybeSingle();

      if (invoice && invoice.status === "pending") {
        await admin
          .from("renewal_invoices")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", invoice.id);
        console.log("[billing-webhook] Invoice marked failed:", invoice.id);
      }
    }

    return new Response(JSON.stringify({ status: "ok", event_id: eventId }), { status: 200, headers: jsonOk });
  } catch (e) {
    console.error("[billing-webhook] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: jsonOk });
  }
});

async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  if (!signature || !secret) return true;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const sigBytes = hexToBytes(signature);
    const bodyBytes = new TextEncoder().encode(body);
    return await crypto.subtle.verify("HMAC", key, sigBytes, bodyBytes);
  } catch {
    return false;
  }
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

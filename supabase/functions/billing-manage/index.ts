// Billing Management API — endpoints for customer-facing billing operations.
// POST /billing/memberships/:id/start  — start membership, create payment link
// GET  /billing/memberships/:id       — get membership + invoice info
// POST /billing/memberships/:id/cancel — cancel membership (no future invoices)
// POST /billing/invoices/:id/resend-link — resend/regenerate payment link

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const DODO_BASE = Deno.env.get("DODO_BASE_URL") || "https://test.dodopayments.com";
const DODO_API_KEY = Deno.env.get("DODO_API_KEY") || "";
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "http://localhost:8080";

// Strip Supabase function prefix so we can match clean route segments.
// Input: /functions/v1/billing-manage/memberships/123/start
// Output: ["memberships", "123", "start"]
function routeSegments(pathname: string): string[] {
  const parts = pathname.split("/").filter(Boolean);
  const fnIdx = parts.findIndex((p) => p === "billing-manage");
  return fnIdx >= 0 ? parts.slice(fnIdx + 1) : parts;
}

async function callDodoApi(method: string, body?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const url = `${DODO_BASE}/v1/payments`;
  const res = await fetch(url, {
    method,
    headers: {
      "Authorization": `Bearer ${DODO_API_KEY}`,
      "Content-Type": "application/json",
      "x-dodo-version": "2025-02-10",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "Unknown");
    console.error(`[billing-manage] Dodo API error ${res.status}:`, errText.slice(0, 200));
    throw new Error(`Dodo API error: ${res.status}`);
  }

  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: jsonHeaders });
    }

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: jsonHeaders });
    }

    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const route = routeSegments(url.pathname);

    // POST /billing/memberships/:id/start
    if (req.method === "POST" && route[0] === "memberships" && route[2] === "start") {
      const membershipId = route[1];
      return await startMembership(adminClient(req), user.id, membershipId);
    }

    // GET /billing/memberships/:id
    if (req.method === "GET" && route[0] === "memberships" && !route[2]) {
      const membershipId = route[1];
      return await getMembership(adminClient(req), user.id, membershipId);
    }

    // POST /billing/memberships/:id/cancel
    if (req.method === "POST" && route[0] === "memberships" && route[2] === "cancel") {
      const membershipId = route[1];
      return await cancelMembership(adminClient(req), user.id, membershipId);
    }

    // POST /billing/invoices/:id/resend-link
    if (req.method === "POST" && route[0] === "invoices" && route[2] === "resend-link") {
      const invoiceId = route[1];
      return await resendLink(adminClient(req), user.id, invoiceId);
    }

    // GET /billing/my-membership — active membership for current user
    if (req.method === "GET" && route[0] === "my-membership") {
      return await getMyMembership(adminClient(req), user.id);
    }

    return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: jsonHeaders });
  } catch (e) {
    console.error("[billing-manage] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});

function adminClient(req: Request) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function startMembership(admin: ReturnType<typeof createClient>, userId: string, membershipId: string) {
  const { data: membership, error: mErr } = await admin
    .from("customer_memberships")
    .select("*, billing_plans(*)")
    .eq("id", membershipId)
    .eq("user_id", userId)
    .single();

  if (mErr || !membership) {
    return new Response(JSON.stringify({ error: "membership_not_found" }), { status: 404, headers: jsonHeaders });
  }

  // Check for existing pending invoice
  const { data: existingInvoice } = await admin
    .from("renewal_invoices")
    .select("id, dodo_payment_link")
    .eq("membership_id", membershipId)
    .eq("status", "pending")
    .maybeSingle();

  if (existingInvoice?.dodo_payment_link) {
    return new Response(JSON.stringify({
      invoice_id: existingInvoice.id,
      payment_link: existingInvoice.dodo_payment_link,
      existing: true,
    }), { status: 200, headers: jsonHeaders });
  }

  const plan = membership.billing_plans;
  const returnUrl = `${APP_BASE_URL}/billing/return?membershipId=${membershipId}`;

  try {
    const dodoPayment = await callDodoApi("POST", {
      payment_link: true,
      customer: {
        email: membership.customer_email,
        name: membership.customer_name || undefined,
      },
      product_cart: [
        { product_id: plan.dodo_product_id, quantity: 1 },
      ],
      return_url: returnUrl,
      metadata: {
        membership_id: membershipId,
        user_id: userId,
      },
    });

    const dodoPaymentId = dodoPayment.id as string || "";
    const dodoPaymentLink = dodoPayment.payment_link as string || "";

    const { data: invoice, error: invErr } = await admin
      .from("renewal_invoices")
      .insert({
        membership_id: membershipId,
        due_at: new Date().toISOString(),
        amount_minor: plan.amount_minor,
        currency: plan.currency,
        status: "pending",
        dodo_payment_id: dodoPaymentId,
        dodo_payment_link: dodoPaymentLink,
        metadata: { dodo_response: dodoPayment },
      })
      .select("id, dodo_payment_link, amount_minor, currency")
      .single();

    if (invErr) {
      console.error("[billing-manage] Invoice insert failed:", invErr);
      return new Response(JSON.stringify({ error: "invoice_creation_failed" }), { status: 500, headers: jsonHeaders });
    }

    return new Response(JSON.stringify({
      invoice_id: invoice.id,
      payment_link: invoice.dodo_payment_link,
      amount_minor: invoice.amount_minor,
      currency: invoice.currency,
    }), { status: 200, headers: jsonHeaders });
  } catch (e) {
    console.error("[billing-manage] Dodo payment creation failed:", e);
    return new Response(JSON.stringify({ error: "payment_creation_failed" }), { status: 502, headers: jsonHeaders });
  }
}

async function getMembership(admin: ReturnType<typeof createClient>, userId: string, membershipId: string) {
  const { data: membership, error: mErr } = await admin
    .from("customer_memberships")
    .select("*, billing_plans(*)")
    .eq("id", membershipId)
    .eq("user_id", userId)
    .single();

  if (mErr || !membership) {
    return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: jsonHeaders });
  }

  const { data: invoices } = await admin
    .from("renewal_invoices")
    .select("*")
    .eq("membership_id", membershipId)
    .order("created_at", { ascending: false })
    .limit(20);

  return new Response(JSON.stringify({ membership, invoices }), { status: 200, headers: jsonHeaders });
}

async function getMyMembership(admin: ReturnType<typeof createClient>, userId: string) {
  const { data: membership, error: mErr } = await admin
    .from("customer_memberships")
    .select("*, billing_plans(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (mErr) {
    return new Response(JSON.stringify({ error: "db_error" }), { status: 500, headers: jsonHeaders });
  }

  const result: Record<string, unknown> = { membership: membership || null, invoices: [] };

  if (membership) {
    const { data: invoices } = await admin
      .from("renewal_invoices")
      .select("*")
      .eq("membership_id", membership.id)
      .order("created_at", { ascending: false })
      .limit(20);
    result.invoices = invoices || [];

    // Check for active access
    const { data: hasAccess } = await admin.rpc("has_active_billing_access", { p_user_id: userId });
    result.hasActiveAccess = hasAccess === true;
  }

  return new Response(JSON.stringify(result), { status: 200, headers: jsonHeaders });
}

async function cancelMembership(admin: ReturnType<typeof createClient>, userId: string, membershipId: string) {
  const { data: membership, error: mErr } = await admin
    .from("customer_memberships")
    .select("id, status")
    .eq("id", membershipId)
    .eq("user_id", userId)
    .single();

  if (mErr || !membership) {
    return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: jsonHeaders });
  }

  if (membership.status === "cancelled") {
    return new Response(JSON.stringify({ error: "already_cancelled" }), { status: 400, headers: jsonHeaders });
  }

  await admin
    .from("customer_memberships")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", membershipId);

  return new Response(JSON.stringify({ status: "cancelled" }), { status: 200, headers: jsonHeaders });
}

async function resendLink(admin: ReturnType<typeof createClient>, userId: string, invoiceId: string) {
  const { data: invoice, error: invErr } = await admin
    .from("renewal_invoices")
    .select("*, customer_memberships!inner(*)")
    .eq("id", invoiceId)
    .eq("customer_memberships.user_id", userId)
    .single();

  if (invErr || !invoice) {
    return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: jsonHeaders });
  }

  // If existing link is still valid, return it
  if (invoice.dodo_payment_link && invoice.status === "pending") {
    return new Response(JSON.stringify({
      invoice_id: invoice.id,
      payment_link: invoice.dodo_payment_link,
    }), { status: 200, headers: jsonHeaders });
  }

  // Otherwise, create a new payment
  const membership = invoice.customer_memberships;
  const { data: plan } = await admin
    .from("billing_plans")
    .select("*")
    .eq("id", membership.plan_id)
    .single();

  if (!plan) {
    return new Response(JSON.stringify({ error: "plan_not_found" }), { status: 404, headers: jsonHeaders });
  }

  const returnUrl = `${APP_BASE_URL}/billing/return?membershipId=${membership.id}`;

  try {
    const dodoPayment = await callDodoApi("POST", {
      payment_link: true,
      customer: {
        email: membership.customer_email,
        name: membership.customer_name || undefined,
      },
      product_cart: [
        { product_id: plan.dodo_product_id, quantity: 1 },
      ],
      return_url: returnUrl,
      metadata: {
        membership_id: membership.id,
        invoice_id: invoiceId,
        user_id: userId,
      },
    });

    const dodoPaymentId = dodoPayment.id as string || "";
    const dodoPaymentLink = dodoPayment.payment_link as string || "";

    await admin
      .from("renewal_invoices")
      .update({
        dodo_payment_id: dodoPaymentId,
        dodo_payment_link: dodoPaymentLink,
        status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceId);

    return new Response(JSON.stringify({
      invoice_id: invoiceId,
      payment_link: dodoPaymentLink,
    }), { status: 200, headers: jsonHeaders });
  } catch (e) {
    console.error("[billing-manage] Resend link failed:", e);
    return new Response(JSON.stringify({ error: "payment_creation_failed" }), { status: 502, headers: jsonHeaders });
  }
}

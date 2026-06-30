// Billing Scheduler — cron-job-triggered edge function.
// Run hourly via Supabase pg_cron or external cron (GitHub Actions, Cron-job.org).
// Handles: generate due renewals, send reminders, expire grace periods.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DODO_BASE = Deno.env.get("DODO_BASE_URL") || "https://test.dodopayments.com";
const DODO_API_KEY = Deno.env.get("DODO_API_KEY") || "";
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "http://localhost:8080";
const GRACE_DAYS = parseInt(Deno.env.get("BILLING_GRACE_DAYS") || "3", 10);
const REMINDER_HOURS = (Deno.env.get("REMINDER_SCHEDULE_HOURS") || "24,6").split(",").map(Number).filter(Boolean);
const MAX_REMINDERS = 3;

async function callDodoApi(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const url = `${DODO_BASE}/v1/payments`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${DODO_API_KEY}`,
      "Content-Type": "application/json",
      "x-dodo-version": "2025-02-10",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "Unknown");
    throw new Error(`Dodo API error ${res.status}: ${errText.slice(0, 200)}`);
  }

  return res.json();
}

async function generateDueRenewals(admin: ReturnType<typeof createClient>) {
  const now = new Date().toISOString();

  // Find memberships where next_invoice_at <= now and status in active|grace
  const { data: dueMemberships } = await admin
    .from("customer_memberships")
    .select("*, billing_plans(*)")
    .lte("next_invoice_at", now)
    .in("status", ["active", "grace"]);

  if (!dueMemberships || dueMemberships.length === 0) {
    console.log("[billing-scheduler] No due renewals found");
    return { processed: 0 };
  }

  let processed = 0;

  for (const membership of dueMemberships) {
    // Check if there's already a pending invoice for this membership
    const { data: existingInvoice } = await admin
      .from("renewal_invoices")
      .select("id")
      .eq("membership_id", membership.id)
      .eq("status", "pending")
      .maybeSingle();

    if (existingInvoice) continue;

    const plan = membership.billing_plans;
    if (!plan?.active) continue;

    const returnUrl = `${APP_BASE_URL}/billing/return?membershipId=${membership.id}`;

    try {
      const dodoPayment = await callDodoApi({
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
          user_id: membership.user_id,
          type: "renewal",
        },
      });

      const dodoPaymentId = dodoPayment.id as string || "";
      const dodoPaymentLink = dodoPayment.payment_link as string || "";

      await admin
        .from("renewal_invoices")
        .insert({
          membership_id: membership.id,
          due_at: now,
          amount_minor: plan.amount_minor,
          currency: plan.currency,
          status: "pending",
          dodo_payment_id: dodoPaymentId,
          dodo_payment_link: dodoPaymentLink,
          metadata: { type: "scheduled_renewal" },
        });

      processed++;
      console.log(`[billing-scheduler] Created renewal invoice for ${membership.id}`);
    } catch (e) {
      console.error(`[billing-scheduler] Failed to create renewal for ${membership.id}:`, e);
    }
  }

  return { processed };
}

async function sendReminders(admin: ReturnType<typeof createClient>) {
  const now = new Date();

  // Find pending invoices nearing their due time in grace window
  const graceStart = new Date(now.getTime() - GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: pendingInvoices } = await admin
    .from("renewal_invoices")
    .select("*, customer_memberships!inner(*)")
    .eq("status", "pending")
    .lt("reminder_count", MAX_REMINDERS)
    .gte("due_at", graceStart);

  if (!pendingInvoices || pendingInvoices.length === 0) {
    console.log("[billing-scheduler] No invoices need reminders");
    return { reminded: 0 };
  }

  let reminded = 0;

  for (const invoice of pendingInvoices) {
    const membership = invoice.customer_memberships;
    if (!membership) continue;

    // Check if it's time for a reminder based on REMINDER_SCHEDULE_HOURS
    const hoursSinceDue = (now.getTime() - new Date(invoice.due_at).getTime()) / (1000 * 60 * 60);
    const reminderInterval = REMINDER_HOURS[invoice.reminder_count] || REMINDER_HOURS[REMINDER_HOURS.length - 1] || 24;

    if (hoursSinceDue < reminderInterval) continue;

    // TODO: Send email notification (placeholder — integrate with SendGrid/Resend)
    console.log(`[billing-scheduler] Reminder ${invoice.reminder_count + 1} for invoice ${invoice.id} to ${membership.customer_email}`);

    await admin
      .from("renewal_invoices")
      .update({
        reminder_count: invoice.reminder_count + 1,
        last_reminder_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", invoice.id);

    reminded++;
  }

  return { reminded };
}

async function expireAndPauseMemberships(admin: ReturnType<typeof createClient>) {
  const now = new Date().toISOString();

  // Find memberships where grace has expired
  const { data: expiredMemberships } = await admin
    .from("customer_memberships")
    .select("id, user_id")
    .in("status", ["active", "grace"])
    .lt("grace_ends_at", now);

  if (!expiredMemberships || expiredMemberships.length === 0) {
    console.log("[billing-scheduler] No expired memberships");
    return { paused: 0 };
  }

  let paused = 0;

  for (const membership of expiredMemberships) {
    const { data: result } = await admin.rpc("pause_expired_membership", {
      p_membership_id: membership.id,
    });

    console.log(`[billing-scheduler] Paused membership ${membership.id}:`, JSON.stringify(result));
    paused++;
  }

  return { paused };
}

// Main handler — responds to HTTP trigger (cron-job.org, GitHub Actions, etc.)
serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "use POST" }), { status: 405 });
    }

    const authHeader = req.headers.get("Authorization");
    const cronSecret = Deno.env.get("CRON_SECRET") || "";
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const renewalResult = await generateDueRenewals(admin);
    const reminderResult = await sendReminders(admin);
    const expireResult = await expireAndPauseMemberships(admin);

    const result = {
      renewals: renewalResult.processed,
      reminders: reminderResult.reminded,
      expired: expireResult.paused,
      timestamp: new Date().toISOString(),
    };

    console.log("[billing-scheduler] Run complete:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[billing-scheduler] Fatal:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

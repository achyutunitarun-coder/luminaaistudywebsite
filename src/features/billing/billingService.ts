import { supabase } from "@/integrations/supabase/client";

export interface BillingPlan {
  id: string;
  name: string;
  dodo_product_id: string;
  amount_minor: number;
  currency: string;
  cycle_days: number;
  credits_per_cycle: number;
  active: boolean;
}

export interface CustomerMembership {
  id: string;
  user_id: string;
  customer_email: string;
  customer_name: string;
  plan_id: string;
  status: "active" | "grace" | "paused" | "cancelled";
  current_period_start: string;
  current_period_end: string;
  next_invoice_at: string;
  grace_ends_at: string;
  last_payment_id: string | null;
  last_invoice_id: string | null;
  created_at: string;
  updated_at: string;
  billing_plans?: BillingPlan;
}

export interface RenewalInvoice {
  id: string;
  membership_id: string;
  due_at: string;
  amount_minor: number;
  currency: string;
  status: "pending" | "paid" | "expired" | "failed";
  dodo_payment_id: string | null;
  dodo_payment_link: string | null;
  paid_at: string | null;
  reminder_count: number;
  created_at: string;
  updated_at: string;
}

export interface MyMembershipResponse {
  membership: CustomerMembership | null;
  invoices: RenewalInvoice[];
  hasActiveAccess: boolean;
}

function billingUrl(path: string): string {
  const base = import.meta.env.VITE_SUPABASE_URL || "";
  return `${base}/functions/v1/billing-manage${path}`;
}

async function authedFetch(path: string, options: RequestInit = {}, retries = 2): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }
  const doFetch = async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);
    try {
      return await fetch(billingUrl(path), {
        ...options,
        signal: options.signal ?? ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          ...options.headers,
        },
      });
    } finally {
      clearTimeout(timer);
    }
  };
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await doFetch();
      // Retry only on transient server errors for idempotent GETs
      if (res.status >= 500 && res.status < 600 && (!options.method || options.method === "GET") && attempt < retries) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (attempt >= retries) break;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Network error");
}

export async function getMyMembership(): Promise<MyMembershipResponse> {
  const res = await authedFetch("/my-membership");
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "request_failed" }));
    throw new Error(err.error || "Failed to fetch membership");
  }
  return res.json();
}

export async function startMembership(membershipId: string): Promise<{ invoice_id: string; payment_link: string }> {
  const res = await authedFetch(`/memberships/${membershipId}/start`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "request_failed" }));
    throw new Error(err.error || "Failed to start membership");
  }
  return res.json();
}

export async function resendInvoiceLink(invoiceId: string): Promise<{ invoice_id: string; payment_link: string }> {
  const res = await authedFetch(`/invoices/${invoiceId}/resend-link`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "request_failed" }));
    throw new Error(err.error || "Failed to resend link");
  }
  return res.json();
}

export async function cancelMembership(membershipId: string): Promise<void> {
  const res = await authedFetch(`/memberships/${membershipId}/cancel`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "request_failed" }));
    throw new Error(err.error || "Failed to cancel membership");
  }
}

export function formatAmount(minor: number, currency: string): string {
  const symbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : currency + " ";
  return symbol + (minor / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function getMembershipStatusLabel(status: string): { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" } {
  switch (status) {
    case "active": return { label: "Active", variant: "success" };
    case "grace": return { label: "Grace Period", variant: "secondary" };
    case "paused": return { label: "Paused", variant: "destructive" };
    case "cancelled": return { label: "Cancelled", variant: "outline" };
    default: return { label: status, variant: "outline" };
  }
}

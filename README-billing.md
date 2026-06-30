# Lumina Billing System — Manual Renewal via Dodo Payments

Subscription-like billing **without** AutoPay. Customers pay via one-time payment links every cycle. No Dodo subscriptions or mandates are ever created.

## Architecture

```
┌────────────┐     POST /billing/memberships/:id/start     ┌──────────────────┐
│  Frontend  │ ──────────────────────────────────────────► │ billing-manage   │
│  /billing  │ ◄────────────────────────────────────────── │ (Edge Function)  │
└────────────┘     { invoice_id, payment_link }            └────────┬─────────┘
                                                                     │ POST /v1/payments
                                                                     ▼
                                                              ┌──────────────────┐
                                                              │  Dodo Payments   │
                                                              │  (one-time link) │
                                                              └────────┬─────────┘
                                                                     │
                                                POST /webhooks/dodo  │ payment.succeeded
                                                                     ▼
                                                              ┌──────────────────┐
                                                              │ billing-webhook  │
                                                              │ (Edge Function)  │
                                                              └────────┬─────────┘
                                                                     │ RPC: extend_membership_on_payment
                                                                     ▼
                                                              ┌──────────────────┐
                                                              │   PostgreSQL     │
                                                              │ customer_memberships
                                                              │ renewal_invoices │
                                                              │ webhook_events   │
                                                              └──────────────────┘
```

## Database Schema

See `supabase/migrations/0049_billing_system.sql` for full schema.

| Table | Purpose |
|-------|---------|
| `billing_plans` | Product definitions mapped to Dodo product IDs |
| `customer_memberships` | Per-user membership with expiry, grace, status |
| `renewal_invoices` | One-time payment invoices per cycle |
| `webhook_events` | Idempotency log for all Dodo webhook events |

## Setup

### 1. Environment Variables

Copy `supabase/.env.example` and set:

| Variable | Description |
|----------|-------------|
| `DODO_API_KEY` | Your Dodo Payments API key |
| `DODO_BASE_URL` | `https://test.dodopayments.com` (test) or `https://api.dodopayments.com` (live) |
| `DODO_WEBHOOK_SECRET` | Shared secret for webhook signature verification |
| `APP_BASE_URL` | Your frontend URL (for return URLs) |
| `BILLING_GRACE_DAYS` | Days after period end before pausing access (default: 3) |
| `REMINDER_SCHEDULE_HOURS` | Comma-separated hours after due for reminders (default: "24,6") |
| `CRON_SECRET` | Bearer token for cron endpoint |

### 2. Database Migration

Run the migration:

```bash
# If using Supabase CLI
supabase migration up

# Or apply the SQL file directly
psql "$SUPABASE_DB_URL" -f supabase/migrations/0049_billing_system.sql
```

### 3. Deploy Edge Functions

```bash
supabase functions deploy billing-webhook
supabase functions deploy billing-manage
supabase functions deploy billing-scheduler
```

### 4. Configure Dodo Webhook

In your Dodo dashboard, set the webhook URL to:

```
https://your-project.supabase.co/functions/v1/billing-webhook
```

**Events to subscribe to:**
- `payment.succeeded`
- `payment.failed`

### 5. Set Up Cron (billing-scheduler)

The scheduler runs via HTTP trigger. Use one of:

**Option A: Supabase pg_cron (recommended)**
```sql
SELECT cron.schedule(
  'billing-scheduler',
  '0 * * * *',  -- every hour
  $$SELECT net.http_post(
    url:='https://your-project.supabase.co/functions/v1/billing-scheduler',
    headers:=jsonb_build_object(
      'Authorization', 'Bearer YOUR_CRON_SECRET',
      'Content-Type', 'application/json'
    )
  )$$
);
```

**Option B: cron-job.org / GitHub Actions**
POST to `https://your-project.supabase.co/functions/v1/billing-scheduler` every hour with header `Authorization: Bearer YOUR_CRON_SECRET`.

### 6. Seed Billing Plans

Insert one-time product entries matching your Dodo products:

```sql
INSERT INTO public.billing_plans (name, dodo_product_id, amount_minor, currency, cycle_days, credits_per_cycle)
VALUES
  ('Ultimate', 'pdt_0NbKNHJ5nK556qajM5MKa', 19900, 'INR', 30, 40),
  ('PRO+', 'pdt_0Nbybrhl2M0GdzScdoAwb', 49900, 'INR', 30, 150),
  ('MEGA', 'pdt_0NgrUZL3QLR2Xmw2PQgRR', 89900, 'INR', 30, 300),
  ('POWER+', 'pdt_0NgrZWBT2Irz439pIp6Xn', 129900, 'INR', 30, 500);
```

## Test Mode Flow

1. Set `DODO_BASE_URL=https://test.dodopayments.com`
2. Use Dodo test card: `4242 4242 4242 4242`, any future date, any CVV
3. Set `cycle_days=1` in the plan for quick testing

## API Endpoints

### `POST /billing/memberships/:id/start`
Create first renewal invoice + payment link. Returns `{ invoice_id, payment_link }`.

### `GET /billing/memberships/:id`
Returns membership + invoice history.

### `GET /billing/my-membership`
Returns current user's active membership + invoices + `hasActiveAccess` flag.

### `POST /billing/memberships/:id/cancel`
Sets status to `cancelled`. No future invoices generated.

### `POST /billing/invoices/:id/resend-link`
Regenerates payment link for an unpaid invoice.

## Webhook Flow

1. Customer clicks payment link → Dodo checkout → pays
2. Dodo sends `payment.succeeded` to `/webhooks/dodo`
3. `billing-webhook` verifies signature, checks idempotency
4. Calls `extend_membership_on_payment()` RPC
5. Membership period extended, invoice marked paid, credits allocated
6. Frontend reads updated status on next `/billing` visit

## Key Design Decisions

- **No Dodo subscriptions**: Every payment is `payments.create` with `payment_link: true`
- **No mandates/autopay**: Customer must click a new link each cycle
- **Webhook as source of truth**: Frontend redirects are never trusted for entitlement
- **Idempotent webhooks**: Replayed events return 200 without side effects
- **Grace period**: After period end, customer has `BILLING_GRACE_DAYS` before access pauses
- **Backward compatible**: Extends legacy `subscriptions` table for existing functionality

## Quick Dev Cycle (1-day testing)

```sql
-- Create a plan with 1-day cycle
INSERT INTO billing_plans (name, dodo_product_id, amount_minor, currency, cycle_days, credits_per_cycle)
VALUES ('Test Daily', 'pdt_TEST', 100, 'INR', 1, 10);

-- Create a membership
INSERT INTO customer_memberships (user_id, customer_email, customer_name, plan_id, current_period_end, next_invoice_at, grace_ends_at)
SELECT
  'USER_UUID', 'test@example.com', 'Test User',
  id, now() + interval '1 day', now() + interval '1 day', now() + interval '4 days'
FROM billing_plans WHERE name = 'Test Daily';

-- Trigger scheduler
curl -X POST https://your-project.supabase.co/functions/v1/billing-scheduler \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

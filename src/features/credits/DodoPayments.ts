/**
 * Dodo Payments — exact product IDs and checkout URLs.
 * Do not change product IDs.
 */

const DODO_BASE = 'https://checkout.dodopayments.com/buy';
const RETURN_URL = 'https://luminaai.co.in';
const RETURN_ENCODED = encodeURIComponent(RETURN_URL);

export const SUBSCRIPTION_PLANS = {
  ultimate: {
    productId: 'pdt_0NbKNHJ5nK556qajM5MKa',
    name: 'Ultimate',
    priceMonthly: 199,
    priceAnnual: 133,
    credits: 40,
    rolloverCap: 80,
    checkoutMonthly: `${DODO_BASE}/pdt_0NbKNHJ5nK556qajM5MKa?quantity=1&return_url=${RETURN_ENCODED}`,
    checkoutAnnual: `${DODO_BASE}/pdt_0NbKNHJ5nK556qajM5MKa?quantity=1&billing_cycle=annual&return_url=${RETURN_ENCODED}`,
  },
  pro_plus: {
    productId: 'pdt_0Nbybrhl2M0GdzScdoAwb',
    name: 'PRO+',
    priceMonthly: 499,
    priceAnnual: 333,
    credits: 150,
    rolloverCap: 300,
    checkoutMonthly: `${DODO_BASE}/pdt_0Nbybrhl2M0GdzScdoAwb?quantity=1&return_url=${RETURN_ENCODED}`,
    checkoutAnnual: `${DODO_BASE}/pdt_0Nbybrhl2M0GdzScdoAwb?quantity=1&billing_cycle=annual&return_url=${RETURN_ENCODED}`,
  },
} as const;

export interface CreditPack {
  id: string;
  productId: string;
  name: string;
  credits: number;
  price: number;
  perCredit: number;
  badge: string | null;
  checkout: string;
}

export const CREDIT_PACKS: readonly CreditPack[] = [
  {
    id: 'starter',
    productId: 'pdt_0NdcF1gd6Z5PBeFx8gbiE',
    name: 'Starter',
    credits: 30,
    price: 59,
    perCredit: 1.97,
    badge: null,
    checkout: `${DODO_BASE}/pdt_0NdcF1gd6Z5PBeFx8gbiE?quantity=1&return_url=${RETURN_ENCODED}`,
  },
  {
    id: 'standard',
    productId: 'pdt_0NdcF1o3DQYEdtVQBA8MG',
    name: 'Standard',
    credits: 100,
    price: 149,
    perCredit: 1.49,
    badge: 'Best Value',
    checkout: `${DODO_BASE}/pdt_0NdcF1o3DQYEdtVQBA8MG?quantity=1&return_url=${RETURN_ENCODED}`,
  },
  {
    id: 'power',
    productId: 'pdt_0NdcF1rKPidZVQ4vdzt5u',
    name: 'Power',
    credits: 300,
    price: 399,
    perCredit: 1.33,
    badge: null,
    checkout: `${DODO_BASE}/pdt_0NdcF1rKPidZVQ4vdzt5u?quantity=1&return_url=${RETURN_ENCODED}`,
  },
  {
    id: 'mega',
    productId: 'pdt_0NdcF1ua83g4FRUO1LhKt',
    name: 'Mega',
    credits: 800,
    price: 899,
    perCredit: 1.12,
    badge: 'Best Rate',
    checkout: `${DODO_BASE}/pdt_0NdcF1ua83g4FRUO1LhKt?quantity=1&return_url=${RETURN_ENCODED}`,
  },
] as const;

export function openCheckout(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}

import { useEffect } from 'react';
import { useCreditsStore } from './useCreditsStore';

const SUCCESS_STATUSES = new Set([
  'paid', 'active', 'succeeded', 'success', 'completed', 'approved',
]);

export function usePaymentReturn() {
  useEffect(() => {
    handleReturnUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

const PLAN_MAP: Record<string, { productId: string; credits: number; name: string; tier: 'ultimate' | 'pro_plus' | 'mega' | 'power_plus' }> = {
  ultimate:    { productId: 'pdt_0NbKNHJ5nK556qajM5MKa', credits: 40,  name: 'Ultimate',  tier: 'ultimate' },
  pro_plus:    { productId: 'pdt_0Nbybrhl2M0GdzScdoAwb', credits: 150, name: 'PRO+',      tier: 'pro_plus' },
  'pro+':      { productId: 'pdt_0Nbybrhl2M0GdzScdoAwb', credits: 150, name: 'PRO+',      tier: 'pro_plus' },
  mega:        { productId: 'pdt_0NgrUZL3QLR2Xmw2PQgRR', credits: 300, name: 'MEGA',      tier: 'mega' },
  power_plus:  { productId: 'pdt_0NgrZWBT2Irz439pIp6Xn', credits: 500, name: 'POWER+',    tier: 'power_plus' },
  'power+':    { productId: 'pdt_0NgrZWBT2Irz439pIp6Xn', credits: 500, name: 'POWER+',    tier: 'power_plus' },
};

const PRODUCT_TO_PLAN: Record<string, { name: string; plan: string; credits: number }> = {
  'pdt_0NbKNHJ5nK556qajM5MKa': { name: 'Ultimate', plan: 'ultimate', credits: 40 },
  'pdt_0Nbybrhl2M0GdzScdoAwb': { name: 'PRO+',     plan: 'pro_plus', credits: 150 },
  'pdt_0NgrUZL3QLR2Xmw2PQgRR': { name: 'MEGA',     plan: 'mega',     credits: 300 },
  'pdt_0NgrZWBT2Irz439pIp6Xn': { name: 'POWER+',   plan: 'power_plus', credits: 500 },
};

const CREDIT_PACK_PRODUCTS = new Set([
  'pdt_0NdcF1gd6Z5PBeFx8gbiE', // Starter
  'pdt_0NdcF1o3DQYEdtVQBA8MG', // Standard
  'pdt_0NdcF1rKPidZVQ4vdzt5u', // Power
  'pdt_0NdcF1ua83g4FRUO1LhKt', // Mega pack
]);

function handleReturnUrl() {
  const params = new URLSearchParams(window.location.search);
  const status =
    params.get('status') ||
    params.get('payment_status') ||
    params.get('checkout_status');
  const paymentId =
    params.get('payment_id') ||
    params.get('checkout_id') ||
    params.get('order_id') ||
    params.get('transaction_id');
  const productId =
    params.get('product_id') || params.get('product') || params.get('item_id');
  const subscriptionId = params.get('subscription_id');
  const planParam = params.get('plan');
  const source = params.get('source');

  if (!source && !status && !paymentId && !productId && !planParam) return;

  const isPaid = !status || (SUCCESS_STATUSES.has(status.toLowerCase()) ?? true);

  if (!isPaid) {
    cleanUrl();
    return;
  }

  // CASE 1: Credit pack purchase via Dodo checkout return
  if (productId && CREDIT_PACK_PRODUCTS.has(productId)) {
    void applyAndClean(productId, paymentId || subscriptionId, 'pack');
    return;
  }

  // CASE 2: Subscription plan
  const planKey = planParam?.toLowerCase();
  if (planKey && PLAN_MAP[planKey]) {
    const data = PLAN_MAP[planKey];
    void applyAndClean(data.productId, subscriptionId || paymentId, 'subscription', data.tier);
    return;
  }

  // CASE 3: Product ID matches a subscription product
  if (productId && PRODUCT_TO_PLAN[productId]) {
    const info = PRODUCT_TO_PLAN[productId];
    void applyAndClean(productId, subscriptionId || paymentId, 'subscription', info.plan as any);
    return;
  }

  // CASE 4: Generic success - prompt manual restore
  if (paymentId || subscriptionId) {
    sessionStorage.setItem('pending_payment_id', paymentId || subscriptionId || '');
    cleanUrl();
    window.dispatchEvent(new CustomEvent('lumina:show-restore-prompt'));
  }
}

async function applyAndClean(
  productId: string,
  uniqueId: string | null,
  type: 'pack' | 'subscription',
  tier?: string,
) {
  const store = useCreditsStore.getState();
  const dedupKey = uniqueId || productId;

  if (store.isPaymentProcessed(dedupKey)) {
    cleanUrl();
    return;
  }

  await applyCreditsServerFirst(productId, dedupKey, type, tier);

  cleanUrl();
}

async function applyCreditsServerFirst(
  productId: string,
  dedupKey: string,
  type: 'pack' | 'subscription',
  tier?: string,
) {
  const store = useCreditsStore.getState();
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data, error } = await supabase.functions.invoke('restore-dodo-credits', {
      body: {
        product_id: productId,
        payment_id: dedupKey || undefined,
        type,
      },
    });

    if (error) {
      console.warn('[Credits] Server error:', error);
      return;
    }

    if (!data?.applied) {
      if (!data?.duplicate) {
        console.warn('[Credits] Server did not apply credits for', productId);
      }
      return;
    }

    const validPlans = ['ultimate', 'pro_plus', 'mega', 'power_plus', 'free'] as const;
    const plan = validPlans.includes(data.plan) ? data.plan : undefined;
    const newBalance = Number(data.balance ?? store.balance);

    store.setBalance(newBalance, plan as any);
    store.markPaymentProcessed(dedupKey);

    window.dispatchEvent(new CustomEvent('lumina:subscription-refresh'));

    if (!data.duplicate) {
      const creditsAdded = Number(data.credits_added ?? 0);
      const productName = data.product_name ?? (type === 'subscription' ? (tier ?? 'Premium') : 'Credits');
      showSuccessToast(creditsAdded, productName, type);
    }
  } catch (e) {
    console.warn('[Credits] Server credit apply failed:', e);
  }
}

function cleanUrl() {
  window.history.replaceState({}, '', window.location.pathname);
}

function showSuccessToast(credits: number, productName: string, type: string) {
  window.dispatchEvent(
    new CustomEvent('lumina:credits-added', { detail: { credits, productName, type } }),
  );
}

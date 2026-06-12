import { useEffect } from 'react';
import { useCreditsStore } from './useCreditsStore';
import { DODO_CREDIT_MAP, DODO_PACK_DETAILS } from './dodoPricing';

const SUCCESS_STATUSES = new Set([
  'paid', 'active', 'succeeded', 'success', 'completed', 'approved',
]);

export function usePaymentReturn() {
  useEffect(() => {
    handleReturnUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

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

  const isPaid = !status || SUCCESS_STATUSES.has(status.toLowerCase());

  const store = useCreditsStore.getState();

  if (!isPaid) {
    cleanUrl();
    return;
  }

  // CASE 1: product_id present
  if (productId && DODO_CREDIT_MAP[productId]) {
    const uniqueId = paymentId || subscriptionId || '';
    if (store.isPaymentProcessed(uniqueId)) {
      cleanUrl();
      return;
    }
    const details = DODO_PACK_DETAILS[productId];
    const credits = DODO_CREDIT_MAP[productId];
    void applyCreditsServerFirst(productId, uniqueId, details, credits);
    cleanUrl();
    return;
  }

  // CASE 2: plan param (subscription)
  if (planParam) {
    const planMap: Record<string, { productId: string; credits: number; name: string; tier: 'ultimate' | 'pro_plus' }> = {
      ultimate:  { productId: 'pdt_0NbKNHJ5nK556qajM5MKa', credits: 40,  name: 'Ultimate', tier: 'ultimate' },
      pro_plus:  { productId: 'pdt_0Nbybrhl2M0GdzScdoAwb', credits: 150, name: 'PRO+',     tier: 'pro_plus' },
      'pro+':    { productId: 'pdt_0Nbybrhl2M0GdzScdoAwb', credits: 150, name: 'PRO+',     tier: 'pro_plus' },
      mega:      { productId: 'pdt_0NgrUZL3QLR2Xmw2PQgRR', credits: 300, name: 'MEGA',     tier: 'pro_plus' },
      power_plus:{ productId: 'pdt_0NgrZWBT2Irz439pIp6Xn', credits: 500, name: 'POWER+',   tier: 'pro_plus' },
      'power+':  { productId: 'pdt_0NgrZWBT2Irz439pIp6Xn', credits: 500, name: 'POWER+',   tier: 'pro_plus' },
    };
    const data = planMap[planParam.toLowerCase()];
    if (data) {
      const uniqueId = subscriptionId || paymentId || '';
      if (!store.isPaymentProcessed(uniqueId)) {
        void applyCreditsServerFirst(data.productId, uniqueId, { name: data.name, type: 'subscription' }, data.credits, data.tier);
      }
    }
    cleanUrl();
    return;
  }

  // CASE 3: success status with id but no product → manual restore prompt
  if (paymentId || subscriptionId) {
    sessionStorage.setItem('pending_payment_id', paymentId || subscriptionId || '');
    cleanUrl();
    window.dispatchEvent(new CustomEvent('lumina:show-restore-prompt'));
  }
}

async function applyCreditsServerFirst(
  productId: string,
  paymentId: string,
  details: { name: string; type: 'pack' | 'subscription' },
  fallbackCredits: number,
  _tier?: 'ultimate' | 'pro_plus',
) {
  const store = useCreditsStore.getState();
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    // Server verifies the Dodo payment before granting credits. If Dodo didn't
    // return a payment id, the backend searches recent paid purchases by product
    // and the signed-in user's email.
    const { data, error } = await supabase.functions.invoke('restore-dodo-credits', {
      body: { product_id: productId, payment_id: paymentId || undefined },
    });
    if (error || !data?.applied) {
      if (!data?.duplicate) {
        console.warn('[Credits] Server credit apply did not succeed; no client fallback will run.');
      }
      return;
    }
    const plan = data.plan === 'ultimate' || data.plan === 'pro_plus' || data.plan === 'free' ? data.plan : undefined;
    store.setBalance(Number(data.balance ?? store.balance), plan);
    if (paymentId) store.markPaymentProcessed(paymentId);
    window.dispatchEvent(new CustomEvent('lumina:subscription-refresh'));
    if (!data.duplicate) showSuccessToast(Number(data.credits_added ?? fallbackCredits), data.product_name ?? details.name, details.type);
  } catch (e) {
    console.warn('[Credits] Server credit apply failed; not minting locally:', e);
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

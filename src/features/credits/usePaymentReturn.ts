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
    const uniqueId = paymentId || subscriptionId || `${productId}_${Date.now()}`;
    if (store.isPaymentProcessed(uniqueId)) {
      cleanUrl();
      return;
    }
    const details = DODO_PACK_DETAILS[productId];
    const credits = DODO_CREDIT_MAP[productId];
    store.addCredits(
      credits,
      productId,
      details.name,
      details.type === 'pack' ? 'purchase' : 'subscription',
      uniqueId,
    );
    if (details.type === 'subscription') {
      if (productId === 'pdt_0NbKNHJ5nK556qajM5MKa') store.setPlan('ultimate');
      if (productId === 'pdt_0Nbybrhl2M0GdzScdoAwb') store.setPlan('pro_plus');
    }
    showSuccessToast(credits, details.name, details.type);
    cleanUrl();
    return;
  }

  // CASE 2: plan param (subscription)
  if (planParam) {
    const planMap: Record<string, { productId: string; credits: number; name: string; tier: 'ultimate' | 'pro_plus' }> = {
      ultimate:  { productId: 'pdt_0NbKNHJ5nK556qajM5MKa', credits: 40,  name: 'Ultimate', tier: 'ultimate' },
      pro_plus:  { productId: 'pdt_0Nbybrhl2M0GdzScdoAwb', credits: 150, name: 'PRO+',     tier: 'pro_plus' },
      'pro+':    { productId: 'pdt_0Nbybrhl2M0GdzScdoAwb', credits: 150, name: 'PRO+',     tier: 'pro_plus' },
    };
    const data = planMap[planParam.toLowerCase()];
    if (data) {
      const uniqueId = subscriptionId || paymentId || `${planParam}_${Date.now()}`;
      if (!store.isPaymentProcessed(uniqueId)) {
        store.addCredits(data.credits, data.productId, data.name, 'subscription', uniqueId);
        store.setPlan(data.tier);
        showSuccessToast(data.credits, data.name, 'subscription');
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

function cleanUrl() {
  window.history.replaceState({}, '', window.location.pathname);
}

function showSuccessToast(credits: number, productName: string, type: string) {
  window.dispatchEvent(
    new CustomEvent('lumina:credits-added', { detail: { credits, productName, type } }),
  );
}

/**
 * Single source of truth for pricing redirects.
 * Per product decision: ALL pricing/upgrade entry points redirect to the
 * external Kimi pricing page.
 */
export const PRICING_URL = 'https://s32tb42f7cmko.kimi.page/#pricing';

export const openPricing = () => {
  window.open(PRICING_URL, '_blank', 'noopener');
};

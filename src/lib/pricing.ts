/**
 * Single source of truth for pricing redirects.
 * Per product decision: ALL pricing/upgrade entry points redirect to the
 * external pricing page hosted on Netlify.
 */
export const PRICING_URL = 'https://monumental-custard-d06d45.netlify.app/#pricing';

export const openPricing = () => {
  window.open(PRICING_URL, '_blank', 'noopener');
};

/**
 * Single source of truth for pricing redirects.
 * All in-app pricing entry points route to the in-app /upgrade page.
 */
export const PRICING_URL = '/upgrade';

export const openPricing = () => {
  // Same-tab navigation to keep auth + state intact.
  window.location.assign(PRICING_URL);
};

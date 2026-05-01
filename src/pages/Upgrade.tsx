/**
 * /upgrade route — redirects to external pricing page (per product decision).
 */
import { useEffect } from 'react';
import { PRICING_URL } from '@/lib/pricing';

const Upgrade = () => {
  useEffect(() => {
    window.location.replace(PRICING_URL);
  }, []);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
      <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-muted-foreground">Opening pricing…</p>
      <a
        href={PRICING_URL}
        rel="noopener"
        className="text-sm text-primary underline underline-offset-4 hover:no-underline"
      >
        Click here if you aren't redirected
      </a>
    </div>
  );
};

export default Upgrade;

import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useCreditsStore } from './useCreditsStore';
import { DODO_PACK_DETAILS, DODO_CREDIT_MAP } from './dodoPricing';
import { HelpCircle } from 'lucide-react';

export function ManualRestoreButton({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('lumina:show-restore-prompt', handler);
    return () => window.removeEventListener('lumina:show-restore-prompt', handler);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors ${className}`}
        title="Already paid but didn't get credits?"
      >
        <HelpCircle className="w-3 h-3" />
        Didn't receive credits?
      </button>
      <ManualRestoreModal open={open} onOpenChange={setOpen} />
    </>
  );
}

function ManualRestoreModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [productId, setProductId] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'duplicate'>('idle');
  const { isPaymentProcessed, markPaymentProcessed, setBalance } = useCreditsStore();

  useEffect(() => {
    if (open) {
      const pending = sessionStorage.getItem('pending_payment_id');
      if (pending) setPaymentId(pending);
    }
  }, [open]);

  const handleRestore = async () => {
    if (!productId) {
      setStatus('error');
      return;
    }
    const details = DODO_PACK_DETAILS[productId];
    const credits = DODO_CREDIT_MAP[productId];
    if (!details || !credits) {
      setStatus('error');
      return;
    }
    const uniqueId = paymentId.trim();
    if (!uniqueId) {
      // Server now requires a verifiable payment id — no more client-side mint fallback.
      setStatus('error');
      return;
    }
    if (isPaymentProcessed(uniqueId)) {
      setStatus('duplicate');
      return;
    }
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.functions.invoke('restore-dodo-credits', {
        body: { product_id: productId, payment_id: uniqueId },
      });
      if (error || !data?.applied) {
        if (data?.duplicate) {
          setStatus('duplicate');
          return;
        }
        setStatus('error');
        return;
      }
      const plan = data.plan === 'ultimate' || data.plan === 'pro_plus' || data.plan === 'free' ? data.plan : undefined;
      setBalance(Number(data.balance), plan);
      markPaymentProcessed(uniqueId);
      sessionStorage.removeItem('pending_payment_id');
      setStatus('success');
      window.dispatchEvent(
        new CustomEvent('lumina:credits-added', {
          detail: { credits, productName: details.name, type: details.type },
        }),
      );
      setTimeout(() => onOpenChange(false), 2200);
    } catch {
      setStatus('error');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <h2 className="text-lg font-bold tracking-tight mb-1">Restore Credits</h2>
        <p className="text-xs text-muted-foreground mb-4">
          If you completed a payment but didn't receive credits, select what you
          purchased below.
        </p>

        <label className="block text-xs font-medium mb-1">What did you purchase?</label>
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm mb-3"
        >
          <option value="">Select your purchase…</option>
          {Object.entries(DODO_PACK_DETAILS).map(([id, d]) => (
            <option key={id} value={id}>
              {d.name} — ⚡ {d.credits} credits — ₹{d.price}
            </option>
          ))}
        </select>

        <label className="block text-xs font-medium mb-1">
          Payment / Order ID <span className="text-muted-foreground">(optional)</span>
        </label>
        <input
          type="text"
          value={paymentId}
          onChange={(e) => setPaymentId(e.target.value)}
          placeholder="e.g. pay_xxxxxxxx (from Dodo email)"
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm mb-3"
        />

        {status === 'success' && (
          <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 mb-3">
            ✓ Credits restored. Check your balance.
          </div>
        )}
        {status === 'duplicate' && (
          <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 mb-3">
            This payment has already been applied to your account.
          </div>
        )}
        {status === 'error' && (
          <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2 mb-3">
            Please select a valid purchase. If the issue persists, contact{' '}
            <a href="mailto:support@luminaai.co.in" className="underline">
              support@luminaai.co.in
            </a>
            .
          </div>
        )}

        <button
          type="button"
          onClick={handleRestore}
          disabled={!productId || status === 'success'}
          className="w-full py-2.5 rounded-lg text-sm font-semibold bg-violet-500 hover:bg-violet-400 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
        >
          Restore Credits →
        </button>

        <p className="text-[10px] text-muted-foreground mt-3 text-center">
          By restoring you confirm this is a genuine purchase. Abuse will result
          in account suspension.
        </p>
      </DialogContent>
    </Dialog>
  );
}

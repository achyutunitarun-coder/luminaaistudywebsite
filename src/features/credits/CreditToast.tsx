import { useEffect, useState } from 'react';
import { Zap, X } from 'lucide-react';

interface ToastData {
  credits: number;
  productName: string;
  type: string;
}

export function CreditToast() {
  const [toast, setToast] = useState<ToastData | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ToastData>).detail;
      setToast(detail);
      const t = setTimeout(() => setToast(null), 6000);
      return () => clearTimeout(t);
    };
    window.addEventListener('lumina:credits-added', handler);
    return () => window.removeEventListener('lumina:credits-added', handler);
  }, []);

  if (!toast) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] flex items-center gap-3 max-w-sm rounded-2xl border border-violet-500/50 bg-card/95 backdrop-blur-xl px-4 py-3 shadow-[0_0_40px_rgba(124,58,237,0.3),0_8px_32px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-4 fade-in"
    >
      <div className="w-10 h-10 grid place-items-center rounded-xl bg-violet-500/15 text-violet-300">
        <Zap className="w-5 h-5" fill="currentColor" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-foreground">
          {toast.type === 'subscription'
            ? `${toast.productName} plan activated!`
            : 'Credits added!'}
        </div>
        <div className="text-xs text-violet-300 mt-0.5">
          +{toast.credits} credits added to your balance
        </div>
      </div>
      <button
        type="button"
        onClick={() => setToast(null)}
        className="text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

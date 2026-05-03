/**
 * Persistent credits store (Zustand + localStorage).
 * Survives refresh. Idempotent payment crediting.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CreditAction } from './creditsSystem';
import { CREDIT_COSTS, PLAN_CREDITS, type PlanTier } from './creditsSystem';

export type TxSource = 'purchase' | 'spend' | 'subscription' | 'manual_restore';

export interface CreditTransaction {
  id: string;
  productId: string;
  productName: string;
  credits: number;        // positive = added, negative = spent
  action: string;
  timestamp: number;
  source: TxSource;
}

export interface CreditsState {
  balance: number;
  plan: PlanTier;
  transactions: CreditTransaction[];
  processedPayments: string[];
  lastUpdated: number;

  addCredits: (amount: number, productId: string, productName: string, source: TxSource, paymentId?: string) => void;
  spendCredits: (amount: number, action: string) => boolean;
  hasCredits: (amount: number) => boolean;
  setPlan: (plan: PlanTier) => void;
  isPaymentProcessed: (paymentId: string) => boolean;
  markPaymentProcessed: (paymentId: string) => void;
  reset: () => void;
}

export const useCreditsStore = create<CreditsState>()(
  persist(
    (set, get) => ({
      balance: PLAN_CREDITS.free,
      plan: 'free',
      transactions: [],
      processedPayments: [],
      lastUpdated: Date.now(),

      addCredits: (amount, productId, productName, source, paymentId) => {
        if (paymentId && get().processedPayments.includes(paymentId)) {
          console.warn('[Credits] Payment already processed:', paymentId);
          return;
        }
        const tx: CreditTransaction = {
          id: crypto.randomUUID(),
          productId,
          productName,
          credits: amount,
          action: `Added ${amount} credits`,
          timestamp: Date.now(),
          source,
        };
        set((s) => ({
          balance: +(s.balance + amount).toFixed(2),
          transactions: [tx, ...s.transactions].slice(0, 100),
          processedPayments: paymentId ? [...s.processedPayments, paymentId] : s.processedPayments,
          lastUpdated: Date.now(),
        }));
      },

      spendCredits: (amount, action) => {
        if (get().balance < amount) return false;
        const tx: CreditTransaction = {
          id: crypto.randomUUID(),
          productId: 'spend',
          productName: action,
          credits: -amount,
          action,
          timestamp: Date.now(),
          source: 'spend',
        };
        set((s) => ({
          balance: Math.max(0, +(s.balance - amount).toFixed(2)),
          transactions: [tx, ...s.transactions].slice(0, 100),
          lastUpdated: Date.now(),
        }));
        return true;
      },

      hasCredits: (amount) => get().balance >= amount,
      setPlan: (plan) =>
        set((s) => ({
          plan,
          balance: Math.max(s.balance, PLAN_CREDITS[plan]),
        })),
      isPaymentProcessed: (id) => get().processedPayments.includes(id),
      markPaymentProcessed: (id) =>
        set((s) => ({ processedPayments: [...s.processedPayments, id] })),
      reset: () =>
        set({
          balance: PLAN_CREDITS.free,
          plan: 'free',
          transactions: [],
          processedPayments: [],
          lastUpdated: Date.now(),
        }),
    }),
    {
      name: 'lumina-credits-v2',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

/**
 * Backward-compat actions. ChatPage.tsx imports `creditsActions.deduct(action)`.
 */
export const creditsActions = {
  deduct(action: CreditAction) {
    const cost = CREDIT_COSTS[action];
    useCreditsStore.getState().spendCredits(cost, action.replace(/_/g, ' '));
  },
  add(amount: number, source: string) {
    useCreditsStore
      .getState()
      .addCredits(amount, 'manual', source, 'purchase');
  },
  setPlan(plan: PlanTier) {
    useCreditsStore.getState().setPlan(plan);
  },
  reset() {
    useCreditsStore.getState().reset();
  },
};

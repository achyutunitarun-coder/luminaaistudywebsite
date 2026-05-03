/**
 * Local credits store (Zustand-style with React hook).
 * Persists balance + transactions in localStorage.
 *
 * NOTE: This is a client-side optimistic ledger so the UI feels live.
 * The authoritative balance lives server-side (Dodo webhook → DB).
 * On mount we hydrate from localStorage; webhooks/refresh can update it.
 */

import { useSyncExternalStore } from 'react';
import type { CreditAction, PlanTier } from './creditsSystem';
import { CREDIT_COSTS, PLAN_CREDITS } from './creditsSystem';

export interface CreditTransaction {
  id: string;
  action: string;
  amount: number;
  timestamp: number;
  success: boolean;
  description: string;
}

export interface CreditsState {
  balance: number;
  plan: PlanTier;
  monthlyAllocation: number;
  purchasedCredits: number;
  lastRefreshDate: string;
  transactions: CreditTransaction[];
}

const KEY = 'lumina_credits_v1';

const initial: CreditsState = {
  balance: PLAN_CREDITS.free,
  plan: 'free',
  monthlyAllocation: PLAN_CREDITS.free,
  purchasedCredits: 0,
  lastRefreshDate: new Date().toISOString().slice(0, 10),
  transactions: [],
};

function load(): CreditsState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initial;
    const parsed = JSON.parse(raw) as CreditsState;
    return { ...initial, ...parsed };
  } catch {
    return initial;
  }
}

function save(state: CreditsState) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

const listeners = new Set<() => void>();
let state: CreditsState = typeof window === 'undefined' ? initial : load();

function setState(updater: (prev: CreditsState) => CreditsState) {
  state = updater(state);
  save(state);
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }
function getSnapshot() { return state; }

export function useCreditsStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export const creditsActions = {
  deduct(action: CreditAction) {
    const cost = CREDIT_COSTS[action];
    setState((p) => ({
      ...p,
      balance: Math.max(0, +(p.balance - cost).toFixed(2)),
      transactions: [
        {
          id: crypto.randomUUID(),
          action,
          amount: -cost,
          timestamp: Date.now(),
          success: true,
          description: `${action.replace(/_/g, ' ')} generated`,
        },
        ...p.transactions.slice(0, 49),
      ],
    }));
  },

  add(amount: number, source: string) {
    setState((p) => ({
      ...p,
      balance: +(p.balance + amount).toFixed(2),
      purchasedCredits: p.purchasedCredits + amount,
      transactions: [
        {
          id: crypto.randomUUID(),
          action: 'purchase',
          amount: +amount,
          timestamp: Date.now(),
          success: true,
          description: `Purchased ${amount} credits (${source})`,
        },
        ...p.transactions.slice(0, 49),
      ],
    }));
  },

  setPlan(plan: PlanTier) {
    setState((p) => ({
      ...p,
      plan,
      monthlyAllocation: PLAN_CREDITS[plan],
      // Top up to at least the plan's monthly allocation
      balance: Math.max(p.balance, PLAN_CREDITS[plan]),
    }));
  },

  reset() {
    setState(() => initial);
  },
};

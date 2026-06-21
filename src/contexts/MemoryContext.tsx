import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// ─── Types ───
export interface UserPreferences {
  id: string;
  user_id: string;
  theme: string;
  language: string;
  notifications_enabled: boolean;
  preferred_model: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ActivityItem {
  id: string;
  user_id: string;
  action: string;
  category: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  page_url: string | null;
  created_at: string;
}

export interface LearningProgressItem {
  id: string;
  user_id: string;
  topic: string;
  category: string | null;
  status: string;
  score: number | null;
  credits_earned: number;
  time_spent_seconds: number;
  interactions_count: number;
  last_studied_at: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface RecentlyViewedItem {
  id: string;
  user_id: string;
  content_type: string;
  content_id: string | null;
  title: string | null;
  url: string | null;
  thumbnail_url: string | null;
  metadata: Record<string, unknown>;
  viewed_at: string;
}

export interface MemorySummary {
  topicsStudied: number;
  totalCredits: number;
  averageScore: number;
  currentStreak: number;
  recentActivity: ActivityItem[];
  recentlyViewed: RecentlyViewedItem[];
  preferences: UserPreferences | null;
  weeklyActivityCount: number;
}

interface MemoryContextType {
  preferences: UserPreferences | null;
  activityLog: ActivityItem[];
  progress: LearningProgressItem[];
  recentlyViewed: RecentlyViewedItem[];
  summary: MemorySummary | null;
  logActivity: (action: string, category: string, description?: string, metadata?: Record<string, unknown>) => Promise<void>;
  updatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
  updateProgress: (topic: string, data?: Partial<LearningProgressItem>) => Promise<void>;
  addRecentlyViewed: (item: Omit<RecentlyViewedItem, "id" | "user_id" | "viewed_at">) => Promise<void>;
  refreshSummary: () => Promise<void>;
  loading: boolean;
}

const MemoryContext = createContext<MemoryContextType | null>(null);

const MEMORY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export function MemoryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityItem[]>([]);
  const [progress, setProgress] = useState<LearningProgressItem[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedItem[]>([]);
  const [summary, setSummary] = useState<MemorySummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch all memory data
  const fetchMemory = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      const [prefsRes, progressRes, viewedRes, summaryRes] = await Promise.all([
        fetch(`${MEMORY_URL}/memory-preferences`, { headers }),
        fetch(`${MEMORY_URL}/memory-progress`, { headers }),
        fetch(`${MEMORY_URL}/memory-recently-viewed?limit=20`, { headers }),
        fetch(`${MEMORY_URL}/memory-summary`, { headers }),
      ]);

      if (prefsRes.ok) {
        const p = await prefsRes.json();
        if (p && p.id) setPreferences(p);
      }
      if (progressRes.ok) {
        const p = await progressRes.json();
        setProgress(Array.isArray(p) ? p : []);
      }
      if (viewedRes.ok) {
        const v = await viewedRes.json();
        setRecentlyViewed(Array.isArray(v) ? v : []);
      }
      if (summaryRes.ok) {
        const s = await summaryRes.json();
        if (s && typeof s === "object" && "topicsStudied" in s) setSummary(s);
      }
    } catch (e) {
      console.error("Memory fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMemory();
  }, [fetchMemory]);

  // Log activity (fire-and-forget)
  const logActivity = useCallback(
    async (action: string, category: string, description?: string, metadata?: Record<string, unknown>) => {
      if (!user) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;

        await fetch(`${MEMORY_URL}/memory-log`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            action,
            category,
            description: description ?? null,
            metadata: metadata ?? {},
            page_url: typeof window !== "undefined" ? window.location.pathname : null,
          }),
        });
      } catch (e) {
        console.error("logActivity error:", e);
      }
    },
    [user],
  );

  // Update preferences
  const updatePreferences = useCallback(
    async (prefs: Partial<UserPreferences>) => {
      if (!user) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;

        const res = await fetch(`${MEMORY_URL}/memory-preferences`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(prefs),
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.id) setPreferences(data);
        }
      } catch (e) {
        console.error("updatePreferences error:", e);
      }
    },
    [user],
  );

  // Update progress
  const updateProgress = useCallback(
    async (topic: string, data?: Partial<LearningProgressItem>) => {
      if (!user) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;

        const res = await fetch(`${MEMORY_URL}/memory-progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ topic, ...data }),
        });
        if (res.ok) {
          // Refresh progress list
          const progressRes = await fetch(`${MEMORY_URL}/memory-progress`, {
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          });
          if (progressRes.ok) {
            const p = await progressRes.json();
            setProgress(Array.isArray(p) ? p : []);
          }
        }
      } catch (e) {
        console.error("updateProgress error:", e);
      }
    },
    [user],
  );

  // Add recently viewed
  const addRecentlyViewed = useCallback(
    async (item: Omit<RecentlyViewedItem, "id" | "user_id" | "viewed_at">) => {
      if (!user) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;

        await fetch(`${MEMORY_URL}/memory-recently-viewed`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(item),
        });
      } catch (e) {
        console.error("addRecentlyViewed error:", e);
      }
    },
    [user],
  );

  // Refresh summary
  const refreshSummary = useCallback(async () => {
    if (!user) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const res = await fetch(`${MEMORY_URL}/memory-summary`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const s = await res.json();
        if (s && typeof s === "object" && "topicsStudied" in s) setSummary(s);
      }
    } catch (e) {
      console.error("refreshSummary error:", e);
    }
  }, [user]);

  return (
    <MemoryContext.Provider
      value={{
        preferences,
        activityLog,
        progress,
        recentlyViewed,
        summary,
        logActivity,
        updatePreferences,
        updateProgress,
        addRecentlyViewed,
        refreshSummary,
        loading,
      }}
    >
      {children}
    </MemoryContext.Provider>
  );
}

export function useMemory(): MemoryContextType {
  const ctx = useContext(MemoryContext);
  if (!ctx) throw new Error("useMemory must be used within MemoryProvider");
  return ctx;
}

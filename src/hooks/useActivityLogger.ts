import { useEffect } from "react";
import { useMemory } from "@/contexts/MemoryContext";

/**
 * Drop into any page to auto-log a page view activity.
 * Usage: useActivityLogger("page_view", "navigation")
 */
export function useActivityLogger(action: string, category: string, metadata?: Record<string, unknown>) {
  const { logActivity } = useMemory();
  useEffect(() => {
    logActivity(action, category, `Viewed ${typeof window !== "undefined" ? window.location.pathname : ""}`, {
      page: typeof window !== "undefined" ? window.location.pathname : "",
      ...metadata,
    });
  }, [action, category, logActivity]);
}

import { supabase } from "@/integrations/supabase/client";

/** True when an auth error means the stored token can no longer be verified. */
export function isStaleTokenError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err ?? "").toLowerCase();
  const code = String((err as { code?: string })?.code ?? "").toLowerCase();
  return (
    code === "bad_jwt" ||
    msg.includes("bad_jwt") ||
    msg.includes("unrecognized jwt kid") ||
    msg.includes("token is unverifiable") ||
    msg.includes("invalid refresh token") ||
    msg.includes("refresh token not found") ||
    msg.includes("user_not_found")
  );
}

/** Drop an unusable session so the app returns to a clean signed-out state. */
export async function clearStaleSession(): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    /* ignore */
  }
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("sb-") && k.includes("auth-token"))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export async function getAuthToken(): Promise<string> {
  // Refresh the session first for a guaranteed-fresh token.
  // Supabase uses rotating refresh tokens, so this is safe to call repeatedly.
  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshData?.session?.access_token) return refreshData.session.access_token;
  if (refreshError && isStaleTokenError(refreshError)) {
    await clearStaleSession();
    throw new Error("Not authenticated");
  }

  // Fall back to cached session with retries
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) return session.access_token;
    if (attempt < 2) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
  }
  throw new Error("Not authenticated");
}


export async function fetchWithAuth(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${await getAuthToken()}`);
  let res = await fetch(input, { ...init, headers });

  // Up to 2 retries on 401: refresh session and retry with fresh token
  for (let retry = 0; retry < 2 && res.status === 401; retry++) {
    const { data } = await supabase.auth.refreshSession();
    if (!data?.session?.access_token) break;
    headers.set("Authorization", `Bearer ${data.session.access_token}`);
    // Small backoff before retry
    if (retry > 0) await new Promise((r) => setTimeout(r, 200 * retry));
    res = await fetch(input, { ...init, headers });
  }

  return res;
}

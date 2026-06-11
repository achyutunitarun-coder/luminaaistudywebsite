import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Verify the request is from an authenticated user.
 * Returns { user, sb } on success, or a Response (401) on failure.
 */
export async function requireUser(req: Request, corsHeaders: Record<string, string>) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      error: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    } as const;
  }
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  // Prefer asymmetric JWT verification via getClaims (signing-keys system).
  // Falls back to getUser() for legacy HS256 tokens.
  let userId: string | null = null;
  let email: string | null = null;
  try {
    // @ts-ignore - getClaims exists in supabase-js v2.45+
    const { data: claimsData, error: claimsErr } = await sb.auth.getClaims(token);
    if (!claimsErr && claimsData?.claims?.sub) {
      userId = claimsData.claims.sub as string;
      email = (claimsData.claims.email as string) ?? null;
    }
  } catch { /* ignore, fall back */ }

  if (!userId) {
    const { data, error } = await sb.auth.getUser(token);
    if (!error && data?.user) {
      userId = data.user.id;
      email = data.user.email ?? null;
    }
  }

  if (!userId) {
    return {
      error: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    } as const;
  }
  return { user: { id: userId, email }, sb } as const;
}

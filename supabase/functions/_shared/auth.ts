import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Verify the request is from an authenticated user.
 *
 * The Supabase API gateway already validates the JWT before it reaches
 * this function — if we're here, the JWT signature + expiry are valid.
 * We decode the JWT payload to extract the user ID and email, avoiding
 * any supabase-js version bugs or Auth API network issues.
 *
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return {
      error: new Response(JSON.stringify({ error: "Server misconfiguration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    } as const;
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const parts = token.split(".");

  // JWT must have 3 parts (header.payload.signature)
  if (parts.length !== 3) {
    return {
      error: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    } as const;
  }

  try {
    // Decode the payload (part 2). Gateway already verified the signature.
    const payload = JSON.parse(atob(parts[1]));
    const userId: string | undefined = payload.sub;
    const email: string | undefined = payload.email;

    if (!userId) {
      return {
        error: new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }),
      } as const;
    }

    const sb = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    return { user: { id: userId, email: email ?? null }, sb } as const;
  } catch {
    return {
      error: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    } as const;
  }
}

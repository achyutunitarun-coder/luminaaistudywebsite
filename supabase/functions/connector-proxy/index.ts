// Lumina Connector Proxy — calls upstream APIs using the user's stored OAuth tokens.
// Handles Google access-token refresh transparently. Keeps tokens server-side.
//
// POST { provider: "google"|"notion", method: "GET"|"POST"|..., url, body?, headers? }
//   → upstream JSON response (with HTTP status preserved when reasonable).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_HOSTS = new Set([
  "gmail.googleapis.com",
  "www.googleapis.com",
  "calendar.googleapis.com",        // alias - some clients use this
  "docs.googleapis.com",            // Google Docs (create/edit)
  "sheets.googleapis.com",          // Google Sheets
  "api.notion.com",
]);

function j(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function refreshGoogleToken(refreshToken: string, scopes: string[] = []) {
  const body = new URLSearchParams({
    client_id: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!,
    client_secret: Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  if (scopes.length) body.set("scope", scopes.join(" "));

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tok = await res.json();
  if (!res.ok) throw new Error(`refresh_failed: ${JSON.stringify(tok)}`);
  return tok as { access_token: string; expires_in: number; token_type: string };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return j(401, { error: "unauthorized" });

    const userSb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user }, error: uerr } = await userSb.auth.getUser();
    if (uerr || !user) return j(401, { error: "unauthorized" });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const provider = body.provider as "google" | "notion";
    const method = String(body.method || "GET").toUpperCase();
    const url = String(body.url || "");
    const upstreamBody = body.body;
    const extraHeaders = (body.headers ?? {}) as Record<string, string>;

    if (!provider || !url) return j(400, { error: "provider + url required" });
    let parsed: URL;
    try { parsed = new URL(url); } catch { return j(400, { error: "bad url" }); }
    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
      return j(400, { error: `host not allowed: ${parsed.hostname}` });
    }

    // Load connection
    const { data: conn, error: cerr } = await admin
      .from("user_connections")
      .select("access_token,refresh_token,token_expires_at,scopes,metadata")
      .eq("user_id", user.id)
      .eq("provider", provider)
      .maybeSingle();
    if (cerr) return j(500, { error: cerr.message });
    if (!conn) return j(404, { error: "not_connected" });

    let accessToken = conn.access_token as string;

    // Refresh Google token if near expiry
    if (provider === "google" && conn.refresh_token) {
      const exp = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
      if (!exp || exp - Date.now() < 30_000) {
        try {
          const r = await refreshGoogleToken(conn.refresh_token, conn.scopes ?? []);
          accessToken = r.access_token;
          await admin.from("user_connections").update({
            access_token: r.access_token,
            token_expires_at: new Date(Date.now() + (r.expires_in - 60) * 1000).toISOString(),
          }).eq("user_id", user.id).eq("provider", "google");
        } catch (e) {
          return j(401, { error: "google_refresh_failed", detail: String(e) });
        }
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      ...extraHeaders,
    };
    if (provider === "notion") {
      headers["Notion-Version"] = "2022-06-28";
      headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
    }

    const init: RequestInit = { method, headers };
    if (method !== "GET" && method !== "HEAD" && upstreamBody !== undefined) {
      init.body = typeof upstreamBody === "string"
        ? upstreamBody
        : JSON.stringify(upstreamBody);
      if (typeof upstreamBody !== "string" && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      }
    }

    const upstream = await fetch(parsed.toString(), init);
    const txt = await upstream.text();
    let payload: unknown;
    try { payload = JSON.parse(txt); } catch { payload = { error: txt.slice(0, 500) }; }

    return new Response(JSON.stringify({ ok: upstream.ok, status: upstream.status, data: payload }), {
      status: 200, // wrap so the client can read errors without exception
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return j(500, { error: e instanceof Error ? e.message : String(e) });
  }
});

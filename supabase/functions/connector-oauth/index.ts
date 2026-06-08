// Lumina Connector OAuth — per-user OAuth for Google (Gmail/Calendar/Drive) + Notion.
// Actions:
//   POST { action: "start",     provider: "google"|"notion", services?: string[], redirect_uri }
//     → { url } — user navigates browser here.
//   POST { action: "exchange",  provider, code, redirect_uri }
//     → { ok, provider, account_email } — tokens stored server-side.
//   POST { action: "disconnect", provider } → { ok }
//   POST { action: "list" }                 → { connections: [...] } (no tokens returned)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GOOGLE_SCOPES: Record<string, string> = {
  gmail: "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.compose",
  calendar: "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events",
  drive: "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/documents",
  profile: "openid email profile",
};

const NOTION_SCOPES = ""; // Notion does not use space-separated scopes; the integration's settings define them.

function j(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
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
    const action = String(body.action || "");

    // ── start ──────────────────────────────────────────────────────────
    if (action === "start") {
      const provider = body.provider as "google" | "notion";
      const redirect = String(body.redirect_uri || "");
      if (!redirect) return j(400, { error: "redirect_uri required" });
      const state = `${provider}.${user.id}.${crypto.randomUUID().slice(0, 8)}`;

      if (provider === "google") {
        const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
        if (!clientId) return j(500, { error: "GOOGLE_OAUTH_CLIENT_ID missing" });
        const requested: string[] = Array.isArray(body.services) && body.services.length
          ? body.services
          : ["gmail", "calendar", "drive"];
        const { data: existingGoogle } = await admin
          .from("user_connections")
          .select("scopes")
          .eq("user_id", user.id)
          .eq("provider", "google")
          .maybeSingle();
        const existingScopes = String((existingGoogle?.scopes ?? []).join(" "));
        const keepExisting = [
          /gmail/.test(existingScopes) ? "gmail" : "",
          /calendar/.test(existingScopes) ? "calendar" : "",
          /drive|documents/.test(existingScopes) ? "drive" : "",
        ].filter(Boolean);
        const services = Array.from(new Set([...requested, ...keepExisting, "profile"]));
        const scope = services.map((s) => GOOGLE_SCOPES[s]).filter(Boolean).join(" ");
        const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        url.searchParams.set("client_id", clientId);
        url.searchParams.set("redirect_uri", redirect);
        url.searchParams.set("response_type", "code");
        url.searchParams.set("scope", scope);
        url.searchParams.set("access_type", "offline");
        url.searchParams.set("prompt", "consent");
        url.searchParams.set("include_granted_scopes", "true");
        url.searchParams.set("state", state);
        return j(200, { url: url.toString(), state });
      }

      if (provider === "notion") {
        const clientId = Deno.env.get("NOTION_OAUTH_CLIENT_ID");
        if (!clientId) return j(500, { error: "NOTION_OAUTH_CLIENT_ID missing" });
        const url = new URL("https://api.notion.com/v1/oauth/authorize");
        url.searchParams.set("client_id", clientId);
        url.searchParams.set("redirect_uri", redirect);
        url.searchParams.set("response_type", "code");
        url.searchParams.set("owner", "user");
        url.searchParams.set("state", state);
        return j(200, { url: url.toString(), state });
      }
      return j(400, { error: "unknown provider" });
    }

    // ── exchange ───────────────────────────────────────────────────────
    if (action === "exchange") {
      const provider = body.provider as "google" | "notion";
      const code = String(body.code || "");
      const redirect = String(body.redirect_uri || "");
      if (!code || !redirect) return j(400, { error: "code & redirect_uri required" });

      if (provider === "google") {
        const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
        const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;
        const res = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code, client_id: clientId, client_secret: clientSecret,
            redirect_uri: redirect, grant_type: "authorization_code",
          }),
        });
        const tok = await res.json();
        if (!res.ok) return j(400, { error: "google_token_failed", detail: tok });

        // Fetch user email
        let email: string | null = null;
        try {
          const p = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { Authorization: `Bearer ${tok.access_token}` },
          }).then((r) => r.json());
          email = p?.email ?? null;
        } catch { /* non-fatal */ }

        const expiresAt = tok.expires_in
          ? new Date(Date.now() + (Number(tok.expires_in) - 60) * 1000).toISOString()
          : null;

        const { data: existing } = await admin
          .from("user_connections")
          .select("refresh_token")
          .eq("user_id", user.id)
          .eq("provider", "google")
          .maybeSingle();

        const scopes = String(tok.scope || "").split(" ").filter(Boolean);

        const { error: upErr } = await admin.from("user_connections").upsert({
          user_id: user.id,
          provider: "google",
          account_email: email,
          account_label: email ?? "Google",
          scopes,
          access_token: tok.access_token,
          refresh_token: tok.refresh_token ?? existing?.refresh_token ?? null,
          token_expires_at: expiresAt,
          metadata: { token_type: tok.token_type ?? "Bearer" },
        }, { onConflict: "user_id,provider" });
        if (upErr) return j(500, { error: "store_failed", detail: upErr.message });
        return j(200, { ok: true, provider: "google", account_email: email, scopes });
      }

      if (provider === "notion") {
        const clientId = Deno.env.get("NOTION_OAUTH_CLIENT_ID")!;
        const clientSecret = Deno.env.get("NOTION_OAUTH_CLIENT_SECRET")!;
        const basic = btoa(`${clientId}:${clientSecret}`);
        const res = await fetch("https://api.notion.com/v1/oauth/token", {
          method: "POST",
          headers: {
            Authorization: `Basic ${basic}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            grant_type: "authorization_code",
            code, redirect_uri: redirect,
          }),
        });
        const tok = await res.json();
        if (!res.ok) return j(400, { error: "notion_token_failed", detail: tok });

        const { error: upErr } = await admin.from("user_connections").upsert({
          user_id: user.id,
          provider: "notion",
          account_email: tok?.owner?.user?.person?.email ?? null,
          account_label: tok?.workspace_name ?? "Notion",
          scopes: [],
          access_token: tok.access_token,
          refresh_token: null,
          token_expires_at: null,
          metadata: {
            workspace_id: tok.workspace_id,
            workspace_name: tok.workspace_name,
            workspace_icon: tok.workspace_icon,
            bot_id: tok.bot_id,
          },
        }, { onConflict: "user_id,provider" });
        if (upErr) return j(500, { error: "store_failed", detail: upErr.message });
        return j(200, { ok: true, provider: "notion", account_email: tok?.workspace_name });
      }
      return j(400, { error: "unknown provider" });
    }

    // ── disconnect ─────────────────────────────────────────────────────
    if (action === "disconnect") {
      const provider = String(body.provider || "");
      const { error: delErr } = await admin
        .from("user_connections")
        .delete()
        .eq("user_id", user.id)
        .eq("provider", provider);
      if (delErr) return j(500, { error: delErr.message });
      return j(200, { ok: true });
    }

    // ── list ───────────────────────────────────────────────────────────
    if (action === "list") {
      const { data, error } = await admin
        .from("user_connections")
        .select("provider,account_email,account_label,scopes,metadata,created_at,token_expires_at")
        .eq("user_id", user.id);
      if (error) return j(500, { error: error.message });
      return j(200, { connections: data ?? [] });
    }

    return j(400, { error: "unknown action" });
  } catch (e) {
    return j(500, { error: e instanceof Error ? e.message : String(e) });
  }
});

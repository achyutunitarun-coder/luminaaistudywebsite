// Thin client for the connector edge functions.
// All upstream API calls go through `proxy` so tokens stay server-side.

import { supabase } from "@/integrations/supabase/client";
import {
  GOOGLE_REDIRECT_PATH,
  NOTION_REDIRECT_PATH,
  redirectUri,
  type ConnectorProvider,
  type ConnectorServiceId,
} from "./config";

const OAUTH_FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/connector-oauth`;
const PROXY_FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/connector-proxy`;

async function authHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token ?? ""}`,
  };
}

export interface UserConnection {
  provider: ConnectorProvider;
  account_email: string | null;
  account_label: string | null;
  scopes: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  token_expires_at: string | null;
}

export async function listConnections(): Promise<UserConnection[]> {
  const res = await fetch(OAUTH_FN, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ action: "list" }),
  });
  const j = await res.json();
  return (j.connections as UserConnection[]) ?? [];
}

export async function startOAuth(
  provider: ConnectorProvider,
  services?: ConnectorServiceId[],
): Promise<string> {
  const path = provider === "google" ? GOOGLE_REDIRECT_PATH : NOTION_REDIRECT_PATH;
  const res = await fetch(OAUTH_FN, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      action: "start", provider, redirect_uri: redirectUri(path),
      services: services?.filter((s) => s !== "notion"),
    }),
  });
  const j = await res.json();
  if (!res.ok || !j.url) throw new Error(j.error || "oauth_start_failed");
  return j.url as string;
}

export async function exchangeOAuth(
  provider: ConnectorProvider,
  code: string,
): Promise<{ ok: boolean; account_email?: string }> {
  const path = provider === "google" ? GOOGLE_REDIRECT_PATH : NOTION_REDIRECT_PATH;
  const res = await fetch(OAUTH_FN, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      action: "exchange", provider, code, redirect_uri: redirectUri(path),
    }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || "oauth_exchange_failed");
  return j;
}

export async function disconnect(provider: ConnectorProvider): Promise<void> {
  await fetch(OAUTH_FN, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ action: "disconnect", provider }),
  });
}

interface ProxyArgs {
  provider: ConnectorProvider;
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
}

export async function proxy<T = unknown>(args: ProxyArgs): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(PROXY_FN, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ method: "GET", ...args }),
  });
  return res.json();
}

// ── Convenience wrappers per service ─────────────────────────────────

export const gmailApi = {
  list: (max = 5) =>
    proxy<{ messages?: Array<{ id: string; threadId: string }> }>({
      provider: "google",
      url: `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${max}&q=in:inbox`,
    }),
  get: (id: string) =>
    proxy<any>({
      provider: "google",
      url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
    }),
  send: (raw: string) =>
    proxy<any>({
      provider: "google",
      method: "POST",
      url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`,
      body: { raw },
    }),
};

export const calendarApi = {
  list: () => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const end = new Date(now); end.setDate(end.getDate() + 2);
    const p = new URLSearchParams({
      timeMin: now.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "8",
    });
    return proxy<{ items?: any[] }>({
      provider: "google",
      url: `https://www.googleapis.com/calendar/v3/calendars/primary/events?${p}`,
    });
  },
  create: (event: Record<string, unknown>) =>
    proxy<any>({
      provider: "google",
      method: "POST",
      url: `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
      body: event,
    }),
};

export const driveApi = {
  list: (q?: string) => {
    const search = q
      ? `name contains '${q.replace(/'/g, "\\'")}' and trashed = false`
      : "trashed = false and mimeType != 'application/vnd.google-apps.folder'";
    const p = new URLSearchParams({
      q: search,
      orderBy: "modifiedTime desc",
      pageSize: "10",
      fields: "files(id,name,mimeType,modifiedTime,webViewLink,iconLink)",
    });
    return proxy<{ files?: any[] }>({
      provider: "google",
      url: `https://www.googleapis.com/drive/v3/files?${p}`,
    });
  },
  export: (id: string, mime = "text/plain") =>
    proxy<string>({
      provider: "google",
      url: `https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=${encodeURIComponent(mime)}`,
    }),
  download: (id: string) =>
    proxy<string>({
      provider: "google",
      url: `https://www.googleapis.com/drive/v3/files/${id}?alt=media`,
    }),
};

export const notionApi = {
  search: (query = "") =>
    proxy<{ results?: any[] }>({
      provider: "notion",
      method: "POST",
      url: `https://api.notion.com/v1/search`,
      body: { query, sort: { direction: "descending", timestamp: "last_edited_time" }, page_size: 10 },
    }),
  blocks: (pageId: string) =>
    proxy<{ results?: any[] }>({
      provider: "notion",
      url: `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`,
    }),
};

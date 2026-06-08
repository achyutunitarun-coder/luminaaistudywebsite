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
  const j = await res.json().catch(() => ({ error: "bad_oauth_response" }));
  if (!res.ok) throw new Error(j?.error || "connector_list_failed");
  return (j.connections as UserConnection[]) ?? [];
}

export async function startOAuth(
  provider: ConnectorProvider,
  services?: ConnectorServiceId[],
): Promise<string> {
  const path = provider === "google" ? GOOGLE_REDIRECT_PATH : NOTION_REDIRECT_PATH;
  if (provider === "google" && typeof sessionStorage !== "undefined") {
    const requested = (services ?? ["gmail", "calendar", "drive"]).filter((s) => s !== "notion");
    sessionStorage.setItem("lumina_google_pending_services", JSON.stringify(requested));
  }
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
): Promise<{ ok: boolean; account_email?: string; scopes?: string[] }> {
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
  const payload = await res.json().catch(() => ({ ok: false, status: res.status, data: null, error: "bad_proxy_response" }));
  if (!res.ok || payload?.ok === false) {
    const detail = payload?.data?.error?.message || payload?.data?.error || payload?.error || `connector_http_${payload?.status ?? res.status}`;
    const message = String(detail).includes("insufficient")
      ? "The connected account is missing a required permission. Reconnect it from Connectors and approve Gmail/Calendar/Drive access."
      : String(detail);
    throw new Error(message);
  }
  return payload;
}

// ── Convenience wrappers per service ─────────────────────────────────

export const gmailApi = {
  list: (max = 5) =>
    proxy<{ messages?: Array<{ id: string; threadId: string }> }>({
      provider: "google",
      url: `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${max}&q=in:inbox`,
    }),
  search: (q: string, max = 10) =>
    proxy<{ messages?: Array<{ id: string; threadId: string }> }>({
      provider: "google",
      url: `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${max}&q=${encodeURIComponent(q)}`,
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
  calendar: (calendarId = "primary") =>
    proxy<any>({
      provider: "google",
      url: `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`,
    }),
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
  get: (eventId: string, calendarId = "primary") =>
    proxy<any>({
      provider: "google",
      url: `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    }),
  listAround: (timeMin: string, timeMax: string, calendarId = "primary") => {
    const p = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "20",
    });
    return proxy<{ items?: any[] }>({
      provider: "google",
      url: `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${p}`,
    });
  },
  create: (event: Record<string, unknown>, calendarId = "primary") =>
    proxy<any>({
      provider: "google",
      method: "POST",
      url: `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=0&sendUpdates=none`,
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
  // Create a Google Doc with the given content. Two-step: create file → insert text.
  createDoc: async (title: string, content: string) => {
    const created = await proxy<{ documentId: string }>({
      provider: "google",
      method: "POST",
      url: `https://docs.googleapis.com/v1/documents`,
      body: { title },
    });
    // Allow docs.googleapis.com via proxy too — we add it server-side. Insert text:
    const documentId = (created.data as any)?.documentId;
    if (documentId && content) {
      await proxy<any>({
        provider: "google",
        method: "POST",
        url: `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
        body: {
          requests: [{ insertText: { location: { index: 1 }, text: content } }],
        },
      });
    }
    return {
      ok: true,
      status: 200,
      data: {
        documentId,
        url: documentId ? `https://docs.google.com/document/d/${documentId}/edit` : null,
      },
    };
  },
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
  // Create a Notion page under a parent. If no parent_id given, pick the most recent
  // page the integration has access to as the parent.
  createPage: async (title: string, content: string, parentId?: string) => {
    let parent_id = parentId;
    if (!parent_id) {
      const s = await notionApi.search("");
      const firstPage = s.data?.results?.find((r: any) => r.object === "page");
      parent_id = firstPage?.id;
      if (!parent_id) {
        throw new Error("No accessible Notion page found. Share a page with the Lumina Notion integration first.");
      }
    }
    // Split content into paragraph blocks (Notion max 2000 chars per rich_text)
    const chunks: string[] = [];
    const paras = (content || "").split(/\n{2,}/);
    for (const p of paras) {
      const t = p.trim();
      if (!t) continue;
      for (let i = 0; i < t.length; i += 1800) chunks.push(t.slice(i, i + 1800));
    }
    const children = chunks.map((text) => ({
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: [{ type: "text", text: { content: text } }] },
    }));
    return proxy<any>({
      provider: "notion",
      method: "POST",
      url: `https://api.notion.com/v1/pages`,
      body: {
        parent: { page_id: parent_id },
        properties: {
          title: { title: [{ type: "text", text: { content: title.slice(0, 200) } }] },
        },
        children,
      },
    });
  },
};

import { gmailApi } from "./api";

interface GmailLiteContext {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  body: string;
}

function header(headers: any[], name: string) {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decodeBody(payload: any): string {
  const decode = (data: string) => {
    try {
      return atob(data.replace(/-/g, "+").replace(/_/g, "/"));
    } catch {
      return "";
    }
  };
  if (payload?.body?.data) return decode(payload.body.data);
  if (Array.isArray(payload?.parts)) {
    const text = payload.parts.find((p: any) => p.mimeType === "text/plain");
    if (text?.body?.data) return decode(text.body.data);
    const html = payload.parts.find((p: any) => p.mimeType === "text/html");
    if (html?.body?.data) return decode(html.body.data).replace(/<[^>]+>/g, "");
    for (const p of payload.parts) {
      const inner = decodeBody(p);
      if (inner) return inner;
    }
  }
  return "";
}

export function isGmailRequest(text: string): boolean {
  const t = text.toLowerCase();
  // Direct mentions of inbox / unread always qualify.
  if (/\b(my\s+inbox|inbox|unread|new\s+(?:emails?|mails?)|any\s+(?:emails?|mails?))\b/.test(t)) return true;
  // Otherwise we need an email noun + an action verb.
  const noun = /\b(gmail|email|emails|mail|mails|message|messages)\b/.test(t);
  const verb = /\b(check|read|recent|latest|summari[sz]e|review|scan|find|look|show|list|fetch|get|pull|open|got|have)\b/.test(t);
  return noun && verb;
}


export async function loadRecentGmailContext(max = 5): Promise<string> {
  const list = await gmailApi.list(max);
  const ids = list.data?.messages ?? [];
  if (!ids.length) return "Gmail is connected, but the inbox returned no recent messages.";

  const details = await Promise.all(ids.slice(0, max).map((m: any) => gmailApi.get(m.id)));
  const mails: GmailLiteContext[] = details.map((d: any) => {
    const h = d.data?.payload?.headers ?? [];
    return {
      id: d.data?.id ?? "",
      subject: header(h, "Subject") || "(no subject)",
      from: header(h, "From") || "Unknown sender",
      date: header(h, "Date") || "",
      snippet: d.data?.snippet ?? "",
      body: decodeBody(d.data?.payload).slice(0, 2500),
    };
  });

  return [
    "--- LIVE GMAIL CONTEXT: RECENT INBOX EMAILS ---",
    ...mails.map((m, i) => [
      `Email ${i + 1}: ${m.subject}`,
      `From: ${m.from}`,
      m.date ? `Date: ${m.date}` : "",
      m.snippet ? `Snippet: ${m.snippet}` : "",
      m.body ? `Body:\n${m.body}` : "Body: (empty or unavailable)",
    ].filter(Boolean).join("\n")),
    "--- END LIVE GMAIL CONTEXT ---",
  ].join("\n\n");
}
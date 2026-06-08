import { useEffect, useState } from "react";
import { Loader2, ArrowLeft, Mail } from "lucide-react";
import { MiniBrowserShell } from "./MiniBrowserShell";
import { gmailApi } from "@/lib/connectors/api";
import type { ContextBlock } from "@/lib/connectors/contextBlock";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onInsert: (block: ContextBlock) => void;
}

interface MailLite {
  id: string; subject: string; from: string; snippet: string; date: string;
}

function header(headers: any[], name: string) {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decodeBody(payload: any): string {
  const decode = (data: string) => {
    try {
      return atob(data.replace(/-/g, "+").replace(/_/g, "/"));
    } catch { return ""; }
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

export function GmailMiniBrowser({ open, onClose, onInsert }: Props) {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<MailLite[]>([]);
  const [selected, setSelected] = useState<{ subject: string; from: string; body: string; id: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      setLoading(true); setSelected(null);
      try {
        const r = await gmailApi.list(5);
        const ids = r.data?.messages ?? [];
        const details = await Promise.all(ids.map((m: any) => gmailApi.get(m.id)));
        if (!alive) return;
        const mapped: MailLite[] = details.map((d: any) => {
          const h = d.data?.payload?.headers ?? [];
          return {
            id: d.data?.id ?? "",
            subject: header(h, "Subject") || "(no subject)",
            from: header(h, "From") || "Unknown",
            snippet: d.data?.snippet ?? "",
            date: header(h, "Date") || "",
          };
        });
        setList(mapped);
      } catch (e) {
        toast.error("Could not load Gmail", { description: String(e) });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [open]);

  const openMail = async (id: string) => {
    setLoading(true);
    try {
      const r = await gmailApi.get(id);
      const h = r.data?.payload?.headers ?? [];
      setSelected({
        id,
        subject: header(h, "Subject") || "(no subject)",
        from: header(h, "From"),
        body: decodeBody(r.data?.payload).slice(0, 8000),
      });
    } finally { setLoading(false); }
  };

  const insertCurrent = () => {
    if (!selected) return;
    onInsert({
      id: `gmail-${selected.id}`,
      service: "gmail",
      sourceLabel: `Gmail · ${selected.from}`,
      title: selected.subject,
      preview: selected.body.slice(0, 140),
      content: `From: ${selected.from}\nSubject: ${selected.subject}\n\n${selected.body}`,
    });
    onClose();
  };

  return (
    <MiniBrowserShell open={open} onClose={onClose} title="Gmail" emoji="✉️">
      {loading && (
        <div className="flex items-center gap-2 px-4 py-6 text-white/55 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />Loading…
        </div>
      )}
      {!loading && !selected && (
        <div className="divide-y divide-white/[0.04]">
          {list.length === 0 && (
            <div className="px-4 py-10 text-center text-white/45 text-sm">No recent emails.</div>
          )}
          {list.map((m) => (
            <button
              key={m.id}
              onClick={() => openMail(m.id)}
              className="w-full text-left px-4 py-3 hover:bg-white/[0.03] transition-colors group"
            >
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-rose-300/70 shrink-0" />
                <span className="text-[12.5px] font-medium text-white/85 truncate flex-1">{m.subject}</span>
              </div>
              <div className="mt-1 text-[11px] text-white/45 truncate">{m.from}</div>
              <div className="mt-0.5 text-[11.5px] text-white/55 line-clamp-2">{m.snippet}</div>
            </button>
          ))}
        </div>
      )}
      {!loading && selected && (
        <div className="p-4">
          <button
            onClick={() => setSelected(null)}
            className="inline-flex items-center gap-1.5 text-[11px] text-white/55 hover:text-white mb-3"
          >
            <ArrowLeft className="w-3 h-3" />Back to inbox
          </button>
          <div className="text-[13.5px] font-semibold text-white/90">{selected.subject}</div>
          <div className="mt-0.5 text-[11px] text-white/45">{selected.from}</div>
          <div className="mt-3 max-h-[32vh] overflow-y-auto rounded-lg border border-white/[0.05] bg-white/[0.02] p-3 text-[12px] text-white/75 whitespace-pre-wrap leading-relaxed">
            {selected.body || "(empty body)"}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={insertCurrent}
              className="px-3 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-200 text-[12px] font-medium transition-colors"
            >
              Bring into chat
            </button>
          </div>
        </div>
      )}
    </MiniBrowserShell>
  );
}

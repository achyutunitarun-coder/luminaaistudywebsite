import { useEffect, useState } from "react";
import { Loader2, FileText, Search, ExternalLink } from "lucide-react";
import { MiniBrowserShell } from "./MiniBrowserShell";
import { driveApi } from "@/lib/connectors/api";
import type { ContextBlock } from "@/lib/connectors/contextBlock";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onInsert: (block: ContextBlock) => void;
}

function isGoogleDoc(mime: string) {
  return mime === "application/vnd.google-apps.document";
}
function isGoogleSheet(mime: string) {
  return mime === "application/vnd.google-apps.spreadsheet";
}

export function DriveMiniBrowser({ open, onClose, onInsert }: Props) {
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [files, setFiles] = useState<any[]>([]);
  const [fetching, setFetching] = useState<string | null>(null);

  const load = async (query?: string) => {
    setLoading(true);
    try {
      const r = await driveApi.list(query);
      setFiles((r.data?.files ?? []).slice(0, 12));
    } catch (e) {
      toast.error("Could not load Drive", { description: String(e) });
    } finally { setLoading(false); }
  };

  useEffect(() => { if (open) void load(); }, [open]);

  const insertFile = async (f: any) => {
    setFetching(f.id);
    try {
      let textContent = "";
      if (isGoogleDoc(f.mimeType)) {
        const r = await driveApi.export(f.id, "text/plain");
        textContent = typeof r.data === "string" ? r.data : JSON.stringify(r.data);
      } else if (isGoogleSheet(f.mimeType)) {
        const r = await driveApi.export(f.id, "text/csv");
        textContent = typeof r.data === "string" ? r.data : JSON.stringify(r.data);
      } else if (f.mimeType?.startsWith("text/") || f.mimeType === "application/pdf") {
        const r = await driveApi.download(f.id);
        textContent = typeof r.data === "string" ? r.data : "(binary file)";
      } else {
        textContent = `(File type ${f.mimeType} — open in Drive to view)`;
      }
      const trimmed = textContent.slice(0, 12000);
      onInsert({
        id: `drive-${f.id}`,
        service: "drive",
        sourceLabel: `Drive · ${f.name}`,
        title: f.name,
        preview: trimmed.slice(0, 140),
        content: trimmed,
        url: f.webViewLink,
      });
      onClose();
    } catch (e) {
      toast.error("Could not fetch file", { description: String(e) });
    } finally { setFetching(null); }
  };

  return (
    <MiniBrowserShell open={open} onClose={onClose} title="Google Drive" emoji="📂">
      <div className="px-4 py-2.5 border-b border-white/[0.05]">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/35" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void load(q); }}
            placeholder="Search Drive…"
            className="w-full pl-8 pr-2 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-md text-[12px] text-white/85 outline-none focus:border-teal-400/40"
          />
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 px-4 py-6 text-white/55 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />Loading…
        </div>
      )}
      {!loading && (
        <div className="divide-y divide-white/[0.04]">
          {files.length === 0 && (
            <div className="px-4 py-10 text-center text-white/45 text-sm">No files found.</div>
          )}
          {files.map((f: any) => (
            <div key={f.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03] transition-colors">
              <FileText className="w-3.5 h-3.5 text-amber-300/70 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] text-white/85 truncate">{f.name}</div>
                <div className="text-[10.5px] text-white/40">{new Date(f.modifiedTime).toLocaleDateString()}</div>
              </div>
              <button
                onClick={() => void insertFile(f)}
                disabled={fetching === f.id}
                className="px-2 py-1 rounded-md text-[11px] bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/25 text-teal-200 disabled:opacity-50"
              >
                {fetching === f.id ? "…" : "Insert"}
              </button>
              {f.webViewLink && (
                <a
                  href={f.webViewLink}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1 text-white/40 hover:text-white"
                  aria-label="Open in Drive"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </MiniBrowserShell>
  );
}

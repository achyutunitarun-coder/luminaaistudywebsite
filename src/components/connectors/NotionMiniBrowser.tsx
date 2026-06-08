import { useEffect, useState } from "react";
import { Loader2, FileText } from "lucide-react";
import { MiniBrowserShell } from "./MiniBrowserShell";
import { notionApi } from "@/lib/connectors/api";
import type { ContextBlock } from "@/lib/connectors/contextBlock";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onInsert: (block: ContextBlock) => void;
}

function richText(blocks: any[]): string {
  return blocks.map((b: any) => b?.plain_text ?? "").join("");
}

function blocksToText(blocks: any[]): string {
  const lines: string[] = [];
  for (const b of blocks) {
    const t = b.type;
    const data = b[t];
    if (!data) continue;
    if (data.rich_text) {
      const txt = richText(data.rich_text);
      if (!txt) continue;
      if (t.startsWith("heading_")) lines.push(`\n## ${txt}\n`);
      else if (t === "bulleted_list_item") lines.push(`• ${txt}`);
      else if (t === "numbered_list_item") lines.push(`1. ${txt}`);
      else if (t === "to_do") lines.push(`[${data.checked ? "x" : " "}] ${txt}`);
      else if (t === "quote") lines.push(`> ${txt}`);
      else if (t === "code") lines.push("```\n" + txt + "\n```");
      else lines.push(txt);
    }
  }
  return lines.join("\n");
}

function pageTitle(page: any): string {
  const props = page.properties ?? {};
  for (const k of Object.keys(props)) {
    const p = props[k];
    if (p?.type === "title" && Array.isArray(p.title)) return richText(p.title) || "(untitled)";
  }
  if (page.object === "database") return richText(page.title ?? []) || "(untitled database)";
  return "(untitled)";
}

export function NotionMiniBrowser({ open, onClose, onInsert }: Props) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [fetching, setFetching] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = await notionApi.search("");
        if (!alive) return;
        setResults((r.data?.results ?? []).filter((x: any) => x.object === "page").slice(0, 8));
      } catch (e) {
        toast.error("Could not load Notion", { description: String(e) });
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [open]);

  const insertPage = async (page: any) => {
    setFetching(page.id);
    try {
      const r = await notionApi.blocks(page.id);
      const text = blocksToText(r.data?.results ?? []).slice(0, 12000);
      const title = pageTitle(page);
      onInsert({
        id: `notion-${page.id}`,
        service: "notion",
        sourceLabel: `Notion · ${title}`,
        title,
        preview: text.slice(0, 140),
        content: text || "(empty page)",
        url: page.url,
      });
      onClose();
    } catch (e) {
      toast.error("Couldn't fetch page", { description: String(e) });
    } finally { setFetching(null); }
  };

  return (
    <MiniBrowserShell open={open} onClose={onClose} title="Notion" emoji="📝">
      {loading && (
        <div className="flex items-center gap-2 px-4 py-6 text-white/55 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />Loading…
        </div>
      )}
      {!loading && (
        <div className="divide-y divide-white/[0.04]">
          {results.length === 0 && (
            <div className="px-4 py-10 text-center text-white/45 text-sm">
              No pages shared with the integration yet.<br />
              <span className="text-[11px] text-white/35">Share a page in Notion to make it visible.</span>
            </div>
          )}
          {results.map((p: any) => {
            const title = pageTitle(p);
            return (
              <button
                key={p.id}
                onClick={() => void insertPage(p)}
                disabled={fetching === p.id}
                className="w-full text-left px-4 py-3 hover:bg-white/[0.03] transition-colors flex items-center gap-3"
              >
                <FileText className="w-3.5 h-3.5 text-white/55 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] text-white/85 truncate">{title}</div>
                  <div className="text-[10.5px] text-white/40">
                    Edited {new Date(p.last_edited_time).toLocaleDateString()}
                  </div>
                </div>
                {fetching === p.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-400" />}
              </button>
            );
          })}
        </div>
      )}
    </MiniBrowserShell>
  );
}

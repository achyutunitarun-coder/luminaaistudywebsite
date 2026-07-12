// Full-site stitched preview with click-to-select regenerate for Lumina Computer.
import { useEffect, useMemo, useRef, useState } from "react";
import { MousePointerClick, RefreshCw, LayoutGrid, Monitor, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LcBlock } from "./api";

type Props = {
  blocks: LcBlock[];
  streamingText: Record<string, string>;
  onRegen: (block: LcBlock, refinement?: string) => Promise<void> | void;
};

function buildStitchedDoc(sections: LcBlock[]) {
  const css = sections.map((b) => b.content_json?.css ?? "").filter(Boolean).join("\n");
  const js = sections.map((b) => b.content_json?.js ?? "").filter(Boolean).join("\n");
  const body = sections.map((b, i) => {
    const html = b.content_json?.html ?? "";
    // Wrap so we can attribute clicks — data-lc-index links back to block index.
    return `<div data-lc-index="${i}" data-lc-title="${(b.title ?? "").replace(/"/g, "&quot;")}" class="lc-section">${html}</div>`;
  }).join("\n");

  const overlay = `
    :root { color-scheme: light; }
    body { margin: 0; }
    .lc-section { position: relative; outline: 0 solid transparent; transition: outline-color .15s ease, outline-width .15s ease; }
    .lc-section:hover { outline: 2px solid #2dd4bf88; outline-offset: -2px; cursor: crosshair; }
    .lc-section.lc-active { outline: 2px solid #6366f1 !important; outline-offset: -2px; }
    .lc-tag { position: absolute; top: 8px; left: 8px; z-index: 2147483000;
      background: #0f172ae6; color: #f8fafc; font: 11px/1.2 ui-sans-serif,system-ui,Inter,sans-serif;
      padding: 4px 8px; border-radius: 999px; border: 1px solid #2dd4bf55; pointer-events: none;
      opacity: 0; transition: opacity .1s ease; }
    .lc-section:hover .lc-tag, .lc-section.lc-active .lc-tag { opacity: 1; }
  `;

  const clickScript = `
    (function(){
      var sections = document.querySelectorAll('.lc-section');
      sections.forEach(function(s){
        var tag = document.createElement('div');
        tag.className = 'lc-tag';
        tag.textContent = 'Click to refine: ' + (s.getAttribute('data-lc-title') || 'section');
        s.appendChild(tag);
        s.addEventListener('click', function(e){
          e.preventDefault(); e.stopPropagation();
          document.querySelectorAll('.lc-section.lc-active').forEach(function(x){ x.classList.remove('lc-active'); });
          s.classList.add('lc-active');
          parent.postMessage({ type: 'lc-select', index: Number(s.getAttribute('data-lc-index')) }, '*');
        }, true);
        // Neutralize anchor navigation inside the preview
        s.querySelectorAll('a').forEach(function(a){ a.addEventListener('click', function(e){ e.preventDefault(); }); });
      });
    })();
  `;

  const fontLink = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">`;
  const baseCss = `*,*::before,*::after{box-sizing:border-box}html,body{margin:0}body{background:#0a0a0d;color:#f5f5f4;font-family:'Inter',ui-sans-serif,system-ui;-webkit-font-smoothing:antialiased;font-feature-settings:"ss01","cv11"}h1,h2,h3,h4{font-family:'Fraunces',ui-serif,Georgia,serif;font-weight:500;letter-spacing:-0.02em;margin:0;color:#f5f5f4}p{color:#a1a1aa;line-height:1.65;margin:0}a{color:inherit}img{max-width:100%;display:block}`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${fontLink}<script src="https://cdn.tailwindcss.com"></script><style>${baseCss}\n${css}\n${overlay}</style></head><body>${body}<script>${js}\n${clickScript}</script></body></html>`;
}

export function WebsitePreview({ blocks, streamingText, onRegen }: Props) {
  const [view, setView] = useState<"full" | "sections">("full");
  const [selected, setSelected] = useState<number | null>(null);
  const [refinement, setRefinement] = useState("");
  const [regenBusy, setRegenBusy] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const sections = useMemo(() => blocks.filter((b) => b.block_type === "site_section"), [blocks]);
  const readySections = useMemo(() => sections.filter((b) => b.content_json), [sections]);
  const doc = useMemo(() => buildStitchedDoc(readySections), [readySections]);

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      const d = e.data;
      if (!d || d.type !== "lc-select" || typeof d.index !== "number") return;
      // Map the ready-only index back to blocks[]
      const target = readySections[d.index];
      if (!target) return;
      const globalIdx = sections.findIndex((s) => s.id === target.id);
      setSelected(globalIdx);
      setRefinement("");
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [readySections, sections]);

  const selectedBlock = selected != null ? sections[selected] : null;

  async function handleRegen() {
    if (!selectedBlock) return;
    setRegenBusy(true);
    try {
      await onRegen(selectedBlock, refinement.trim() || undefined);
      setRefinement("");
    } finally {
      setRegenBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-full border border-white/10 p-0.5 bg-white/[0.02]">
          <button
            onClick={() => setView("full")}
            className={`px-3 py-1.5 rounded-full text-xs flex items-center gap-1.5 transition ${view === "full" ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"}`}>
            <Monitor className="h-3.5 w-3.5" /> Full site
          </button>
          <button
            onClick={() => setView("sections")}
            className={`px-3 py-1.5 rounded-full text-xs flex items-center gap-1.5 transition ${view === "sections" ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"}`}>
            <LayoutGrid className="h-3.5 w-3.5" /> Sections
          </button>
        </div>
        {view === "full" && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <MousePointerClick className="h-3.5 w-3.5" />
            Click any section to refine & regenerate
          </div>
        )}
      </div>

      {view === "full" ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3">
          <div className="rounded-xl border border-white/10 bg-white overflow-hidden">
            {readySections.length ? (
              <iframe
                ref={iframeRef}
                title="Full site preview"
                srcDoc={doc}
                sandbox="allow-scripts allow-same-origin"
                className="w-full min-h-[70vh] bg-white"
              />
            ) : (
              <div className="min-h-[40vh] flex items-center justify-center text-sm text-muted-foreground">
                Sections will appear here as they stream in…
              </div>
            )}
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-4 h-fit sticky top-4">
            {!selectedBlock ? (
              <div className="text-xs text-muted-foreground">
                <div className="text-[10px] uppercase tracking-wider mb-2">Refine a section</div>
                Click any section in the preview to select it. You can then rewrite it with a natural-language instruction.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-teal-300/80">selected section</div>
                    <div className="text-sm font-medium truncate">{selectedBlock.title}</div>
                    {selectedBlock.model_used && (
                      <div className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">
                        {selectedBlock.model_used}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-white shrink-0">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <textarea
                  value={refinement}
                  onChange={(e) => setRefinement(e.target.value)}
                  rows={4}
                  placeholder={`Refinement (optional)\ne.g. "Make the CTA bolder, add a testimonial row"`}
                  className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-xs outline-none focus:border-teal-400/40 resize-none"
                />
                <Button onClick={handleRegen} disabled={regenBusy}
                  className="w-full bg-gradient-to-r from-teal-500 to-indigo-500 hover:opacity-90">
                  {regenBusy ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Regenerating…</> : <><RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Regenerate section</>}
                </Button>
                <div className="text-[10px] text-muted-foreground">
                  Leave the field blank for a fresh variation with the same intent.
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {sections.map((b) => (
            <SectionCard key={b.id} block={b} streaming={streamingText[b.id]} onRegen={(r) => onRegen(b, r)} />
          ))}
          {sections.length === 0 && <div className="text-sm text-muted-foreground">No sections yet.</div>}
        </div>
      )}
    </div>
  );
}

function SectionCard({ block, streaming, onRegen }: { block: LcBlock; streaming?: string; onRegen: (r?: string) => Promise<void> | void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const html = block.content_json?.html ?? "";
  const css = block.content_json?.css ?? "";
  const fontLink = `<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">`;
  const baseCss = `*,*::before,*::after{box-sizing:border-box}html,body{margin:0}body{background:#0a0a0d;color:#f5f5f4;font-family:'Inter',ui-sans-serif,system-ui;-webkit-font-smoothing:antialiased}h1,h2,h3,h4{font-family:'Fraunces',ui-serif,Georgia,serif;font-weight:500;letter-spacing:-0.02em;color:#f5f5f4;margin:0}p{color:#a1a1aa;line-height:1.65;margin:0}`;
  const src = `<!doctype html><html><head><meta charset="utf-8">${fontLink}<script src="https://cdn.tailwindcss.com"></script><style>${baseCss}${css}</style></head><body>${html}</body></html>`;

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">section</div>
          <div className="text-sm truncate">{block.title}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {block.model_used && <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground font-mono">{block.model_used.split("/")[1]?.split(":")[0] ?? block.model_used}</span>}
          <button onClick={() => setOpen((v) => !v)} className="text-xs text-muted-foreground hover:text-white">
            {open ? "Cancel" : "Refine…"}
          </button>
        </div>
      </div>
      {block.status === "generating" && streaming ? (
        <pre className="whitespace-pre-wrap text-xs text-muted-foreground/90 font-mono leading-relaxed">{streaming}</pre>
      ) : block.content_json ? (
        <iframe srcDoc={src} sandbox="allow-scripts" className="w-full h-72 rounded-lg bg-white" title={block.title ?? ""} />
      ) : (
        <div className="text-xs text-muted-foreground">Queued.</div>
      )}
      {open && (
        <div className="mt-2 space-y-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
            placeholder="Refinement instruction (optional)"
            className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-xs outline-none focus:border-teal-400/40 resize-none" />
          <Button size="sm" disabled={busy}
            onClick={async () => { setBusy(true); try { await onRegen(text.trim() || undefined); setOpen(false); setText(""); } finally { setBusy(false); } }}
            className="bg-gradient-to-r from-teal-500 to-indigo-500 hover:opacity-90">
            {busy ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Regenerating…</> : <><RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Regenerate</>}
          </Button>
        </div>
      )}
    </div>
  );
}

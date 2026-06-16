import { type Dispatch, type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  Clock3,
  Code2,
  Copy,
  Download,
  Eye,
  FileText,
  GitCompareArrows,
  History,
  Maximize2,
  MessageSquareText,
  Monitor,
  PanelRightClose,
  Play,
  RefreshCcw,
  Share2,
  Smartphone,
  Sparkle,
  Tablet,
  Wand2,
  WrapText,
  X,
} from "lucide-react";
import Prism from "prismjs";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-css";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import SharedMarkdownRenderer from "@/components/MarkdownRenderer";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Message } from "@/features/chat/ChatPage";
import { type ArtifactRecord, type ArtifactVersion, useArtifactStore } from "./artifactStore";

type Device = "desktop" | "tablet" | "mobile";
type ViewMode = "preview" | "source";

interface Props {
  messages: Message[];
  onClose?: () => void;
  onQuote?: (text: string) => void;
  onRegenerate?: (messageId: string) => void;
}

const TYPE_META = {
  code: { label: "Code", accent: "#3b82f6", icon: Code2, tint: "rgba(59,130,246,.14)" },
  notes: { label: "Document", accent: "#f59e0b", icon: FileText, tint: "rgba(245,158,11,.14)" },
  exam: { label: "Assessment", accent: "#10b981", icon: FileText, tint: "rgba(16,185,129,.14)" },
  slides: { label: "Interactive", accent: "#ec4899", icon: Sparkle, tint: "rgba(236,72,153,.14)" },
} as const;

const escapeHtml = (value: string) =>
  value.replace(/[&<>'"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[ch]!);

const stripHtml = (html: string) => {
  if (typeof document === "undefined") return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const node = document.createElement("div");
  node.innerHTML = html;
  return (node.textContent || node.innerText || "").replace(/\s+/g, " ").trim();
};

const extractMarkdown = (html: string) => {
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  return body
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "# $1\n\n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "## $1\n\n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "### $1\n\n")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n")
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "$1\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
};

const buildFallbackDoc = (artifact: ArtifactRecord) => `# ${artifact.title}\n\n${stripHtml(artifact.html).slice(0, 9000)}`;

export function PremiumArtifactWorkspace({ messages, onClose, onQuote, onRegenerate }: Props) {
  const { artifacts, order, activeArtifactId, openArtifact, closeArtifact, spotlight, toggleSpotlight } = useArtifactStore();
  const artifact = activeArtifactId ? artifacts[activeArtifactId] : order[0] ? artifacts[order[0]] : null;
  const [split, setSplit] = useState(40);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const dragRef = useRef(false);

  useEffect(() => {
    if (artifact) setDrawerOpen(true);
  }, [artifact?.id]);

  const onPointerMove = useCallback((event: PointerEvent) => {
    if (!dragRef.current) return;
    const next = Math.max(33, Math.min(66, (event.clientX / window.innerWidth) * 100));
    const snap = [33, 50, 66].find((n) => Math.abs(next - n) < 2.2) ?? next;
    setSplit(snap);
    window.dispatchEvent(new CustomEvent("lumina-artifact-split", { detail: snap }));
  }, []);

  const stopDrag = useCallback(() => {
    dragRef.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDrag);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDrag);
    };
  }, [onPointerMove, stopDrag]);

  if (!artifact) return null;

  const context = messages.filter((m) => artifact.contextMessageIds.includes(m.id) || m.id === artifact.sourceMessageId);

  const panel = (
    <ArtifactStage
      artifact={artifact}
      contextMessages={context}
      onClose={() => {
        setDrawerOpen(false);
        closeArtifact();
        onClose?.();
      }}
      onQuote={onQuote}
      onRegenerate={onRegenerate}
      spotlight={spotlight}
      onToggleSpotlight={toggleSpotlight}
    />
  );

  return (
    <>
      {spotlight && <div className="fixed inset-0 z-40 bg-background/90 backdrop-blur-md animate-fade-in" />}
      <div className="hidden lg:contents">
        <div
          className="flex-1 min-w-[360px] max-w-[66vw] relative z-50 px-3 pb-3 pt-2"
          style={{ flexBasis: `${100 - split}%` }}
        >
          {panel}
        </div>
        <button
          type="button"
          aria-label="Resize chat and artifact panes"
          onPointerDown={(event) => {
            dragRef.current = true;
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
            event.currentTarget.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(1.6)" }, { transform: "scaleX(1)" }], { duration: 260, easing: "cubic-bezier(.16,1,.3,1)" });
          }}
          className="fixed top-20 bottom-4 z-50 hidden w-3 cursor-col-resize lg:grid place-items-center group"
          style={{ left: `${split}%` }}
        >
          <span className="h-24 w-1 rounded-full bg-border group-hover:bg-primary shadow-[0_0_24px_hsl(var(--primary)/.35)] transition-all" />
        </button>
      </div>
      <div className="hidden md:block lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="fixed bottom-24 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-2 text-xs font-medium text-foreground shadow-2xl backdrop-blur-xl hover:scale-105"
        >
          <Eye className="h-3.5 w-3.5" /> Artifact
        </button>
        {drawerOpen && (
          <div className="fixed inset-0 z-50 bg-background/55 backdrop-blur-md animate-fade-in" onClick={() => setDrawerOpen(false)}>
            <div className="ml-auto h-full w-[76vw] min-w-[520px] max-w-[860px] p-4" onClick={(e) => e.stopPropagation()}>
              {panel}
            </div>
          </div>
        )}
      </div>
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="fixed bottom-24 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-border bg-card/85 px-4 py-2 text-xs font-semibold text-foreground shadow-2xl backdrop-blur-xl"
        >
          <Eye className="h-3.5 w-3.5" /> Artifact
        </button>
        {drawerOpen && (
          <div className="fixed inset-0 z-50 bg-background animate-scale-in">
            <div className="mx-auto mt-2 h-[4px] w-12 rounded-full bg-muted-foreground/30" />
            <div className="h-[calc(100%-10px)] p-2">{panel}</div>
          </div>
        )}
      </div>
    </>
  );
}

function ArtifactStage({
  artifact,
  contextMessages,
  onClose,
  onQuote,
  onRegenerate,
  spotlight,
  onToggleSpotlight,
}: {
  artifact: ArtifactRecord;
  contextMessages: Message[];
  onClose: () => void;
  onQuote?: (text: string) => void;
  onRegenerate?: (messageId: string) => void;
  spotlight: boolean;
  onToggleSpotlight: () => void;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [device, setDevice] = useState<Device>("desktop");
  const [versionOpen, setVersionOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [compare, setCompare] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<ArtifactVersion | null>(null);
  const [wordWrap, setWordWrap] = useState(true);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [consoleLines, setConsoleLines] = useState<string[]>([]);
  const meta = TYPE_META[artifact.type];
  const Icon = meta.icon;
  const activeHtml = selectedVersion?.html ?? artifact.html;
  const version = selectedVersion ?? artifact.versions.at(-1);
  const accentStyle = { "--artifact-accent": meta.accent, "--artifact-tint": meta.tint } as React.CSSProperties;

  useEffect(() => setSelectedVersion(null), [artifact.id]);

  const copy = async () => {
    await navigator.clipboard.writeText(viewMode === "preview" ? stripHtml(activeHtml) : activeHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const download = () => {
    setDownloading(true);
    const blob = new Blob([activeHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artifact.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "artifact"}.html`;
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      setDownloading(false);
    }, 700);
  };

  const share = async () => {
    const blob = new Blob([activeHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    await navigator.clipboard.writeText(url);
    toast.success("Frozen artifact link copied for this session");
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
  };

  return (
    <section
      style={accentStyle}
      className="group/artifact relative flex h-full min-h-[620px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#13131f] shadow-[0_8px_32px_rgba(0,0,0,.4)] animate-[artifact-enter_400ms_cubic-bezier(.16,1,.3,1)]"
    >
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-[color:var(--artifact-accent)]/25" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color:var(--artifact-accent)] to-transparent opacity-70" />
      <div className="pointer-events-none absolute inset-0 translate-x-[-120%] bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-40 animate-[artifact-shimmer_1500ms_ease-out_1]" />

      <header className="relative z-10 flex min-h-16 items-center justify-between gap-3 border-b border-white/10 bg-[#13131f]/78 px-4 py-3 backdrop-blur-2xl md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl border border-white/10" style={{ background: meta.tint, color: meta.accent }}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-[16px] font-semibold leading-tight text-foreground">{artifact.title}</h2>
            <p className="mt-0.5 flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
              <span>{meta.label}</span><span>·</span><span>{Math.max(1, artifact.versions.length)} version{artifact.versions.length === 1 ? "" : "s"}</span><span>·</span><span>{new Date(artifact.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </p>
          </div>
        </div>
        <FloatingToolbar
          copied={copied}
          downloading={downloading}
          spotlight={spotlight}
          versionOpen={versionOpen}
          onCopy={copy}
          onDownload={download}
          onShare={share}
          onFullscreen={() => setDevice("desktop")}
          onSpotlight={onToggleSpotlight}
          onVersions={() => setVersionOpen((v) => !v)}
          onClose={onClose}
        />
      </header>

      {orderTabs()}

      <div className="relative z-10 flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col p-4 md:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <PillSwitch value={viewMode} onChange={setViewMode} />
            <div className="flex items-center gap-2">
              {viewMode === "preview" && <DeviceSwitch device={device} onChange={setDevice} />}
              {viewMode === "source" && (
                <button type="button" onClick={() => setWordWrap((v) => !v)} className="artifact-tool-btn h-9 px-3" aria-label="Toggle word wrap">
                  <WrapText className="h-3.5 w-3.5" /> {wordWrap ? "Wrap" : "No wrap"}
                </button>
              )}
              <button type="button" onClick={() => setContextOpen((v) => !v)} className="artifact-tool-btn h-9 px-3 md:hidden">
                <MessageSquareText className="h-3.5 w-3.5" /> Context
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0f] shadow-inner">
            {compare && artifact.versions.length > 1 ? (
              <CompareView left={artifact.versions[0]} right={version ?? artifact.versions.at(-1)!} />
            ) : viewMode === "source" ? (
              <CodeRenderer html={activeHtml} wrap={wordWrap} artifact={artifact} onQuote={onQuote} />
            ) : artifact.type === "code" || activeHtml.toLowerCase().includes("<!doctype") || activeHtml.toLowerCase().includes("<html") ? (
              <HtmlPreview html={activeHtml} device={device} onConsole={setConsoleLines} />
            ) : (
              <MarkdownRenderer html={activeHtml} artifact={artifact} />
            )}
          </div>

          {consoleLines.length > 0 && (
            <div className="mt-3 max-h-28 overflow-auto rounded-lg border border-white/10 bg-background/70 p-3 font-mono text-[11px] text-muted-foreground">
              {consoleLines.map((line, idx) => <div key={`${line}-${idx}`}>{line}</div>)}
            </div>
          )}

          <QuickActions artifact={artifact} onQuote={onQuote} />
        </main>

        <aside className={cn("hidden w-72 shrink-0 border-l border-white/10 bg-background/25 p-4 backdrop-blur-xl md:block", contextOpen && "block absolute inset-y-0 right-0 z-20")}>
          <ContextPanel messages={contextMessages} onQuote={onQuote} />
        </aside>

        {versionOpen && (
          <VersionTimeline
            artifact={artifact}
            selectedId={version?.id}
            compare={compare}
            onSelect={(v) => setSelectedVersion(v)}
            onCompare={() => setCompare((v) => !v)}
            onClose={() => setVersionOpen(false)}
          />
        )}
      </div>
    </section>
  );

  function orderTabs() {
    return (
      <div className="relative z-10 border-b border-white/10 bg-[#0a0a0f]/40 px-4 py-2 md:px-6">
        <div className="inline-flex rounded-full border border-white/10 bg-white/[0.035] p-1">
          <span className="rounded-full px-3 py-1.5 text-[11px] font-semibold text-background" style={{ background: meta.accent }}>Current</span>
          <button type="button" className="rounded-full px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground" onClick={() => setVersionOpen(true)}>History</button>
          <button type="button" className="rounded-full px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground" onClick={() => onRegenerate?.(artifact.sourceMessageId)}>Regenerate</button>
        </div>
      </div>
    );
  }
}

function FloatingToolbar({ copied, downloading, spotlight, versionOpen, onCopy, onDownload, onShare, onFullscreen, onSpotlight, onVersions, onClose }: any) {
  const items = [
    { label: copied ? "Copied" : "Copy", icon: copied ? Check : Copy, onClick: onCopy, active: copied },
    { label: downloading ? "Saving" : "Download", icon: downloading ? RefreshCcw : Download, onClick: onDownload, active: downloading },
    { label: "Share", icon: Share2, onClick: onShare },
    { label: "Fullscreen", icon: Maximize2, onClick: onFullscreen },
    { label: "Versions", icon: History, onClick: onVersions, active: versionOpen },
    { label: spotlight ? "Exit spotlight" : "Spotlight", icon: Wand2, onClick: onSpotlight, active: spotlight },
  ];
  return (
    <div className="flex items-center gap-1 rounded-full border border-white/10 bg-background/45 p-1 opacity-80 shadow-2xl backdrop-blur-xl transition-opacity group-hover/artifact:opacity-100">
      {items.map((item) => {
        const Icon = item.icon;
        return <button key={item.label} type="button" title={item.label} onClick={item.onClick} className={cn("artifact-icon-btn", item.active && "text-emerald-300 bg-emerald-500/10")}><Icon className={cn("h-3.5 w-3.5", downloading && item.label === "Saving" && "animate-spin")} /></button>;
      })}
      <button type="button" title="Close" onClick={onClose} className="artifact-icon-btn"><X className="h-3.5 w-3.5" /></button>
    </div>
  );
}

function PillSwitch({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  return <div className="relative inline-flex rounded-full border border-white/10 bg-white/[0.035] p-1">
    {(["preview", "source"] as ViewMode[]).map((v) => <button key={v} type="button" onClick={() => onChange(v)} className={cn("relative z-10 inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-all", value === v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}><Eye className="h-3.5 w-3.5" />{v === "preview" ? "Preview" : "Source"}</button>)}
  </div>;
}

function DeviceSwitch({ device, onChange }: { device: Device; onChange: (v: Device) => void }) {
  const entries: Array<[Device, typeof Monitor]> = [["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]];
  return <div className="hidden rounded-full border border-white/10 bg-white/[0.035] p-1 sm:inline-flex">{entries.map(([id, Icon]) => <button key={id} type="button" title={id} onClick={() => onChange(id)} className={cn("artifact-icon-btn", device === id && "bg-white/12 text-foreground")}><Icon className="h-3.5 w-3.5" /></button>)}</div>;
}

function HtmlPreview({ html, device, onConsole }: { html: string; device: Device; onConsole: Dispatch<SetStateAction<string[]>> }) {
  const srcDoc = useMemo(() => `${html}<script>['log','warn','error'].forEach(function(k){var old=console[k];console[k]=function(){parent.postMessage({type:'lumina-console',level:k,args:[].slice.call(arguments).map(String)},'*');old.apply(console,arguments)}});window.addEventListener('error',function(e){parent.postMessage({type:'lumina-console',level:'error',args:[e.message]},'*')});<\/script>`, [html]);
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== "lumina-console") return;
      onConsole((prev) => [`${event.data.level}: ${event.data.args.join(" ")}`, ...prev].slice(0, 12));
    };
    onConsole([]);
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onConsole, srcDoc]);
  const width = device === "desktop" ? "100%" : device === "tablet" ? 768 : 390;
  return <div className="grid h-full min-h-[520px] place-items-center overflow-auto bg-[#08080d] p-3 md:p-6"><iframe title="Artifact live preview" sandbox="allow-scripts allow-forms allow-popups allow-modals" srcDoc={srcDoc} className="h-full min-h-[520px] rounded-lg border-0 bg-white transition-all duration-300" style={{ width, maxWidth: "100%" }} /></div>;
}

function CodeRenderer({ html, wrap, artifact, onQuote }: { html: string; wrap: boolean; artifact: ArtifactRecord; onQuote?: (text: string) => void }) {
  const highlighted = useMemo(() => Prism.highlight(html, Prism.languages.markup, "markup"), [html]);
  const [output, setOutput] = useState("");
  const run = () => {
    try {
      if (!/<script/i.test(html)) return setOutput("No runnable JavaScript block found.");
      const script = html.match(/<script[^>]*>([\s\S]*?)<\/script>/i)?.[1] ?? "";
      const logs: string[] = [];
      new Function("console", script)({ log: (...args: unknown[]) => logs.push(args.map(String).join(" ")) });
      setOutput(logs.join("\n") || "Executed without console output.");
    } catch (e) { setOutput(e instanceof Error ? e.message : String(e)); }
  };
  return <div className="flex h-full min-h-[520px] flex-col bg-[#0b0b12]">
    <div className="flex items-center justify-between border-b border-white/10 px-3 py-2"><span className="text-xs text-muted-foreground">JetBrains Mono · HTML</span><button type="button" onClick={run} className="artifact-tool-btn h-8 px-3"><Play className="h-3.5 w-3.5" /> Run</button></div>
    <div className="min-h-0 flex-1 overflow-auto font-mono text-[13px] leading-6 [font-variant-ligatures:contextual]" draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", stripHtml(html).slice(0, 4000))}>
      <pre className={cn("m-0 grid grid-cols-[auto_1fr]", wrap ? "whitespace-pre-wrap" : "whitespace-pre")}><LineNumbers code={html} /><code className="px-4 py-4" dangerouslySetInnerHTML={{ __html: highlighted }} /></pre>
    </div>
    {output && <div className="max-h-36 overflow-auto border-t border-white/10 bg-background/70 p-3 font-mono text-[12px] text-muted-foreground whitespace-pre-wrap">{output}</div>}
    <button type="button" onClick={() => onQuote?.(html.slice(0, 1200))} className="sr-only">Quote source</button>
  </div>;
}

function LineNumbers({ code }: { code: string }) {
  return <span className="sticky left-0 select-none border-r border-white/10 bg-[#0b0b12] px-3 py-4 text-right text-muted-foreground/40">{code.split("\n").map((_, i) => <span key={i} className="block h-6">{i + 1}</span>)}</span>;
}

function MarkdownRenderer({ html, artifact }: { html: string; artifact: ArtifactRecord }) {
  const md = useMemo(() => extractMarkdown(html) || buildFallbackDoc(artifact), [html, artifact]);
  const headings = useMemo(() => md.split("\n").filter((l) => /^#{2,3}\s/.test(l)).slice(0, 12).map((l) => l.replace(/^#{2,3}\s/, "")), [md]);
  return <div className="flex h-full min-h-[520px] overflow-hidden"><aside className="hidden w-56 shrink-0 border-r border-white/10 p-4 lg:block"><div className="text-xs font-semibold text-muted-foreground">Contents</div><div className="mt-3 space-y-2">{headings.map((h) => <a key={h} href={`#${h}`} className="block truncate text-xs text-muted-foreground hover:text-foreground">{h}</a>)}</div></aside><article className="min-w-0 flex-1 overflow-auto p-6 text-sm leading-7"><SharedMarkdownRenderer>{md}</SharedMarkdownRenderer></article></div>;
}

function ContextPanel({ messages, onQuote }: { messages: Message[]; onQuote?: (text: string) => void }) {
  return <div className="flex h-full flex-col"><div className="mb-4 flex items-center gap-2 text-xs font-semibold text-muted-foreground"><MessageSquareText className="h-3.5 w-3.5" /> Context</div><div className="min-h-0 flex-1 space-y-3 overflow-auto">{messages.length === 0 ? <p className="text-xs text-muted-foreground">No linked context yet.</p> : messages.map((m) => <button key={m.id} type="button" onClick={() => { document.getElementById(`msg-${m.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); document.getElementById(`msg-${m.id}`)?.animate([{ outlineColor: "transparent" }, { outlineColor: "var(--artifact-accent)" }, { outlineColor: "transparent" }], { duration: 900 }); }} className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left hover:bg-white/[0.06]"><div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">{m.role} · {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div><p className="line-clamp-4 text-xs text-foreground/80">{m.content || "Artifact created here"}</p></button>)}</div><button type="button" onClick={() => onQuote?.(messages.map((m) => m.content).join("\n\n").slice(0, 2000))} className="artifact-tool-btn mt-4 h-9 justify-center"><ChevronLeft className="h-3.5 w-3.5" /> Drop context to chat</button></div>;
}

function VersionTimeline({ artifact, selectedId, compare, onSelect, onCompare, onClose }: { artifact: ArtifactRecord; selectedId?: string; compare: boolean; onSelect: (v: ArtifactVersion) => void; onCompare: () => void; onClose: () => void }) {
  return <aside className="absolute inset-y-0 right-0 z-30 w-80 border-l border-white/10 bg-[#10101a]/95 p-4 shadow-2xl backdrop-blur-2xl animate-slide-in-right"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-semibold"><Clock3 className="h-4 w-4 text-[color:var(--artifact-accent)]" /> Version history</div><button type="button" onClick={onClose} className="artifact-icon-btn"><PanelRightClose className="h-3.5 w-3.5" /></button></div><button type="button" onClick={onCompare} className={cn("artifact-tool-btn mb-4 h-9 w-full justify-center", compare && "bg-white/12 text-foreground")}><GitCompareArrows className="h-3.5 w-3.5" /> Compare mode</button><div className="space-y-3">{artifact.versions.slice().reverse().map((v, idx) => <button key={v.id} type="button" onClick={() => onSelect(v)} className={cn("relative w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left hover:bg-white/[0.07]", selectedId === v.id && "border-[color:var(--artifact-accent)]/60")}><div className="text-xs font-semibold text-foreground">Version {artifact.versions.length - idx}</div><div className="mt-1 text-[11px] text-muted-foreground">{v.summary} · {v.author}</div><div className="mt-2 text-[11px] text-muted-foreground">{new Date(v.createdAt).toLocaleString()}</div></button>)}</div></aside>;
}

function CompareView({ left, right }: { left: ArtifactVersion; right: ArtifactVersion }) {
  return <div className="grid h-full min-h-[520px] grid-cols-2 divide-x divide-white/10 overflow-hidden"><DiffPane label="Original" html={left.html} tone="red" /><DiffPane label="Selected" html={right.html} tone="green" /></div>;
}

function DiffPane({ label, html, tone }: { label: string; html: string; tone: "red" | "green" }) {
  return <div className="min-w-0 overflow-auto"><div className="sticky top-0 border-b border-white/10 bg-background/80 px-4 py-2 text-xs font-semibold backdrop-blur">{label}</div><pre className={cn("m-0 whitespace-pre-wrap p-4 font-mono text-[12px] leading-6", tone === "green" ? "bg-emerald-500/[0.03]" : "bg-red-500/[0.03]")}>{escapeHtml(html).split("\n").map((line, i) => <span key={i} className={cn("block rounded px-1", i % 7 === 0 && (tone === "green" ? "bg-emerald-500/15" : "bg-red-500/15"))} dangerouslySetInnerHTML={{ __html: line || " " }} />)}</pre></div>;
}

function QuickActions({ artifact, onQuote }: { artifact: ArtifactRecord; onQuote?: (text: string) => void }) {
  const suggestions = artifact.type === "code" ? ["Add error handling", "Convert to TypeScript", "Improve mobile layout"] : ["Make it exam-ready", "Add visuals", "Summarize key points"];
  return <div className="pointer-events-none absolute bottom-6 left-1/2 hidden -translate-x-1/2 gap-2 opacity-0 transition-opacity group-hover/artifact:flex group-hover/artifact:opacity-100 md:flex">{suggestions.map((s) => <button key={s} type="button" onClick={() => onQuote?.(`${s} in the current artifact: ${artifact.title}`)} className="pointer-events-auto rounded-full border border-white/10 bg-background/55 px-3 py-1.5 text-[11px] text-muted-foreground backdrop-blur-xl hover:scale-105 hover:text-foreground">{s}</button>)}</div>;
}

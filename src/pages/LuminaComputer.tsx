/**
 * Lumina Computer — agentic Substrate workspace.
 *
 * Layout (CSS grid):
 *   ┌──────────── Topbar ────────────┐
 *   │ Sidebar │ Editor (tabs) │ Prev │
 *   │ files   │ + log + input │ iframe
 *   └──────────────────────────────────┘
 *
 * Streams from /chat (mode: "computer"). Parses <lumina:*> tags live and:
 *   - shows files appearing & growing in the editor
 *   - renders any HTML file in the right-side iframe in real time
 *   - logs every event in the Neural Link Protocol feed
 *   - prompts the user to navigate when the model emits <lumina:navigate />
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Send,
  Sparkles,
  Cpu,
  StopCircle,
  Plus,
  FileCode2,
  FileText,
  Eye,
  Code2,
  Maximize2,
  Minimize2,
  Download,
  Copy as CopyIcon,
  Check,
  Activity,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import { LuminaParser, type LuminaFile } from "@/features/computer/parser";
import { toast } from "sonner";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

interface LogLine {
  id: string;
  level: "SYST" | "MODEL" | "FILE" | "NAV" | "DONE" | "WARN";
  text: string;
  ts: number;
}

const SUGGESTIONS = [
  "Build an interactive HTML visualiser for Newton's three laws with sliders.",
  "Deep research report: India's renewable energy transition 2020-2030. Include sources.",
  "MUN background guide — UNSC, Topic: AI in warfare. Include bloc analysis & QARMA.",
  "Make a beautiful calculus derivative practice page with 10 MCQs and live feedback.",
  "Take me to flashcards.",
  "Create a complete dark-mode pomodoro timer with stats, ambient sound toggle, and a circular SVG progress ring.",
];

function timeFmt(ts: number) {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Build a runnable HTML doc from a file (supports html / md). */
function buildPreviewDoc(file: LuminaFile, allFiles: LuminaFile[]): string {
  if (file.lang === "html") {
    let html = file.content;
    if (!/<!doctype html/i.test(html) && !/<html[\s>]/i.test(html)) {
      html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${html}</body></html>`;
    }
    // Inject sibling css/js if html doesn't already reference them
    const css = allFiles.find((f) => f.lang === "css");
    const js = allFiles.find((f) => f.lang === "js");
    if (css && !html.includes(css.path)) {
      html = html.replace(/<\/head>/i, `<style>\n${css.content}\n</style></head>`);
    }
    if (js && !html.includes(js.path)) {
      html = html.replace(/<\/body>/i, `<script>\n${js.content}\n<\/script></body>`);
    }
    return html;
  }
  if (file.lang === "md") {
    // Lightweight markdown preview (minimal styling). Real markdown rendering
    // happens in the editor's "Manifest View" tab; iframe gets a basic dump.
    const escaped = file.content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<!doctype html><html><head><meta charset="utf-8"><style>
      body{margin:0;padding:32px;font:15px/1.7 -apple-system,Inter,sans-serif;background:#0a0a14;color:#e8e6ff;max-width:820px;margin:auto}
      pre{white-space:pre-wrap;word-wrap:break-word;font-family:inherit}
    </style></head><body><pre>${escaped}</pre></body></html>`;
  }
  // Generic preview: show as code
  const safe = file.content.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;padding:24px;font:13px/1.6 ui-monospace,Menlo,monospace;background:#05050b;color:#a78bfa;white-space:pre}
  </style></head><body>${safe}</body></html>`;
}

// ─────────────────────────────────────────────────────────────────────
// Editor — virtualised pre with line numbers, typing caret while streaming
// ─────────────────────────────────────────────────────────────────────
function CodeEditor({ file }: { file: LuminaFile | null }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // auto-scroll to bottom while streaming
  useEffect(() => {
    if (!file || file.done) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [file?.content, file?.done]);

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center text-cyan-300/40 text-xs font-mono tracking-widest">
        AWAITING_NEURAL_LINK
      </div>
    );
  }

  const lines = file.content.split("\n");
  // Soft cap render to 4000 lines (rare) — keep streaming smooth
  const cap = 4000;
  const renderLines = lines.length > cap ? lines.slice(-cap) : lines;
  const lineOffset = lines.length > cap ? lines.length - cap : 0;

  const tint =
    file.lang === "html"
      ? "text-cyan-200"
      : file.lang === "css"
        ? "text-fuchsia-200"
        : file.lang === "js" || file.lang === "ts"
          ? "text-amber-200"
          : file.lang === "md"
            ? "text-emerald-100"
            : "text-white/85";

  return (
    <div ref={scrollRef} className="flex-1 overflow-auto bg-[#05060d]">
      <pre className={`m-0 p-0 text-[12.5px] leading-[1.55] font-mono ${tint}`}>
        {renderLines.map((line, i) => {
          const n = lineOffset + i + 1;
          return (
            <div key={n} className="flex hover:bg-white/[0.02] px-0">
              <span className="select-none text-cyan-500/30 text-right pr-3 pl-3 w-14 flex-shrink-0">
                {n}
              </span>
              <span className="whitespace-pre-wrap break-words flex-1 pr-4">
                {line || "\u00A0"}
              </span>
            </div>
          );
        })}
        {!file.done && (
          <div className="flex px-3">
            <span className="w-14" />
            <span className="inline-block w-2 h-4 bg-cyan-400 animate-pulse" />
          </div>
        )}
      </pre>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Preview panel — big iframe of the active HTML, or fallback
// ─────────────────────────────────────────────────────────────────────
function PreviewPanel({
  files,
  activeFile,
  fullscreen,
  setFullscreen,
}: {
  files: LuminaFile[];
  activeFile: LuminaFile | null;
  fullscreen: boolean;
  setFullscreen: (b: boolean) => void;
}) {
  // Prefer an HTML file even if a markdown file is currently active.
  const previewTarget = useMemo(() => {
    if (activeFile && activeFile.lang === "html") return activeFile;
    return files.find((f) => f.lang === "html") ?? activeFile;
  }, [files, activeFile]);

  const doc = useMemo(
    () => (previewTarget ? buildPreviewDoc(previewTarget, files) : ""),
    [previewTarget, files],
  );

  const download = () => {
    if (!previewTarget) return;
    const blob = new Blob([doc], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = previewTarget.path.endsWith(".html")
      ? previewTarget.path
      : `${previewTarget.path}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const wrap = fullscreen
    ? "fixed inset-0 z-[200] bg-[#05050b] flex flex-col"
    : "flex flex-col h-full";

  return (
    <div className={wrap}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-cyan-500/10 bg-[#070810]">
        <div className="text-[10px] font-mono tracking-[0.2em] text-cyan-300/70">
          REALTIME_MANIFEST
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={download}
            disabled={!previewTarget}
            className="p-1.5 rounded text-cyan-300/60 hover:text-cyan-200 hover:bg-cyan-500/10 transition disabled:opacity-30"
            title="Download"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setFullscreen(!fullscreen)}
            className="p-1.5 rounded text-cyan-300/60 hover:text-cyan-200 hover:bg-cyan-500/10 transition"
            title="Fullscreen"
          >
            {fullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
      <div className="flex-1 bg-white relative overflow-hidden">
        {previewTarget ? (
          <iframe
            key={previewTarget.path}
            title="Lumina Preview"
            srcDoc={doc}
            sandbox="allow-scripts allow-forms allow-popups allow-modals allow-pointer-lock"
            className="w-full h-full border-0"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-cyan-500/30 text-xs font-mono tracking-widest gap-2 bg-[#070810]">
            <Activity className="w-8 h-8 opacity-30" />
            MANIFEST_OFFLINE
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────
export default function LuminaComputer() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<LuminaFile[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [plan, setPlan] = useState("");
  const [finalMd, setFinalMd] = useState("");
  const [tab, setTab] = useState<"code" | "manifest">("code");
  const [logs, setLogs] = useState<LogLine[]>([
    {
      id: uid(),
      level: "SYST",
      text: "Lumina Computer · Substrate v4.2 online. Awaiting directive.",
      ts: Date.now(),
    },
  ]);
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState<string>("");
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const parserRef = useRef<LuminaParser | null>(null);
  const logScrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const activeFile = useMemo(
    () => files.find((f) => f.path === activePath) ?? files[0] ?? null,
    [files, activePath],
  );

  const log = useCallback((level: LogLine["level"], text: string) => {
    setLogs((prev) => [...prev.slice(-200), { id: uid(), level, text, ts: Date.now() }]);
  }, []);

  // auto-scroll log
  useEffect(() => {
    const el = logScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logs]);

  // auto-resize textarea
  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  };

  // navigation prompt when model asks
  const handleNavigate = useCallback(
    (to: string, reason?: string) => {
      log("NAV", `proposed → ${to}${reason ? ` (${reason})` : ""}`);
      toast(`Lumina wants to open ${to}`, {
        description: reason,
        action: { label: "Open", onClick: () => navigate(to) },
        duration: 8000,
      });
    },
    [log, navigate],
  );

  const reset = useCallback(() => {
    if (busy) abortRef.current?.abort();
    setFiles([]);
    setPlan("");
    setFinalMd("");
    setActivePath(null);
    setLogs([
      {
        id: uid(),
        level: "SYST",
        text: "Substrate reset · Awaiting new directive.",
        ts: Date.now(),
      },
    ]);
  }, [busy]);

  const stop = () => abortRef.current?.abort();

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;

      // Reset prior generation state but keep logs
      setFiles([]);
      setPlan("");
      setFinalMd("");
      setActivePath(null);
      setPrompt("");
      if (taRef.current) taRef.current.style.height = "auto";
      setBusy(true);
      log("SYST", `> ${trimmed.slice(0, 120)}${trimmed.length > 120 ? "…" : ""}`);
      log("MODEL", "routing → owl-alpha (primary)…");

      parserRef.current = new LuminaParser();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const auth = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        const res = await fetch(CHAT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth}` },
          body: JSON.stringify({
            messages: [{ role: "user", content: trimmed }],
            mode: "computer",
          }),
          signal: ctrl.signal,
        });

        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let sseBuf = "";
        const seenFiles = new Set<string>();
        let lastFileLen = new Map<string, number>();
        let sawNavigate = false;

        const applyState = () => {
          const st = parserRef.current!.state;
          setPlan(st.plan);
          setFinalMd(st.final);
          setFiles([...st.files]);
          // Auto-pick first file
          if (st.files.length > 0) {
            setActivePath((cur) => cur ?? st.files[0].path);
          }
          // Logs per new/closed file
          for (const f of st.files) {
            if (!seenFiles.has(f.path)) {
              seenFiles.add(f.path);
              log("FILE", `+ ${f.path} (${f.lang})`);
            }
            const prevLen = lastFileLen.get(f.path) ?? 0;
            if (f.done && prevLen !== -1) {
              const kb = (f.content.length / 1024).toFixed(1);
              log("FILE", `✓ ${f.path} · ${kb}KB · ${f.content.split("\n").length} lines`);
              lastFileLen.set(f.path, -1);
            } else if (!f.done) {
              lastFileLen.set(f.path, f.content.length);
            }
          }
          if (st.navigate && !sawNavigate) {
            sawNavigate = true;
            handleNavigate(st.navigate.to, st.navigate.reason);
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          sseBuf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = sseBuf.indexOf("\n")) !== -1) {
            let line = sseBuf.slice(0, nl);
            sseBuf = sseBuf.slice(nl + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (!json || json === "[DONE]") continue;
            try {
              const parsed = JSON.parse(json);
              if (parsed?.lumina_meta?.model) {
                setModel(parsed.lumina_meta.model);
                log("MODEL", `✓ ${parsed.lumina_meta.model}`);
              }
              const delta = parsed?.choices?.[0]?.delta?.content;
              if (typeof delta === "string" && delta.length > 0) {
                parserRef.current!.push(delta);
                applyState();
              }
            } catch {
              // partial line — wait for more
              sseBuf = line + "\n" + sseBuf;
              break;
            }
          }
        }

        parserRef.current!.finish();
        applyState();
        log("DONE", `complete · ${parserRef.current!.state.files.length} file(s)`);
      } catch (e: any) {
        if (e?.name === "AbortError") {
          log("WARN", "stream aborted by operator");
        } else {
          log("WARN", e?.message ?? "stream failed");
          toast.error(e?.message ?? "Request failed");
        }
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, log, handleNavigate],
  );

  const onSubmit = () => send(prompt);

  const copyActive = () => {
    if (!activeFile) return;
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isEmpty = files.length === 0 && !plan && !finalMd && !busy;

  return (
    <div className="relative h-[calc(100vh-0px)] flex flex-col bg-[#05060d] text-white/90 overflow-hidden font-sans">
      {/* ambient grid + glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,211,238,0.4) 1px,transparent 1px),linear-gradient(90deg,rgba(34,211,238,0.4) 1px,transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="pointer-events-none absolute -top-32 left-1/3 w-[700px] h-[400px] bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.12),transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 w-[500px] h-[400px] bg-[radial-gradient(ellipse_at_center,rgba(167,139,250,0.10),transparent_70%)]" />

      {/* Topbar */}
      <header className="relative z-10 flex items-center gap-4 px-5 py-2.5 border-b border-cyan-500/15 bg-[#070810]/80 backdrop-blur-xl flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center shadow-[0_0_16px_rgba(34,211,238,0.4)]">
            <Cpu className="w-3.5 h-3.5 text-[#05060d]" />
          </div>
          <div className="font-mono text-[15px] tracking-[0.25em] font-bold text-cyan-200">
            LUMINA<span className="text-violet-300">·COMPUTER</span>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-1 ml-3 text-[10px] font-mono tracking-widest text-cyan-300/40">
          <span className="px-2 py-1 rounded bg-cyan-500/5 border border-cyan-500/10">
            ORCHESTRATOR
          </span>
          <span className="px-2 py-1 rounded text-cyan-300/30">ANALYSIS</span>
          <span className="px-2 py-1 rounded text-cyan-300/30">INFRASTRUCTURE</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {busy ? (
            <button
              onClick={stop}
              className="flex items-center gap-2 px-3 py-1.5 rounded border border-rose-400/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 transition text-[11px] font-mono tracking-widest"
            >
              <StopCircle className="w-3.5 h-3.5" /> ABORT
            </button>
          ) : (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded border border-cyan-500/20 bg-cyan-500/5 text-[10px] font-mono tracking-widest text-cyan-300/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              {model ? `MODEL: ${model.split("/").pop()}` : "SUBSTRATE_READY"}
            </div>
          )}
          <button
            onClick={reset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-cyan-500/20 bg-cyan-500/5 text-cyan-200/80 hover:bg-cyan-500/10 transition text-[11px] font-mono tracking-widest"
          >
            <Plus className="w-3.5 h-3.5" /> NEW
          </button>
        </div>
      </header>

      {/* Body grid */}
      <div className="relative z-10 flex-1 grid grid-cols-[260px_1fr_440px] min-h-0">
        {/* Sidebar */}
        <aside className="border-r border-cyan-500/10 bg-[#06070e] flex flex-col min-h-0">
          <div className="p-4 border-b border-cyan-500/10">
            <div className="text-[9px] font-mono tracking-[0.25em] text-cyan-300/40 mb-1">
              WORKSPACE
            </div>
            <div className="text-[13px] font-bold text-cyan-100">Neural Interface</div>
            <div className="text-[10px] font-mono text-cyan-400/40 tracking-widest mt-0.5">
              L3-OPTIMIZATION · v4.2
            </div>
          </div>

          <div className="p-4 flex-1 overflow-auto">
            <div className="text-[9px] font-mono tracking-[0.25em] text-cyan-300/40 mb-2">
              ROOT_EXPLORER
            </div>
            {files.length === 0 ? (
              <div className="text-[11px] font-mono text-cyan-300/30 italic">
                no_files · awaiting_directive
              </div>
            ) : (
              <div className="space-y-1">
                {files.map((f) => {
                  const active = f.path === (activeFile?.path ?? "");
                  return (
                    <button
                      key={f.path}
                      onClick={() => {
                        setActivePath(f.path);
                        setTab("code");
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded border text-left transition group ${
                        active
                          ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-100"
                          : "bg-transparent border-transparent text-white/60 hover:bg-white/[0.03] hover:border-cyan-500/10"
                      }`}
                    >
                      {f.lang === "md" ? (
                        <FileText className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />
                      ) : (
                        <FileCode2 className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />
                      )}
                      <span className="text-[12px] font-mono truncate flex-1">{f.path}</span>
                      {!f.done && (
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {plan && (
              <>
                <div className="text-[9px] font-mono tracking-[0.25em] text-cyan-300/40 mt-6 mb-2">
                  ACTIVE_PLAN
                </div>
                <div className="text-[11px] text-white/70 leading-relaxed bg-white/[0.02] border border-cyan-500/10 rounded p-2.5 max-h-[180px] overflow-auto">
                  <MarkdownRenderer>{plan}</MarkdownRenderer>
                </div>
              </>
            )}
          </div>

          <div className="p-4 border-t border-cyan-500/10">
            <button
              onClick={() => taRef.current?.focus()}
              className="w-full py-3 rounded border border-cyan-400/40 bg-gradient-to-b from-cyan-500/10 to-violet-500/5 text-cyan-200 text-[11px] font-mono tracking-[0.25em] hover:from-cyan-500/20 hover:to-violet-500/10 transition shadow-[0_0_20px_-10px_rgba(34,211,238,0.6)]"
            >
              INITIALIZE_NODE
            </button>
          </div>
        </aside>

        {/* Center: tabs + editor + log + input */}
        <main className="flex flex-col min-h-0 min-w-0">
          {/* tabs */}
          <div className="flex items-center gap-1 px-4 pt-3 border-b border-cyan-500/10 bg-[#06070e]">
            <button
              onClick={() => setTab("code")}
              className={`flex items-center gap-2 px-3 py-2 text-[11px] font-mono tracking-[0.2em] border-b-2 -mb-px transition ${
                tab === "code"
                  ? "border-cyan-400 text-cyan-200"
                  : "border-transparent text-cyan-300/40 hover:text-cyan-200"
              }`}
            >
              <Code2 className="w-3.5 h-3.5" /> SOURCE_CODE
            </button>
            <button
              onClick={() => setTab("manifest")}
              className={`flex items-center gap-2 px-3 py-2 text-[11px] font-mono tracking-[0.2em] border-b-2 -mb-px transition ${
                tab === "manifest"
                  ? "border-cyan-400 text-cyan-200"
                  : "border-transparent text-cyan-300/40 hover:text-cyan-200"
              }`}
            >
              <Eye className="w-3.5 h-3.5" /> MANIFEST_VIEW
            </button>
            {activeFile && tab === "code" && (
              <div className="ml-auto flex items-center gap-2 pb-1">
                <span className="text-[10px] font-mono text-cyan-400/40 truncate max-w-[200px]">
                  {activeFile.path}
                </span>
                <button
                  onClick={copyActive}
                  className="p-1 rounded text-cyan-300/50 hover:text-cyan-200 hover:bg-cyan-500/10 transition"
                  title="Copy"
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <CopyIcon className="w-3 h-3" />
                  )}
                </button>
              </div>
            )}
          </div>

          {/* editor / manifest */}
          <div className="flex-1 flex flex-col min-h-0">
            {tab === "code" ? (
              isEmpty ? (
                <EmptyState onPick={(s) => setPrompt(s)} />
              ) : (
                <CodeEditor file={activeFile} />
              )
            ) : (
              <div className="flex-1 overflow-auto p-6 bg-[#06070e]">
                <div className="max-w-3xl mx-auto space-y-6">
                  {plan && (
                    <section>
                      <div className="text-[10px] font-mono tracking-[0.25em] text-cyan-300/50 mb-2">
                        PLAN
                      </div>
                      <div className="text-white/85 text-[14px] leading-relaxed">
                        <MarkdownRenderer>{plan}</MarkdownRenderer>
                      </div>
                    </section>
                  )}
                  {finalMd && (
                    <section>
                      <div className="text-[10px] font-mono tracking-[0.25em] text-cyan-300/50 mb-2">
                        FINAL_REPORT
                      </div>
                      <div className="text-white/85 text-[14px] leading-relaxed">
                        <MarkdownRenderer>{finalMd}</MarkdownRenderer>
                      </div>
                    </section>
                  )}
                  {!plan && !finalMd && (
                    <div className="text-cyan-300/30 text-xs font-mono tracking-widest text-center pt-20">
                      MANIFEST_EMPTY
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Log feed */}
          <div className="border-t border-cyan-500/10 bg-[#05060d] flex flex-col flex-shrink-0">
            <div className="flex items-center gap-2 px-4 py-1.5 border-b border-cyan-500/10">
              <Activity className="w-3 h-3 text-cyan-400/70" />
              <span className="text-[10px] font-mono tracking-[0.25em] text-cyan-300/60">
                NEURAL_LINK_PROTOCOL
              </span>
              {busy && (
                <Loader2 className="w-3 h-3 text-cyan-400 animate-spin ml-auto" />
              )}
            </div>
            <div
              ref={logScrollRef}
              className="h-[120px] overflow-auto px-4 py-2 font-mono text-[11px] space-y-0.5"
            >
              {logs.map((l) => (
                <div key={l.id} className="flex gap-2 items-baseline">
                  <span className="text-cyan-500/40 flex-shrink-0">[{timeFmt(l.ts)}]</span>
                  <span
                    className={`flex-shrink-0 ${
                      l.level === "WARN"
                        ? "text-rose-300"
                        : l.level === "DONE"
                          ? "text-emerald-300"
                          : l.level === "FILE"
                            ? "text-violet-300"
                            : l.level === "NAV"
                              ? "text-amber-300"
                              : l.level === "MODEL"
                                ? "text-cyan-300"
                                : "text-cyan-200/60"
                    }`}
                  >
                    [{l.level}]
                  </span>
                  <span className="text-white/75 break-all">{l.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Prompt bar */}
          <div className="border-t border-cyan-500/10 bg-[#06070e] p-3 flex-shrink-0">
            <div className="flex items-end gap-2 rounded border border-cyan-500/20 bg-[#05060d] px-3 py-2 focus-within:border-cyan-400/60 focus-within:shadow-[0_0_20px_-8px_rgba(34,211,238,0.4)] transition">
              <span className="text-[10px] font-mono text-cyan-400/60 tracking-widest pt-2 flex-shrink-0">
                COMMAND_SUBSTRATE_
              </span>
              <textarea
                ref={taRef}
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  autoResize(e.currentTarget);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSubmit();
                  }
                }}
                rows={1}
                placeholder={busy ? "synthesizing…" : "Issue a directive — Lumina will plan, build, and render live."}
                disabled={busy}
                className="flex-1 bg-transparent resize-none outline-none text-[13.5px] text-white/90 placeholder:text-cyan-300/30 py-1.5 font-sans leading-relaxed"
              />
              <button
                onClick={onSubmit}
                disabled={busy || !prompt.trim()}
                className="p-2 rounded bg-gradient-to-br from-cyan-400 to-violet-500 text-[#05060d] hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-[0_0_16px_-4px_rgba(34,211,238,0.6)]"
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </main>

        {/* Preview */}
        <aside className="border-l border-cyan-500/10 bg-[#06070e] min-h-0">
          <PreviewPanel
            files={files}
            activeFile={activeFile}
            fullscreen={fullscreen}
            setFullscreen={setFullscreen}
          />
        </aside>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Empty state — capability cards
// ─────────────────────────────────────────────────────────────────────
function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="flex-1 overflow-auto bg-[#06070e]">
      <div className="max-w-3xl mx-auto px-8 py-12">
        <div className="text-[10px] font-mono tracking-[0.3em] text-cyan-300/50 mb-3">
          / WELCOME_TO_THE_SUBSTRATE
        </div>
        <h1 className="text-[32px] font-bold leading-tight bg-gradient-to-r from-cyan-200 via-white to-violet-200 bg-clip-text text-transparent mb-3">
          Build anything. Live.
        </h1>
        <p className="text-white/60 text-[15px] leading-relaxed mb-8 max-w-2xl">
          Lumina Computer is an agentic workspace. Describe what you want — a
          study guide, a deep research report, an interactive simulator, even a
          page to navigate to — and watch it stream into the editor and render
          in the preview, in real time. Powered by OWL Alpha with free-tier
          fallback.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => onPick(s)}
              className="group text-left p-4 rounded border border-cyan-500/15 bg-gradient-to-br from-white/[0.02] to-transparent hover:from-cyan-500/[0.06] hover:border-cyan-400/40 transition"
            >
              <div className="flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-cyan-400/60 mt-0.5 flex-shrink-0 group-hover:text-cyan-300" />
                <div className="text-[13px] text-white/80 leading-snug group-hover:text-white">
                  {s}
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-cyan-400/30 mt-0.5 ml-auto flex-shrink-0 group-hover:text-cyan-300 group-hover:translate-x-0.5 transition" />
              </div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3 text-[11px] font-mono tracking-wide">
          <Capability label="MULTI-FILE" desc="HTML + CSS + JS together" />
          <Capability label="LIVE_RENDER" desc="iframe updates per token" />
          <Capability label="AGENT_NAV" desc="opens Lumina pages on cue" />
        </div>
      </div>
    </div>
  );
}

function Capability({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="rounded border border-cyan-500/10 bg-white/[0.02] px-3 py-2.5">
      <div className="text-cyan-300/80 tracking-[0.2em] text-[10px]">{label}</div>
      <div className="text-white/50 text-[11px] mt-0.5 font-sans">{desc}</div>
    </div>
  );
}

/**
 * Lumina Computer — Apple-style agentic workspace.
 *
 *   ┌──────────── Top bar ──────── [Preview ▸] ─┐
 *   │ Files │  Editor (live code streaming)    │
 *   │       │  Activity feed                    │
 *   │       │  ─────────────────────────────────┤
 *   │       │  Ask Lumina… [📎] [↑]   (bottom)  │
 *   └────────────────────────────────────────────┘
 *
 * - Streams from /chat (mode: "computer"), parses <lumina:*> tags.
 * - File uploads (images/pdf/text) attach context to the prompt.
 * - Agentic actions (run / open / navigate) appear in the activity feed
 *   with Confirm / Dismiss controls.
 * - Preview opens as a right-side slide-over (toggle from top right).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  Paperclip,
  Square,
  Plus,
  FileCode,
  FileText,
  Eye,
  Copy as CopyIcon,
  Check,
  Loader2,
  X,
  Sparkles,
  Cpu,
  Download,
  Maximize2,
  Minimize2,
  PlayCircle,
  FolderOpen,
  Compass,
  CheckCircle2,
  Image as ImageIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { FileTree, downloadFilesAsZip } from "@/features/computer/FileTree";
import { supabase } from "@/integrations/supabase/client";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import { LuminaParser, type LuminaFile, type LuminaAction } from "@/features/computer/parser";
import { extractDocumentText, DOCUMENT_ACCEPT } from "@/lib/extractDocumentText";
import { AgentPipelinePanel } from "@/components/AgentPipelinePanel";
import { type PipelineStage, type StageStatus } from "@/hooks/useLuminaPipeline";
import { buildRepairPrompt, summarizeValidation, validateLuminaProject } from "@/features/computer/validation";
import { toast } from "sonner";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

interface Attachment {
  id: string;
  name: string;
  kind: "image" | "text" | "file";
  size: number;
  preview?: string; // data url for images
  text?: string; // extracted text content
}

interface LogLine {
  id: string;
  level: "system" | "model" | "file" | "action" | "done" | "warn";
  text: string;
  ts: number;
  action?: LuminaAction;
}

const SUGGESTIONS = [
  "Build a photosynthesis learning lab with chloroplast animation and exam practice.",
  "Make a premium calculus derivatives studio with graphing and 10 MCQs.",
  "Create a climate-tech investor dashboard with unique editorial UI.",
  "Build a focus-mode pomodoro with ambient sound and task analytics.",
];

const FACTORY_STAGES: PipelineStage[] = [
  "planner",
  "router",
  "research",
  "architect",
  "builder",
  "validator",
  "debugger",
  "runner",
  "assembler",
];

const idleFactoryStates = () =>
  Object.fromEntries(FACTORY_STAGES.map((stage) => [stage, "idle"])) as Record<PipelineStage, StageStatus>;

function timeFmt(ts: number) {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Build a runnable HTML doc from a file. */
function buildPreviewDoc(file: LuminaFile, allFiles: LuminaFile[]): string {
  if (file.lang === "html") {
    let html = file.content;
    if (!/<!doctype html/i.test(html) && !/<html[\s>]/i.test(html)) {
      html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${html}</body></html>`;
    }
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
    const escaped = file.content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<!doctype html><html><head><meta charset="utf-8"><style>
      body{margin:0;padding:40px;font:15px/1.7 -apple-system,BlinkMacSystemFont,"SF Pro Display",Inter,system-ui,sans-serif;background:#fafafa;color:#1d1d1f;max-width:780px;margin:auto}
      pre{white-space:pre-wrap;word-wrap:break-word;font-family:inherit}
    </style></head><body><pre>${escaped}</pre></body></html>`;
  }
  const safe = file.content.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;padding:24px;font:13px/1.6 ui-monospace,SF Mono,Menlo,monospace;background:#0b0b0f;color:#e8e6ff;white-space:pre}
  </style></head><body>${safe}</body></html>`;
}

// ─────────────────────────────────────────────────────────────────────
// Code editor — Apple-clean, line-numbered, streams smoothly
// ─────────────────────────────────────────────────────────────────────
function CodeEditor({ file }: { file: LuminaFile | null }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!file || file.done) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [file?.content, file?.done]);

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center text-white/30 text-sm">
        Ready when you are.
      </div>
    );
  }

  const lines = file.content.split("\n");
  const cap = 20000;
  const renderLines = lines.length > cap ? lines.slice(-cap) : lines;
  const lineOffset = lines.length > cap ? lines.length - cap : 0;

  return (
    <div ref={scrollRef} className="flex-1 overflow-auto bg-[#0e0e12]">
      <pre className="m-0 p-0 text-[12.5px] leading-[1.65] font-mono text-white/85">
        {renderLines.map((line, i) => {
          const n = lineOffset + i + 1;
          return (
            <div key={n} className="flex hover:bg-white/[0.02]">
              <span className="select-none text-white/20 text-right pr-4 pl-4 w-16 flex-shrink-0">
                {n}
              </span>
              <span className="whitespace-pre-wrap break-words flex-1 pr-6">
                {line || "\u00A0"}
              </span>
            </div>
          );
        })}
        {!file.done && (
          <div className="flex px-4">
            <span className="w-16" />
            <span className="inline-block w-1.5 h-4 bg-white/80 animate-pulse rounded-sm" />
          </div>
        )}
      </pre>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Preview slide-over (right side)
// ─────────────────────────────────────────────────────────────────────
function PreviewPanel({
  open,
  onClose,
  files,
  activeFile,
}: {
  open: boolean;
  onClose: () => void;
  files: LuminaFile[];
  activeFile: LuminaFile | null;
}) {
  const [fullscreen, setFullscreen] = useState(false);
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

  if (!open) return null;

  const wrapCls = fullscreen
    ? "fixed inset-0 z-[200] bg-[#0b0b0f] flex flex-col"
    : "fixed top-0 right-0 bottom-0 z-[100] w-[min(720px,72vw)] bg-[#0b0b0f] border-l border-white/10 flex flex-col shadow-[-30px_0_60px_-30px_rgba(0,0,0,0.7)] animate-in slide-in-from-right duration-300";

  return (
    <div className={wrapCls}>
      <div className="flex items-center gap-2 px-5 h-12 border-b border-white/10 flex-shrink-0">
        <Eye className="w-4 h-4 text-white/60" />
        <div className="text-sm font-medium text-white/90">Preview</div>
        {previewTarget && (
          <div className="text-xs text-white/40 ml-2 truncate">{previewTarget.path}</div>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={download}
            disabled={!previewTarget}
            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.06] transition disabled:opacity-30"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => setFullscreen(!fullscreen)}
            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.06] transition"
            title="Fullscreen"
          >
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.06] transition"
            title="Close"
          >
            <X className="w-4 h-4" />
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
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/30 text-sm gap-2 bg-[#0e0e12]">
            <Sparkles className="w-6 h-6 opacity-40" />
            Nothing to preview yet.
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Activity feed entry — supports agentic action confirmations
// ─────────────────────────────────────────────────────────────────────
function ActivityEntry({
  line,
  onConfirm,
  onDismiss,
}: {
  line: LogLine;
  onConfirm?: (id: string) => void;
  onDismiss?: (id: string) => void;
}) {
  const dot =
    line.level === "warn"
      ? "bg-rose-400"
      : line.level === "done"
        ? "bg-emerald-400"
        : line.level === "file"
          ? "bg-violet-400"
          : line.level === "action"
            ? "bg-amber-400"
            : line.level === "model"
              ? "bg-sky-400"
              : "bg-white/30";

  const act = line.action;
  return (
    <div className="flex gap-3 items-start py-1.5">
      <span className={`w-1.5 h-1.5 mt-2 rounded-full ${dot} flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[13px] text-white/85">{line.text}</span>
          <span className="text-[11px] text-white/30">{timeFmt(line.ts)}</span>
        </div>
        {act && act.status === "proposed" && (
          <div className="flex gap-2 mt-1.5">
            <button
              onClick={() => onConfirm?.(act.id)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white text-black text-[11px] font-medium hover:bg-white/90 transition"
            >
              <CheckCircle2 className="w-3 h-3" /> Confirm
            </button>
            <button
              onClick={() => onDismiss?.(act.id)}
              className="px-2.5 py-1 rounded-lg bg-white/[0.06] text-white/70 text-[11px] hover:bg-white/[0.1] transition"
            >
              Dismiss
            </button>
          </div>
        )}
        {act && act.status === "confirmed" && (
          <div className="text-[11px] text-emerald-300/80 mt-0.5">✓ confirmed</div>
        )}
        {act && act.status === "dismissed" && (
          <div className="text-[11px] text-white/30 mt-0.5">dismissed</div>
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
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [files, setFiles] = useState<LuminaFile[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [plan, setPlan] = useState("");
  const [finalMd, setFinalMd] = useState("");
  const [logs, setLogs] = useState<LogLine[]>([
    { id: uid(), level: "system", text: "Lumina Computer is ready.", ts: Date.now() },
  ]);
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState<string>("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canContinue, setCanContinue] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const parserRef = useRef<LuminaParser | null>(null);
  const rawAssistantRef = useRef<string>("");
  const lastUserPromptRef = useRef<string>("");
  // Rolling conversation memory — last N turns kept so Lumina remembers prior asks.
  const turnsRef = useRef<{ role: "user" | "assistant"; content: any }[]>([]);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const seenActionsRef = useRef<Set<string>>(new Set());
  // Persistent workspace session id (row in lumina_sessions). Cleared by reset()
  // so the next turn starts a fresh session row.
  const sessionIdRef = useRef<string | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  const [factoryStates, setFactoryStates] = useState<Record<PipelineStage, StageStatus>>(idleFactoryStates);
  const [factoryActive, setFactoryActive] = useState<string | null>(null);
  const [factoryEvents, setFactoryEvents] = useState<string[]>([]);
  const [validationSummary, setValidationSummary] = useState<string>("");

  const activeFile = useMemo(
    () => files.find((f) => f.path === activePath) ?? files[0] ?? null,
    [files, activePath],
  );

  const log = useCallback(
    (level: LogLine["level"], text: string, action?: LuminaAction) => {
      setLogs((prev) => [...prev.slice(-200), { id: uid(), level, text, ts: Date.now(), action }]);
    },
    [],
  );

  const setFactoryStage = useCallback((stage: PipelineStage, status: StageStatus, event?: string) => {
    setFactoryStates((prev) => ({ ...prev, [stage]: status }));
    if (status === "working") setFactoryActive(event ?? stage);
    if (event) setFactoryEvents((prev) => [...prev.slice(-40), event]);
  }, []);

  // Auto-open preview the first time an HTML file appears
  useEffect(() => {
    if (!previewOpen && files.some((f) => f.lang === "html") && busy) {
      setPreviewOpen(true);
    }
  }, [files, busy, previewOpen]);

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  // ── Agentic action handlers ────────────────────────────────────────
  const runAction = useCallback(
    (act: LuminaAction) => {
      if (act.type === "navigate") {
        log("done", `Navigated to ${act.target}`);
        navigate(act.target);
        toast.success(`Opened ${act.target}`);
      } else if (act.type === "open") {
        const f = files.find(
          (f) => f.path === act.target || f.path.endsWith(act.target),
        );
        if (f) {
          setActivePath(f.path);
          log("done", `Opened ${f.path}`);
        } else {
          log("warn", `File not found: ${act.target}`);
        }
      } else if (act.type === "run") {
        setPreviewOpen(true);
        const f = files.find(
          (f) => f.path === act.target || f.path.endsWith(act.target),
        );
        if (f) setActivePath(f.path);
        log("done", `Running ${act.target} in preview`);
        toast.success(`Running ${act.target}`);
      }
    },
    [files, log, navigate],
  );

  const confirmAction = useCallback(
    (id: string) => {
      setLogs((prev) =>
        prev.map((l) =>
          l.action?.id === id ? { ...l, action: { ...l.action, status: "confirmed" } } : l,
        ),
      );
      const target = logs.find((l) => l.action?.id === id)?.action;
      if (target) runAction(target);
    },
    [logs, runAction],
  );

  const dismissAction = useCallback((id: string) => {
    setLogs((prev) =>
      prev.map((l) =>
        l.action?.id === id ? { ...l, action: { ...l.action!, status: "dismissed" } } : l,
      ),
    );
  }, []);

  // ── Persistent workspace memory (lumina_sessions) ─────────────────
  // Load most recent session on mount so the user never loses prior
  // conversation, generated files, or plan when navigating away.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data, error } = await supabase
        .from("lumina_sessions")
        .select("id,title,conversation_history,project_files,agent_logs")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || error || !data) return;
      sessionIdRef.current = data.id;
      const turns = Array.isArray(data.conversation_history) ? (data.conversation_history as any[]) : [];
      turnsRef.current = turns.slice(-24).map((t) => ({ role: t.role, content: t.content }));
      const filesObj = (data.project_files ?? {}) as Record<string, { content: string; lang: string }>;
      const restored: LuminaFile[] = Object.entries(filesObj).map(([path, v]) => ({
        path,
        lang: v.lang as LuminaFile["lang"],
        content: v.content,
        done: true,
      }));
      if (restored.length > 0) {
        setFiles(restored);
        setActivePath(restored[0].path);
        // Recreate parser state so continuations work after a reload.
        const p = new LuminaParser();
        for (const f of restored) p.state.files.push(f);
        parserRef.current = p;
      }
      const last = turns[turns.length - 1];
      if (last?.role === "user") lastUserPromptRef.current = String(last.content ?? "");
      if (restored.length > 0 || turns.length > 0) {
        setLogs([{ id: uid(), level: "system", text: `Resumed session · ${restored.length} file(s), ${turns.length} turn(s).`, ts: Date.now() }]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveSession = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Snapshot from the parser when available (most accurate), else from state.
    const currentFiles = parserRef.current?.state.files ?? files;
    const projectFiles: Record<string, { content: string; lang: string }> = {};
    for (const f of currentFiles) {
      projectFiles[f.path] = { content: f.content, lang: f.lang };
    }
    const title =
      (lastUserPromptRef.current || "Untitled session").slice(0, 80) || "Untitled session";
    const payload = {
      user_id: user.id,
      title,
      conversation_history: turnsRef.current,
      project_files: projectFiles,
      agent_logs: logs.slice(-50).map((l) => ({ level: l.level, text: l.text, ts: l.ts })),
      updated_at: new Date().toISOString(),
    };
    if (sessionIdRef.current) {
      await supabase.from("lumina_sessions").update(payload).eq("id", sessionIdRef.current);
    } else {
      const { data, error } = await supabase
        .from("lumina_sessions")
        .insert(payload)
        .select("id")
        .single();
      if (!error && data) sessionIdRef.current = data.id;
    }
  }, [files, logs]);

  // Debounced auto-save: any file/plan/turn change persists within 1.5s.
  useEffect(() => {
    if (files.length === 0 && turnsRef.current.length === 0) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void saveSession();
    }, 1500);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [files, plan, finalMd, saveSession]);



  const reset = useCallback(() => {
    if (busy) abortRef.current?.abort();
    setFiles([]);
    setPlan("");
    setFinalMd("");
    setActivePath(null);
    setAttachments([]);
    setCanContinue(false);
    setFactoryStates(idleFactoryStates());
    setFactoryActive(null);
    setFactoryEvents([]);
    setValidationSummary("");
    rawAssistantRef.current = "";
    lastUserPromptRef.current = "";
    turnsRef.current = [];
    sessionIdRef.current = null;
    parserRef.current = null;
    seenActionsRef.current = new Set();
    setLogs([{ id: uid(), level: "system", text: "Cleared. What next?", ts: Date.now() }]);
  }, [busy]);

  const stop = () => abortRef.current?.abort();

  // ── File upload handling ───────────────────────────────────────────
  const onPickFiles = () => fileInputRef.current?.click();

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList) return;
    const next: Attachment[] = [];
    for (const file of Array.from(fileList)) {
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 20MB)`);
        continue;
      }
      if (file.type.startsWith("image/")) {
        const dataUrl = await new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.readAsDataURL(file);
        });
        next.push({
          id: uid(),
          name: file.name,
          kind: "image",
          size: file.size,
          preview: dataUrl,
        });
      } else {
        const text = await extractDocumentText(file, true);
        next.push({
          id: uid(),
          name: file.name,
          kind: "text",
          size: file.size,
          text: text.slice(0, 50000),
        });
      }
    }
    setAttachments((prev) => [...prev, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (id: string) =>
    setAttachments((prev) => prev.filter((a) => a.id !== id));

  const buildMessageContent = (text: string): any => {
    if (attachments.length === 0) return text;
    const parts: any[] = [{ type: "text", text }];
    const textBlobs: string[] = [];
    for (const a of attachments) {
      if (a.kind === "image" && a.preview) {
        parts.push({ type: "image_url", image_url: { url: a.preview } });
      } else if (a.kind === "text" && a.text) {
        textBlobs.push(`\n\n--- ${a.name} ---\n${a.text}`);
      }
    }
    if (textBlobs.length) {
      parts[0] = { type: "text", text: text + textBlobs.join("") };
    }
    return parts;
  };

  // ── Send ───────────────────────────────────────────────────────────
  const send = useCallback(
    async (text: string, opts: { continuation?: boolean } = {}) => {
      const trimmed = text.trim();
      if ((!trimmed && !opts.continuation) || busy) return;

      const isCont = !!opts.continuation;

      if (!isCont) {
        setFiles([]);
        setPlan("");
        setFinalMd("");
        setActivePath(null);
        setFactoryStates(idleFactoryStates());
        setFactoryEvents([]);
        setValidationSummary("");
        seenActionsRef.current = new Set();
        parserRef.current = new LuminaParser();
        rawAssistantRef.current = "";
        lastUserPromptRef.current = trimmed;
      } else if (!parserRef.current) {
        // nothing to continue from
        return;
      }

      setPrompt("");
      setCanContinue(false);
      if (taRef.current) taRef.current.style.height = "auto";
      setBusy(true);

      const previewAttach =
        attachments.length > 0 ? ` (+${attachments.length} file${attachments.length > 1 ? "s" : ""})` : "";

      if (isCont) {
        log("system", "Continuing from last cut-off…");
        setFactoryStage("builder", "working", "Continuing safely from the previous complete boundary…");
      } else {
        log("system", `You: ${trimmed.slice(0, 140)}${trimmed.length > 140 ? "…" : ""}${previewAttach}`);
        setFactoryStage("planner", "working", "Thinking through scope, acceptance criteria, and file graph…");
        setFactoryStage("planner", "done", "Plan locked: modular files, runnable preview, validation gates.");
        setFactoryStage("router", "working", "Routing through Kimi K2.6 with OpenRouter fallbacks.");
        setFactoryStage("research", "working", "Grounding the build in the exact requested subject.");
        setFactoryStage("research", "done", "Subject context attached to the generation brief.");
        setFactoryStage("architect", "working", "Designing module boundaries, UI system, and runtime behavior.");
        setFactoryStage("architect", "done", "Architecture ready: source, styles, interactions, preview entry.");
      }

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Please sign in to use Lumina Computer.");

        let messages: any[];
        if (isCont) {
          const tail = rawAssistantRef.current.slice(-2500);
          const contPrompt =
            `CONTINUE_LUMINA\n\nORIGINAL_REQUEST:\n${lastUserPromptRef.current}\n\n` +
            `Your previous reply was cut off at the model output limit. ` +
            `Resume EXACTLY where you stopped. Do NOT repeat anything already written. ` +
            `Do NOT restart the plan. Do NOT add commentary. If you were inside a <lumina:file>, ` +
            `finish its body and close </lumina:file>, then continue with any remaining files, ` +
            `then close with <lumina:final>...</lumina:final>.\n\n` +
            `LAST_${tail.length}_CHARS_OF_YOUR_PREVIOUS_REPLY:\n${tail}`;
          messages = [
            { role: "user", content: lastUserPromptRef.current },
            { role: "assistant", content: rawAssistantRef.current },
            { role: "user", content: contPrompt },
          ];
        } else {
          const content = buildMessageContent(trimmed);
          setAttachments([]);
          // Send rolling window of prior turns + new user message.
          const history = turnsRef.current.slice(-12);
          messages = [...history, { role: "user", content }];
        }

        const seenFiles = new Set<string>();
        // re-mark files we already know so we don't re-log them
        for (const f of parserRef.current!.state.files) {
          seenFiles.add(f.path);
          if (f.done) seenFiles.add(`done:${f.path}`);
        }

        const applyState = () => {
          const st = parserRef.current!.state;
          setPlan(st.plan);
          setFinalMd(st.final);
          setFiles([...st.files]);
          if (st.files.length > 0) {
            setActivePath((cur) => cur ?? st.files[0].path);
          }
          for (const f of st.files) {
            if (!seenFiles.has(f.path)) {
              seenFiles.add(f.path);
              log("file", `Creating ${f.path}`);
            }
            if (f.done && !seenFiles.has(`done:${f.path}`)) {
              seenFiles.add(`done:${f.path}`);
              const kb = (f.content.length / 1024).toFixed(1);
              log("file", `Finished ${f.path} · ${kb} KB`);
            }
          }
          for (const a of st.actions) {
            if (seenActionsRef.current.has(a.id)) continue;
            seenActionsRef.current.add(a.id);
            const verb =
              a.type === "navigate"
                ? `Navigate to ${a.target}`
                : a.type === "open"
                  ? `Open ${a.target}`
                  : `Run ${a.target}`;
            log("action", `${verb}${a.reason ? ` — ${a.reason}` : ""}`, a);
          }
        };

        const streamMessages = async (streamMessagesPayload: any[]) => {
          const res = await fetch(CHAT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ messages: streamMessagesPayload, mode: "computer" }),
            signal: ctrl.signal,
          });

          if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let sseBuf = "";
          let firstToken = false;

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
                  log("model", `Using ${parsed.lumina_meta.model}`);
                  setFactoryStage("router", "done", `Model selected: ${parsed.lumina_meta.model}`);
                }
                const delta = parsed?.choices?.[0]?.delta?.content;
                if (typeof delta === "string" && delta.length > 0) {
                  if (!firstToken) {
                    firstToken = true;
                    setFactoryStage("builder", "working", "Coding full files — no fragments, no placeholders.");
                  }
                  rawAssistantRef.current += delta;
                  parserRef.current!.push(delta);
                  applyState();
                }
              } catch {
                sseBuf = line + "\n" + sseBuf;
                break;
              }
            }
          }
        };

        await streamMessages(messages);

        applyState();
        setFactoryStage("builder", "done", "Code stream completed; entering validation gate.");
        setFactoryStage("validator", "working", "Evaluating syntax, subject fit, placeholders, and preview readiness.");
        // Detect truncation — including the worst case the user kept hitting:
        // model truncated INSIDE <lumina:plan> with zero files shipped.
        // Anything that left us mid-plan, mid-file, or without a clean closing
        // tag is fair game for the Continue button.
        let st = parserRef.current!.state;
        const openFile = st.files.some((f) => !f.done);
        const missingFinal = !st.final.trim();
        const tail = rawAssistantRef.current.trimEnd().slice(-40);
        const cleanEnd = /<\/lumina:(final|file|plan)>\s*$/.test(tail);
        const noFilesShipped = st.files.length === 0;
        const planUnclosed =
          rawAssistantRef.current.includes("<lumina:plan>") &&
          !rawAssistantRef.current.includes("</lumina:plan>");
        const enoughOutputToContinue = rawAssistantRef.current.length > 40;
        const looksTruncated =
          enoughOutputToContinue &&
          (openFile || missingFinal || !cleanEnd || noFilesShipped || planUnclosed);
        if (looksTruncated) {
          setCanContinue(true);
          const reason = planUnclosed
            ? "Model truncated inside the planning section — Continue to close the plan and ship files."
            : noFilesShipped
              ? "Stream ended before any file was emitted — Continue to resume."
              : "Validation caught a cut-off response; continuation is required.";
          setFactoryStage("validator", "error", reason);
          log("warn", "Output was cut off — press Continue to resume.");
        } else {
          parserRef.current!.finish();
          applyState();
          st = parserRef.current!.state;
          let issues = validateLuminaProject(st.files, lastUserPromptRef.current);
          setValidationSummary(summarizeValidation(issues));
          const needsRepair = issues.some((issue) => issue.severity === "error" || issue.id === "too-thin");
          if (needsRepair && !isCont) {
            setFactoryStage("validator", "error", summarizeValidation(issues));
            setFactoryStage("debugger", "working", "Fault isolated; regenerating only the broken/thin artifact once.");
            log("warn", `Self-healing: ${summarizeValidation(issues)}`);
            const repairPrompt = buildRepairPrompt(lastUserPromptRef.current, st.files, issues);
            parserRef.current = new LuminaParser();
            rawAssistantRef.current = "";
            seenFiles.clear();
            seenActionsRef.current = new Set();
            setFiles([]);
            setPlan("");
            setFinalMd("");
            setActivePath(null);
            await streamMessages([{ role: "user", content: repairPrompt }]);
            parserRef.current!.finish();
            applyState();
            st = parserRef.current!.state;
            issues = validateLuminaProject(st.files, lastUserPromptRef.current);
            setValidationSummary(summarizeValidation(issues));
            const stillBroken = issues.some((i) => i.severity === "error");
            setFactoryStage("debugger", stillBroken ? "error" : "done", stillBroken ? summarizeValidation(issues) : "Repair passed validation.");
            setFactoryStage("validator", stillBroken ? "error" : "done", summarizeValidation(issues));
          } else {
            setFactoryStage("validator", "done", summarizeValidation(issues));
            setFactoryStage("debugger", "done", "No blocking faults required a repair pass.");
          }
          setFactoryStage("runner", "working", "Running the assembled preview document.");
          if (st.files.some((f) => f.lang === "html")) setPreviewOpen(true);
          setFactoryStage("runner", "done", "Preview target ready.");
          setFactoryStage("assembler", "done", `Assembled ${st.files.length} production file(s).`);
          log("done", `Done · ${st.files.length} file(s)`);
        }
        // Commit this turn to rolling memory (skip continuation turns — they're
        // stitched into the previous assistant message instead).
        if (!isCont && rawAssistantRef.current) {
          turnsRef.current.push(
            { role: "user", content: lastUserPromptRef.current },
            { role: "assistant", content: rawAssistantRef.current.slice(0, 16000) },
          );
          if (turnsRef.current.length > 24) {
            turnsRef.current = turnsRef.current.slice(-24);
          }
        }
      } catch (e: any) {
        if (e?.name === "AbortError") {
          log("warn", "Stopped");
          if (rawAssistantRef.current.length > 200) setCanContinue(true);
        } else {
          log("warn", e?.message ?? "Request failed");
          toast.error(e?.message ?? "Request failed");
        }
      } finally {
        setBusy(false);
        setFactoryActive(null);
        abortRef.current = null;
      }
    },
    [busy, log, attachments, setFactoryStage],
  );

  const onSubmit = () => send(prompt);
  const onContinue = () => send("", { continuation: true });

  const copyActive = () => {
    if (!activeFile) return;
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isEmpty = files.length === 0 && !plan && !finalMd && !busy;

  return (
    <div className="relative h-screen flex flex-col bg-[#0b0b0f] text-white overflow-hidden">
      {/* subtle ambient */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          background:
            "radial-gradient(1200px 600px at 80% -10%, rgba(120,119,198,0.10), transparent), radial-gradient(900px 500px at 0% 100%, rgba(56,189,248,0.06), transparent)",
        }}
      />

      {/* Top bar */}
      <header className="relative z-10 flex items-center gap-3 px-5 h-14 border-b flex-shrink-0" style={{ background: 'hsl(230 25% 6% / 0.85)', backdropFilter: 'blur(24px)', borderColor: 'hsl(0 0% 100% / 0.06)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(174 72% 56%), hsl(264 67% 60%))', boxShadow: '0 2px 8px hsl(174 72% 56% / 0.25)' }}>
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-[14px] font-semibold tracking-tight text-foreground">Lumina Computer</div>
            <div className="text-[11px] text-muted-foreground/50 -mt-0.5">{busy ? "Working…" : model ? model.split("/").pop() : "Idle"}</div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {busy && (
            <button onClick={stop} className="flex items-center gap-1.5 px-3 h-9 rounded-full text-[13px] transition" style={{ background: 'hsl(0 0% 100% / 0.06)', color: 'hsl(210 20% 80%)' }}>
              <Square className="w-3 h-3 fill-current" /> Stop
            </button>
          )}
          <button onClick={reset} className="flex items-center gap-1.5 px-3 h-9 rounded-full text-[13px] transition" style={{ background: 'hsl(0 0% 100% / 0.06)', color: 'hsl(210 20% 80%)' }}>
            <Plus className="w-3.5 h-3.5" /> New
          </button>
          <div title="Planner → Router → Research → Architect → Coding → Evaluating → Debugging → Running → Assembling" className="hidden sm:flex items-center gap-1.5 px-3 h-9 rounded-full text-[13px]" style={{ background: 'hsl(142 71% 45% / 0.08)', border: '1px solid hsl(142 71% 45% / 0.2)', color: 'hsl(142 71% 60%)' }}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Factory
          </div>
          <button onClick={() => setPreviewOpen((v) => !v)} className={`flex items-center gap-1.5 px-3.5 h-9 rounded-full text-[13px] font-medium transition ${previewOpen ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'text-foreground hover:bg-white/[0.06]'}`} style={!previewOpen ? { background: 'hsl(0 0% 100% / 0.08)' } : {}}>
            <Eye className="w-3.5 h-3.5" /> Preview
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="relative z-10 flex-1 grid grid-cols-[260px_1fr] min-h-0">
        {/* File explorer */}
        <aside className="border-r flex flex-col min-h-0" style={{ background: 'hsl(230 20% 8%)', borderColor: 'hsl(0 0% 100% / 0.06)' }}>
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'hsl(0 0% 100% / 0.06)' }}>
            <FolderOpen className="w-3.5 h-3.5 text-muted-foreground/40" />
            <span className="text-[12px] font-medium text-muted-foreground/70">Files</span>
            {files.length > 0 && (
              <span className="ml-1 text-[11px] text-white/30">{files.length}</span>
            )}
            {files.length > 0 && (
              <button
                onClick={() => downloadFilesAsZip(files, `lumina-${Date.now()}.zip`)}
                title="Download all files as ZIP"
                className="ml-auto p-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/[0.08] transition"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="p-2 flex-1 overflow-auto">
            {files.length === 0 ? (
              <div className="text-[12px] text-white/30 px-3 py-4">
                Files will appear here as Lumina creates them.
              </div>
            ) : (
              <FileTree
                files={files}
                activePath={activeFile?.path ?? ""}
                onPick={(p) => setActivePath(p)}
              />
            )}

            {plan && (
              <div className="mt-4 px-3">
                <div className="text-[11px] font-medium text-white/40 mb-1.5">Plan</div>
                <div className="text-[12px] text-white/70 leading-relaxed bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                  <MarkdownRenderer>{plan}</MarkdownRenderer>
                </div>
              </div>
            )}

            {(busy || Object.values(factoryStates).some((s) => s !== "idle")) && (
              <div className="mt-4 px-3">
                <AgentPipelinePanel
                  states={factoryStates}
                  activeLabel={factoryActive}
                  running={busy}
                  tier={busy ? "TIER_2" : validationSummary === "Validation passed" ? "TIER_1" : null}
                  events={factoryEvents}
                />
                {validationSummary && (
                  <div className="mt-2 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-[11px] text-white/45">
                    {validationSummary}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Center: editor + activity + prompt */}
        <main className="flex flex-col min-h-0 min-w-0">
          {/* Editor header */}
          {activeFile && (
            <div className="flex items-center gap-2 px-5 h-10 border-b border-white/[0.06] bg-[#0b0b0f]">
              <span className="text-[12px] text-white/50 truncate">{activeFile.path}</span>
              <button
                onClick={copyActive}
                className="ml-auto p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] transition"
                title="Copy"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <CopyIcon className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          )}

          {/* Editor body */}
          <div className="flex-1 flex flex-col min-h-0">
            {isEmpty ? (
              <EmptyState onPick={(s) => setPrompt(s)} />
            ) : (
              <CodeEditor file={activeFile} />
            )}
          </div>

          {/* Activity feed */}
          <div className="border-t border-white/[0.06] bg-[#0b0b0f] flex-shrink-0">
            <div className="px-5 h-9 flex items-center gap-2 border-b border-white/[0.04]">
              <span className="text-[11px] font-medium text-white/50">Activity</span>
              {canContinue && !busy && (
                <button
                  onClick={onContinue}
                  className="ml-auto flex items-center gap-1.5 px-2.5 h-7 rounded-full bg-white text-black text-[11px] font-medium hover:bg-white/90 transition"
                  title="Resume from the last line"
                >
                  <ArrowUp className="w-3 h-3" /> Continue
                </button>
              )}
              {busy && <Loader2 className="w-3 h-3 text-white/60 animate-spin ml-auto" />}
            </div>
            <div className="max-h-[160px] overflow-auto px-5 py-2">
              {logs.slice(-8).map((l) => (
                <ActivityEntry
                  key={l.id}
                  line={l}
                  onConfirm={confirmAction}
                  onDismiss={dismissAction}
                />
              ))}
            </div>
          </div>

          {/* Prompt bar — bottom */}
          <div className="border-t border-white/[0.08] bg-[#0b0b0f] px-5 py-4 flex-shrink-0">
            <div className="max-w-3xl mx-auto">
              {/* Prominent Continue banner — surfaces when the model truncates
                  mid-plan or mid-file so the user can recover with one click. */}
              {canContinue && !busy && (
                <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-amber-400/30 bg-amber-400/[0.08] px-4 py-2.5">
                  <div className="flex items-center gap-2 text-[12.5px] text-amber-100/95">
                    <Loader2 className="w-3.5 h-3.5" />
                    <span>Output was cut off. Continue from the exact stop point.</span>
                  </div>
                  <button
                    onClick={onContinue}
                    className="flex items-center gap-1.5 px-3.5 h-8 rounded-full bg-amber-300 text-black text-[12px] font-semibold hover:bg-amber-200 transition shadow"
                  >
                    <ArrowUp className="w-3.5 h-3.5" /> Continue
                  </button>
                </div>
              )}

              {/* Attachment chips */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {attachments.map((a) => (
                    <div
                      key={a.id}
                      className="group flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg bg-white/[0.06] border border-white/[0.08] text-[12px] text-white/80"
                    >
                      {a.kind === "image" ? (
                        <ImageIcon className="w-3.5 h-3.5 text-white/50" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-white/50" />
                      )}
                      <span className="truncate max-w-[160px]">{a.name}</span>
                      <button
                        onClick={() => removeAttachment(a.id)}
                        className="p-0.5 rounded hover:bg-white/[0.1] text-white/50 hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2 rounded-2xl border border-white/[0.1] bg-white/[0.04] focus-within:border-white/30 focus-within:bg-white/[0.06] transition px-3 py-2.5 shadow-[0_4px_30px_-12px_rgba(0,0,0,0.5)]">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={DOCUMENT_ACCEPT}
                  hidden
                  onChange={(e) => handleFiles(e.target.files)}
                />
                <button
                  onClick={onPickFiles}
                  disabled={busy}
                  className="w-8 h-8 grid place-items-center rounded-lg text-white/60 hover:text-white hover:bg-white/[0.08] transition disabled:opacity-30"
                  title="Attach files"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

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
                  placeholder={
                    busy
                      ? "Lumina is building…"
                      : "Ask Lumina to build, research, or open a page…"
                  }
                  disabled={busy}
                  className="flex-1 bg-transparent resize-none outline-none text-[14px] text-white placeholder:text-white/35 py-1.5 leading-relaxed max-h-[200px]"
                />

                <button
                  onClick={onSubmit}
                  disabled={busy || !prompt.trim()}
                  className="w-8 h-8 grid place-items-center rounded-lg bg-white text-black hover:bg-white/90 disabled:bg-white/20 disabled:text-white/40 disabled:cursor-not-allowed transition"
                >
                  {busy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowUp className="w-4 h-4" />
                  )}
                </button>
              </div>
              <div className="text-[11px] text-white/30 text-center mt-2">
                Lumina can make mistakes. Attach images or text files for context.
              </div>
            </div>
          </div>
        </main>
      </div>

      <PreviewPanel
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        files={files}
        activeFile={activeFile}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Empty state — Apple-clean welcome
// ─────────────────────────────────────────────────────────────────────
function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="flex-1 overflow-auto bg-[#0e0e12]">
      <div className="max-w-2xl mx-auto px-8 py-16">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-white to-white/70 flex items-center justify-center shadow-sm mb-5">
          <Cpu className="w-6 h-6 text-black" />
        </div>
        <h1 className="text-[34px] font-semibold tracking-tight leading-tight text-white mb-2">
          What should we build?
        </h1>
        <p className="text-white/55 text-[15px] leading-relaxed mb-8 max-w-xl">
          Describe an interactive page, a deep research report, or a study tool.
          Lumina plans, writes the code live, and renders it in the preview.
        </p>

        <div className="space-y-2 mb-10">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => onPick(s)}
              className="group w-full text-left flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/15 transition"
            >
              <Sparkles className="w-4 h-4 text-white/40 flex-shrink-0 group-hover:text-white/80 transition" />
              <span className="text-[14px] text-white/85 flex-1">{s}</span>
              <ArrowUp className="w-3.5 h-3.5 text-white/25 rotate-45 group-hover:text-white/70 transition" />
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Tile icon={PlayCircle} label="Run" desc="Live preview" />
          <Tile icon={FolderOpen} label="Files" desc="Multi-file output" />
          <Tile icon={Compass} label="Navigate" desc="Open Lumina pages" />
        </div>
      </div>
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  desc,
}: {
  icon: typeof PlayCircle;
  label: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
      <Icon className="w-4 h-4 text-white/60 mb-2" />
      <div className="text-[13px] font-medium text-white/90">{label}</div>
      <div className="text-[12px] text-white/40 mt-0.5">{desc}</div>
    </div>
  );
}

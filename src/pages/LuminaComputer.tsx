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
import { useLuminaPipeline } from "@/hooks/useLuminaPipeline";
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
  "Build an interactive visualiser for Newton's three laws.",
  "Make a beautiful calculus practice page with 10 MCQs.",
  "Deep research: India's renewable energy 2020 – 2030.",
  "Create a focus-mode pomodoro with ambient sound.",
];

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

  // 6-agent pipeline status (hook drives the lumina-pipeline edge function).
  const pipeline = useLuminaPipeline();

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

  const reset = useCallback(() => {
    if (busy) abortRef.current?.abort();
    setFiles([]);
    setPlan("");
    setFinalMd("");
    setActivePath(null);
    setAttachments([]);
    setCanContinue(false);
    rawAssistantRef.current = "";
    lastUserPromptRef.current = "";
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
      } else {
        log("system", `You: ${trimmed.slice(0, 140)}${trimmed.length > 140 ? "…" : ""}${previewAttach}`);
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
          messages = [{ role: "user", content }];
        }

        const res = await fetch(CHAT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ messages, mode: "computer" }),
          signal: ctrl.signal,
        });

        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let sseBuf = "";
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
              }
              const delta = parsed?.choices?.[0]?.delta?.content;
              if (typeof delta === "string" && delta.length > 0) {
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

        applyState();
        // Detect truncation: any open file, no <lumina:final>, or raw stream
        // didn't end with a closing lumina tag.
        const st = parserRef.current!.state;
        const openFile = st.files.some((f) => !f.done);
        const missingFinal = !st.final.trim();
        const tail = rawAssistantRef.current.trimEnd().slice(-40);
        const cleanEnd = /<\/lumina:(final|file|plan)>\s*$/.test(tail);
        const looksTruncated = openFile || missingFinal || !cleanEnd;
        if (looksTruncated) {
          setCanContinue(true);
          log("warn", "Output was cut off — press Continue to resume.");
        } else {
          parserRef.current!.finish();
          applyState();
          log("done", `Done · ${st.files.length} file(s)`);
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
        abortRef.current = null;
      }
    },
    [busy, log, attachments],
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
      <header className="relative z-10 flex items-center gap-3 px-5 h-14 border-b border-white/[0.08] bg-[#0b0b0f]/80 backdrop-blur-xl flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-white to-white/70 flex items-center justify-center shadow-sm">
            <Cpu className="w-4 h-4 text-black" />
          </div>
          <div>
            <div className="text-[14px] font-semibold tracking-tight text-white">
              Lumina Computer
            </div>
            <div className="text-[11px] text-white/40 -mt-0.5">
              {busy ? "Working…" : model ? model.split("/").pop() : "Idle"}
            </div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {busy && (
            <button
              onClick={stop}
              className="flex items-center gap-1.5 px-3 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-white/80 text-[13px] transition"
            >
              <Square className="w-3 h-3 fill-current" /> Stop
            </button>
          )}
          <button
            onClick={reset}
            className="flex items-center gap-1.5 px-3 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-white/80 text-[13px] transition"
          >
            <Plus className="w-3.5 h-3.5" /> New
          </button>
          <button
            onClick={async () => {
              const text = prompt.trim();
              if (!text) {
                toast.error("Type a request first to run the agent pipeline.");
                return;
              }
              try {
                await pipeline.run(text);
                if (pipeline.finalOutput) {
                  setFiles((prev) => [
                    ...prev.filter((f) => f.path !== "pipeline-output.md"),
                    { path: "pipeline-output.md", lang: "md", content: pipeline.finalOutput, done: true } as LuminaFile,
                  ]);
                  setActivePath("pipeline-output.md");
                }
              } catch (e: any) {
                toast.error(e?.message ?? "Pipeline failed");
              }
            }}
            disabled={pipeline.running}
            title="Run the 6-agent pipeline (Orchestrate → Plan → Research → Build → Debug → Optimize)"
            className="flex items-center gap-1.5 px-3 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-white/80 text-[13px] transition disabled:opacity-50"
          >
            {pipeline.running ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            Pipeline
          </button>
          <button
            onClick={() => setPreviewOpen((v) => !v)}
            className={`flex items-center gap-1.5 px-3.5 h-9 rounded-full text-[13px] font-medium transition ${
              previewOpen
                ? "bg-white text-black hover:bg-white/90"
                : "bg-white/[0.08] text-white hover:bg-white/[0.12]"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Preview
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="relative z-10 flex-1 grid grid-cols-[260px_1fr] min-h-0">
        {/* File explorer */}
        <aside className="border-r border-white/[0.06] bg-[#0e0e12] flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
            <FolderOpen className="w-3.5 h-3.5 text-white/40" />
            <span className="text-[12px] font-medium text-white/70">Files</span>
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

            {(pipeline.running ||
              Object.values(pipeline.states).some((s) => s !== "idle")) && (
              <div className="mt-4 px-3">
                <AgentPipelinePanel
                  states={pipeline.states}
                  activeLabel={pipeline.activeLabel}
                  running={pipeline.running}
                  skills={pipeline.skills}
                  tier={pipeline.tier}
                />
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

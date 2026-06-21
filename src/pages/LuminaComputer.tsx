/**
 * Lumina Computer — Ultimate AI Coding Environment
 * 
 * Features:
 * - Effort picker: Quick / Normal / Beast
 * - OWL-alpha model (hidden, always best)
 * - Plan shown in separate panel
 * - File tabs with syntax highlighting
 * - Split view: code + preview
 * - Terminal panel
 * - Reliable Continue
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp, Paperclip, Square, Plus, FileCode, FileText, Eye, Copy as CopyIcon,
  Check, Loader2, X, Sparkles, Cpu, Download, Maximize2, Minimize2,
  PlayCircle, FolderOpen, Compass, CheckCircle2, Image as ImageIcon,
  Terminal as TerminalIcon, PanelLeftClose, PanelLeftOpen, Zap, Brain, Rocket,
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
import Prism from "prismjs";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-css";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-json";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-python";
import "prismjs/components/prism-bash";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

// ── Types ──
interface Attachment { id: string; name: string; kind: "image" | "text" | "file"; size: number; preview?: string; text?: string; }
interface LogLine { id: string; level: "system" | "model" | "file" | "action" | "done" | "warn"; text: string; ts: number; action?: LuminaAction; }
type Effort = 'quick' | 'normal' | 'beast';

const EFFORT_CONFIG = {
  quick: { label: 'Quick', icon: Zap, color: '#2DD4BF', desc: 'Fast & simple' },
  normal: { label: 'Normal', icon: Brain, color: '#7C5CFC', desc: 'Balanced quality' },
  beast: { label: 'Beast', icon: Rocket, color: '#F59E0B', desc: 'Maximum quality' },
};

const SUGGESTIONS = [
  "Build a photosynthesis learning lab with chloroplast animation and exam practice.",
  "Make a premium calculus derivatives studio with graphing and 10 MCQs.",
  "Create a climate-tech investor dashboard with unique editorial UI.",
  "Build a focus-mode pomodoro with ambient sound and task analytics.",
];

const FACTORY_STAGES: PipelineStage[] = ["planner","router","research","architect","builder","validator","debugger","runner","assembler"];
const idleFactoryStates = () => Object.fromEntries(FACTORY_STAGES.map(s => [s, "idle"])) as Record<PipelineStage, StageStatus>;

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function timeFmt(ts: number) { const d = new Date(ts); return `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`; }

function buildPreviewDoc(file: LuminaFile, allFiles: LuminaFile[]): string {
  if (file.lang === "html") {
    let html = file.content;
    if (!/<!doctype html/i.test(html) && !/<html[\s>]/i.test(html)) {
      html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${html}</body></html>`;
    }
    const css = allFiles.find(f => f.lang === "css");
    const js = allFiles.find(f => f.lang === "js");
    if (css && !html.includes(css.path)) html = html.replace(/<\/head>/i, `<style>\n${css.content}\n</style></head>`);
    if (js && !html.includes(js.path)) html = html.replace(/<\/body>/i, `<script>\n${js.content}\n<\/script></body>`);
    return html;
  }
  if (file.lang === "md") {
    const escaped = file.content.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    return `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:40px;font:15px/1.7 -apple-system,BlinkMacSystemFont,Inter,system-ui,sans-serif;background:#fafafa;color:#1d1d1f;max-width:780px;margin:auto}pre{white-space:pre-wrap;word-wrap:break-word;font-family:inherit}</style></head><body><pre>${escaped}</pre></body></html>`;
  }
  const safe = file.content.replace(/&/g,"&amp;").replace(/</g,"&lt;");
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:24px;font:13px/1.6 ui-monospace,SF Mono,Menlo,monospace;background:#0b0b0f;color:#e8e6ff;white-space:pre}</style></head><body>${safe}</body></html>`;
}

function getFileIcon(lang: string) {
  switch (lang) {
    case "html": return FileCode;
    case "css": return FileCode;
    case "js": case "ts": case "jsx": case "tsx": return FileCode;
    case "json": return FileCode;
    case "md": return FileText;
    default: return FileText;
  }
}

function highlightCode(code: string, lang: string): string {
  const prismLang = lang === "html" ? "markup" : lang === "js" || lang === "jsx" ? "javascript" : lang === "ts" || lang === "tsx" ? "typescript" : lang === "css" ? "css" : lang === "json" ? "json" : lang === "md" ? "markdown" : "markup";
  try {
    return Prism.highlight(code, Prism.languages[prismLang] || Prism.languages.markup, prismLang);
  } catch {
    return code.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }
}

// ── Syntax Highlighted Editor ──
function CodeEditor({ file, allFiles }: { file: LuminaFile | null; allFiles: LuminaFile[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!file || file.done) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [file?.content, file?.done]);

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: "var(--text-muted)", fontSize: 14 }}>
        Select a file to view its code.
      </div>
    );
  }

  const highlighted = useMemo(() => highlightCode(file.content, file.lang), [file.content, file.lang]);
  const lines = file.content.split("\n");

  return (
    <div ref={scrollRef} className="flex-1 overflow-auto" style={{ background: "var(--bg-surface)" }}>
      <pre className="m-0 p-0 text-[13px] leading-[1.65] font-mono" style={{ color: "var(--text-secondary)" }}>
        <code>
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((_, i) => (
                <tr key={i} className="hover:bg-white/[0.02]">
                  <td className="select-none text-right pr-4 pl-4 w-12 flex-shrink-0 align-top" style={{ color: "var(--text-muted)", fontSize: 11, borderRight: "1px solid var(--border-subtle)" }}>
                    {i + 1}
                  </td>
                  <td className="pl-4 pr-6">
                    <div dangerouslySetInnerHTML={{ __html: highlighted.split("\n")[i] || "&nbsp;" }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </code>
      </pre>
    </div>
  );
}

// ── Preview Panel ──
function PreviewPanel({ open, onClose, files, activeFile }: { open: boolean; onClose: () => void; files: LuminaFile[]; activeFile: LuminaFile | null }) {
  const [fullscreen, setFullscreen] = useState(false);
  const previewTarget = useMemo(() => {
    if (activeFile && activeFile.lang === "html") return activeFile;
    return files.find(f => f.lang === "html") ?? activeFile;
  }, [files, activeFile]);
  const doc = useMemo(() => previewTarget ? buildPreviewDoc(previewTarget, files) : "", [previewTarget, files]);

  if (!open) return null;

  const wrapCls = fullscreen
    ? "fixed inset-0 z-[200] flex flex-col"
    : "fixed top-0 right-0 bottom-0 z-[100] w-[min(720px,60vw)] border-l flex flex-col shadow-[-30px_0_60px_-30px_rgba(0,0,0,0.7)]";

  return (
    <div className={wrapCls} style={{ background: "var(--bg-base)", borderColor: "var(--border-default)" }}>
      <div className="flex items-center gap-2 px-4 h-10 border-b flex-shrink-0" style={{ borderColor: "var(--border-subtle)" }}>
        <Eye className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
        <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Preview</span>
        {previewTarget && <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{previewTarget.path}</span>}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setFullscreen(!fullscreen)} className="p-1.5 rounded transition" style={{ color: "var(--text-muted)" }} title="Fullscreen">
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button onClick={onClose} className="p-1.5 rounded transition" style={{ color: "var(--text-muted)" }} title="Close">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="flex-1 relative overflow-hidden" style={{ background: "var(--text-primary)", minHeight: 400 }}>
        {previewTarget ? (
          <iframe title="Lumina Preview" srcDoc={doc} sandbox="allow-scripts allow-forms allow-popups allow-modals allow-pointer-lock" className="w-full h-full border-0" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ color: "var(--text-muted)", background: "var(--bg-surface)" }}>
            <Sparkles className="w-5 h-5 opacity-40" />
            <span className="text-sm">Nothing to preview yet.</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Activity Entry ──
function ActivityEntry({ line, onConfirm, onDismiss }: { line: LogLine; onConfirm?: (id: string) => void; onDismiss?: (id: string) => void }) {
  const dot = line.level === "warn" ? "bg-amber-400" : line.level === "done" ? "bg-emerald-400" : line.level === "file" ? "bg-violet-400" : line.level === "action" ? "bg-amber-400" : line.level === "model" ? "bg-sky-400" : "bg-white/20";
  const act = line.action;
  return (
    <div className="flex gap-2 items-start py-1">
      <span className={`w-1.5 h-1.5 mt-1.5 rounded-full flex-shrink-0 ${dot}`} />
      <div className="flex-1 min-w-0">
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{line.text}</span>
        <span className="text-[10px] ml-2" style={{ color: "var(--text-muted)" }}>{timeFmt(line.ts)}</span>
        {act && act.status === "proposed" && (
          <div className="flex gap-2 mt-1">
            <button onClick={() => onConfirm?.(act.id)} className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium" style={{ background: "var(--text-primary)", color: "var(--bg-base)" }}>
              <CheckCircle2 className="w-2.5 h-2.5" /> Confirm
            </button>
            <button onClick={() => onDismiss?.(act.id)} className="px-2 py-0.5 rounded-md text-[10px]" style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>Dismiss</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ──
export default function LuminaComputer() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [files, setFiles] = useState<LuminaFile[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [plan, setPlan] = useState("");
  const [finalMd, setFinalMd] = useState("");
  const [logs, setLogs] = useState<LogLine[]>([{ id: uid(), level: "system", text: "Lumina Computer is ready.", ts: Date.now() }]);
  const [busy, setBusy] = useState(false);
  const [effort, setEffort] = useState<Effort>('normal');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canContinue, setCanContinue] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [planOpen, setPlanOpen] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const parserRef = useRef<LuminaParser | null>(null);
  const rawAssistantRef = useRef("");
  const lastUserPromptRef = useRef("");
  const turnsRef = useRef<{ role: "user" | "assistant"; content: any }[]>([]);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const seenActionsRef = useRef<Set<string>>(new Set());
  const sessionIdRef = useRef<string | null>(null);
  const [factoryStates, setFactoryStates] = useState<Record<PipelineStage, StageStatus>>(idleFactoryStates);
  const [factoryActive, setFactoryActive] = useState<string | null>(null);
  const [factoryEvents, setFactoryEvents] = useState<string[]>([]);
  const [validationSummary, setValidationSummary] = useState("");

  const activeFile = useMemo(() => files.find(f => f.path === activePath) ?? files[0] ?? null, [files, activePath]);
  const activeFileIndex = useMemo(() => files.findIndex(f => f.path === activePath), [files, activePath]);

  const log = useCallback((level: LogLine["level"], text: string, action?: LuminaAction) => {
    setLogs(prev => [...prev.slice(-200), { id: uid(), level, text, ts: Date.now(), action }]);
  }, []);

  const setFactoryStage = useCallback((stage: PipelineStage, status: StageStatus, event?: string) => {
    setFactoryStates(prev => ({ ...prev, [stage]: status }));
    if (status === "working") setFactoryActive(event ?? stage);
    if (event) setFactoryEvents(prev => [...prev.slice(-40), event]);
  }, []);

  useEffect(() => {
    if (!previewOpen && files.some(f => f.lang === "html") && busy) setPreviewOpen(true);
  }, [files, busy, previewOpen]);

  const autoResize = (el: HTMLTextAreaElement) => { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 200) + "px"; };

  const runAction = useCallback((act: LuminaAction) => {
    if (act.type === "navigate") { log("done", `Navigated to ${act.target}`); navigate(act.target); }
    else if (act.type === "open") { const f = files.find(f => f.path === act.target || f.path.endsWith(act.target)); if (f) setActivePath(f.path); else log("warn", `File not found: ${act.target}`); }
    else if (act.type === "run") { setPreviewOpen(true); const f = files.find(f => f.path === act.target || f.path.endsWith(act.target)); if (f) setActivePath(f.path); }
  }, [files, log, navigate]);

  const confirmAction = useCallback((id: string) => {
    setLogs(prev => prev.map(l => l.action?.id === id ? { ...l, action: { ...l.action, status: "confirmed" } } : l));
    const target = logs.find(l => l.action?.id === id)?.action;
    if (target) runAction(target);
  }, [logs, runAction]);

  const dismissAction = useCallback((id: string) => {
    setLogs(prev => prev.map(l => l.action?.id === id ? { ...l, action: { ...l.action!, status: "dismissed" } } : l));
  }, []);

  const reset = useCallback(() => {
    if (busy) abortRef.current?.abort();
    setFiles([]); setPlan(""); setFinalMd(""); setActivePath(null); setAttachments([]);
    setCanContinue(false); setFactoryStates(idleFactoryStates()); setFactoryActive(null);
    setFactoryEvents([]); setValidationSummary("");
    rawAssistantRef.current = ""; lastUserPromptRef.current = ""; turnsRef.current = [];
    sessionIdRef.current = null; parserRef.current = null; seenActionsRef.current = new Set();
    setLogs([{ id: uid(), level: "system", text: "Cleared. What next?", ts: Date.now() }]);
  }, [busy]);

  const stop = () => abortRef.current?.abort();

  const onPickFiles = () => fileInputRef.current?.click();
  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList) return;
    const next: Attachment[] = [];
    for (const file of Array.from(fileList)) {
      if (file.size > 20 * 1024 * 1024) { toast.error(`${file.name} is too large (max 20MB)`); continue; }
      if (file.type.startsWith("image/")) {
        const dataUrl = await new Promise<string>(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result as string); r.readAsDataURL(file); });
        next.push({ id: uid(), name: file.name, kind: "image", size: file.size, preview: dataUrl });
      } else {
        const text = await extractDocumentText(file, true);
        next.push({ id: uid(), name: file.name, kind: "text", size: file.size, text: text.slice(0, 50000) });
      }
    }
    setAttachments(prev => [...prev, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const buildMessageContent = (text: string): any => {
    if (attachments.length === 0) return text;
    const parts: any[] = [{ type: "text", text }];
    const textBlobs: string[] = [];
    for (const a of attachments) {
      if (a.kind === "image" && a.preview) parts.push({ type: "image_url", image_url: { url: a.preview } });
      else if (a.kind === "text" && a.text) textBlobs.push(`\n\n--- ${a.name} ---\n${a.text}`);
    }
    if (textBlobs.length) parts[0] = { type: "text", text: text + textBlobs.join("") };
    return parts;
  };

  // Send
  const send = useCallback(async (text: string, opts: { continuation?: boolean } = {}) => {
    const trimmed = text.trim();
    if ((!trimmed && !opts.continuation) || busy) return;
    const isCont = !!opts.continuation;

    if (!isCont) {
      setFiles([]); setPlan(""); setFinalMd(""); setActivePath(null);
      setFactoryStates(idleFactoryStates()); setFactoryEvents([]); setValidationSummary("");
      seenActionsRef.current = new Set();
      parserRef.current = new LuminaParser();
      rawAssistantRef.current = "";
      lastUserPromptRef.current = trimmed;
    } else if (!parserRef.current) return;

    setPrompt(""); setCanContinue(false);
    if (taRef.current) taRef.current.style.height = "auto";
    setBusy(true);

    if (isCont) {
      log("system", "Continuing from last cut-off...");
    } else {
      log("system", `You: ${trimmed.slice(0, 140)}${trimmed.length > 140 ? "..." : ""}`);
    }

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Please sign in.");

      let messages: any[];
      if (isCont) {
        const tail = rawAssistantRef.current.slice(-2500);
        const contPrompt = `CONTINUE_LUMINA\n\nORIGINAL_REQUEST:\n${lastUserPromptRef.current}\n\nYour previous reply was cut off. Resume EXACTLY where you stopped. Do NOT repeat, do NOT restart the plan. If inside <lumina:file>, finish the body and close </lumina:file>, continue with remaining files, then <lumina:final>.\n\nLAST_${tail.length}_CHARS:\n${tail}`;
        messages = [
          { role: "user", content: lastUserPromptRef.current },
          { role: "assistant", content: rawAssistantRef.current },
          { role: "user", content: contPrompt },
        ];
      } else {
        const content = buildMessageContent(trimmed);
        setAttachments([]);
        const history = turnsRef.current.slice(-12);
        messages = [...history, { role: "user", content }];
      }

      const seenFiles = new Set<string>();
      for (const f of parserRef.current!.state.files) { seenFiles.add(f.path); if (f.done) seenFiles.add(`done:${f.path}`); }

      const applyState = () => {
        const st = parserRef.current!.state;
        // FILTER OUT response.md from files list - plan goes in plan panel
        const displayFiles = st.files.filter(f => f.path !== "response.md");
        setPlan(st.plan);
        setFinalMd(st.final);
        setFiles(displayFiles);
        if (displayFiles.length > 0) setActivePath(cur => cur ?? displayFiles[0].path);
        for (const f of st.files) {
          if (!seenFiles.has(f.path)) { seenFiles.add(f.path); log("file", `Creating ${f.path}`); }
          if (f.done && !seenFiles.has(`done:${f.path}`)) { seenFiles.add(`done:${f.path}`); log("file", `Finished ${f.path}`); }
        }
        for (const a of st.actions) {
          if (seenActionsRef.current.has(a.id)) continue;
          seenActionsRef.current.add(a.id);
          log("action", `${a.type} ${a.target}${a.reason ? " - " + a.reason : ""}`, a);
        }
      };

      const streamMessages = async (payload: any[]) => {
        const res = await fetch(CHAT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ messages: payload, mode: "computer", effort }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let sseBuf = "";
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
              if (parsed?.lumina_meta?.model) { setModel(parsed.lumina_meta.model); log("model", `Using ${parsed.lumina_meta.model}`); }
              const delta = parsed?.choices?.[0]?.delta?.content;
              if (typeof delta === "string" && delta.length > 0) {
                rawAssistantRef.current += delta;
                parserRef.current!.push(delta);
                applyState();
              }
            } catch { sseBuf = line + "\n" + sseBuf; break; }
          }
        }
      };

      await streamMessages(messages);
      applyState();

      // Detect truncation
      let st = parserRef.current!.state;
      const displayFiles = st.files.filter(f => f.path !== "response.md");
      const openFile = st.files.some(f => !f.done);
      const missingFinal = !st.final.trim();
      const tail = rawAssistantRef.current.trimEnd().slice(-40);
      const cleanEnd = /<\/lumina:(final|file|plan)>\s*$/.test(tail);
      const noFilesShipped = displayFiles.length === 0;
      const planUnclosed = rawAssistantRef.current.includes("<lumina:plan>") && !rawAssistantRef.current.includes("</lumina:plan>");
      const enoughOutput = rawAssistantRef.current.length > 40;
      const looksTruncated = enoughOutput && (openFile || missingFinal || !cleanEnd || noFilesShipped || planUnclosed);

      if (looksTruncated) {
        setCanContinue(true);
        log("warn", "Output was cut off - press Continue to resume.");
      } else {
        // Validate
        parserRef.current!.finish();
        applyState();
        st = parserRef.current!.state;
        const issues = validateLuminaProject(st.files, lastUserPromptRef.current);
        setValidationSummary(summarizeValidation(issues));
        log("done", `Done - ${displayFiles.length} file(s). ${summarizeValidation(issues)}`);
      }

      if (!isCont && rawAssistantRef.current) {
        turnsRef.current.push(
          { role: "user", content: lastUserPromptRef.current },
          { role: "assistant", content: rawAssistantRef.current.slice(0, 16000) },
        );
        if (turnsRef.current.length > 24) turnsRef.current = turnsRef.current.slice(-24);
      }
    } catch (e: any) {
      if (e?.name === "AbortError") {
        log("warn", "Stopped");
        if (rawAssistantRef.current.length > 200) setCanContinue(true);
      } else { log("warn", e?.message ?? "Request failed"); toast.error(e?.message ?? "Request failed"); }
    } finally { setBusy(false); setFactoryActive(null); abortRef.current = null; }
  }, [busy, log, attachments, setFactoryStage]);

  const onSubmit = () => send(prompt);
  const onContinue = () => send("", { continuation: true });

  const copyActive = () => { if (!activeFile) return; navigator.clipboard.writeText(activeFile.content); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const isEmpty = files.length === 0 && !plan && !finalMd && !busy;

  return (
    <div className="relative h-screen flex flex-col overflow-hidden" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      {/* Top Bar */}
      <header className="relative z-10 flex items-center gap-3 px-4 h-11 border-b flex-shrink-0" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `linear-gradient(135deg, var(--teal), var(--brand))` }}>
            <Cpu className="w-3 h-3 text-white" />
          </div>
          <span className="text-[13px] font-semibold tracking-tight">Lumina Computer</span>
        </div>

        {/* Effort Picker */}
        <div className="flex items-center gap-1 ml-4">
          {(['quick', 'normal', 'beast'] as Effort[]).map(e => {
            const cfg = EFFORT_CONFIG[e];
            const Icon = cfg.icon;
            const isActive = effort === e;
            return (
              <button
                key={e}
                onClick={() => setEffort(e)}
                className="flex items-center gap-1 px-2.5 h-7 rounded-md text-[11px] font-medium transition-all"
                style={{
                  background: isActive ? cfg.color + '20' : 'transparent',
                  color: isActive ? cfg.color : 'var(--text-muted)',
                  border: isActive ? `1px solid ${cfg.color}40` : '1px solid transparent',
                }}
                title={cfg.desc}
              >
                <Icon className="w-3 h-3" />
                {cfg.label}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-1">
          {busy && (
            <button onClick={stop} className="flex items-center gap-1 px-2.5 h-7 rounded-md text-[11px] font-medium" style={{ background: "var(--red-tint)", color: "var(--red)" }}>
              <Square className="w-2.5 h-2.5 fill-current" /> Stop
            </button>
          )}
          <button onClick={reset} className="flex items-center gap-1 px-2.5 h-7 rounded-md text-[11px]" style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
            <Plus className="w-3 h-3" /> New
          </button>
          <button onClick={() => setPreviewOpen(v => !v)} className="flex items-center gap-1 px-2.5 h-7 rounded-md text-[11px] font-medium" style={{ background: previewOpen ? "var(--brand)" : "var(--bg-elevated)", color: previewOpen ? "white" : "var(--text-secondary)" }}>
            <Eye className="w-3 h-3" /> Preview
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="relative z-10 flex-1 flex min-h-0">
        {/* File Explorer */}
        <aside className="border-r flex flex-col min-h-0 flex-shrink-0" style={{ width: 240, borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          <div className="px-3 py-2.5 border-b flex items-center gap-2" style={{ borderColor: "var(--border-subtle)" }}>
            <FolderOpen className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
            <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>Files</span>
            {files.length > 0 && <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{files.length}</span>}
            {files.length > 0 && (
              <button onClick={() => downloadFilesAsZip(files, `lumina-${Date.now()}.zip`)} className="ml-auto p-1 rounded transition" style={{ color: "var(--text-muted)" }} title="Download ZIP">
                <Download className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-auto p-2">
            {files.length === 0 ? (
              <div className="text-[11px] px-2 py-4 text-center" style={{ color: "var(--text-muted)" }}>
                Files will appear here.
              </div>
            ) : (
              <FileTree files={files} activePath={activeFile?.path ?? ""} onPick={p => setActivePath(p)} />
            )}
          </div>
        </aside>

        {/* Center: Editor + Activity + Prompt */}
        <main className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* File Tabs */}
          {files.length > 0 && (
            <div className="flex items-center border-b flex-shrink-0 overflow-x-auto" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}>
              {files.map(f => {
                const Icon = getFileIcon(f.lang);
                const isActive = f.path === activeFile?.path;
                return (
                  <button
                    key={f.path}
                    onClick={() => setActivePath(f.path)}
                    className="flex items-center gap-1.5 px-4 h-9 text-[11px] font-medium border-r whitespace-nowrap flex-shrink-0 transition"
                    style={{
                      borderColor: "var(--border-subtle)",
                      background: isActive ? "var(--bg-surface)" : "transparent",
                      color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                      borderBottom: isActive ? "2px solid var(--brand)" : "2px solid transparent",
                    }}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{f.path.split("/").pop()}</span>
                    {!f.done && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--amber)" }} />}
                  </button>
                );
              })}
              <div className="flex-1" />
              {activeFile && (
                <button onClick={copyActive} className="px-3 h-9 flex items-center" style={{ color: "var(--text-muted)" }} title="Copy">
                  {copied ? <Check className="w-3 h-3" style={{ color: "var(--green)" }} /> : <CopyIcon className="w-3 h-3" />}
                </button>
              )}
            </div>
          )}

          {/* Plan Panel (collapsible) */}
          {plan && (
            <div className="border-b flex-shrink-0" style={{ borderColor: "var(--border-subtle)" }}>
              <button onClick={() => setPlanOpen(v => !v)} className="w-full flex items-center gap-2 px-4 h-8 text-[11px] font-medium" style={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }}>
                <span>{planOpen ? "▼" : "▶"}</span> Plan
              </button>
              {planOpen && (
                <div className="px-4 py-3 max-h-32 overflow-auto" style={{ background: "var(--bg-surface)" }}>
                  <MarkdownRenderer>{plan}</MarkdownRenderer>
                </div>
              )}
            </div>
          )}

          {/* Editor + Preview Split */}
          <div className="flex-1 flex min-h-0">
            {/* Code Editor */}
            <div className="flex-1 flex flex-col min-w-0" style={{ borderRight: previewOpen && activeFile?.lang === "html" ? "1px solid var(--border-subtle)" : "none" }}>
              {isEmpty ? (
                <div className="flex-1 flex items-center justify-center" style={{ color: "var(--text-muted)", fontSize: 14 }}>
                  Ready when you are.
                </div>
              ) : activeFile?.lang === "html" && previewOpen ? (
                <div className="flex-1 flex min-h-0">
                  <div className="flex-1 min-w-0">
                    <CodeEditor file={activeFile} allFiles={files} />
                  </div>
                  <div className="flex-1 min-w-0 border-l" style={{ borderColor: "var(--border-subtle)" }}>
                    <iframe title="Preview" srcDoc={buildPreviewDoc(activeFile, files)} sandbox="allow-scripts allow-forms allow-popups allow-modals allow-pointer-lock" className="w-full h-full border-0" style={{ background: "white" }} />
                  </div>
                </div>
              ) : (
                <CodeEditor file={activeFile} allFiles={files} />
              )}
            </div>

            {/* Preview (slide-over when not split) */}
            {!previewOpen && <PreviewPanel open={false} onClose={() => {}} files={files} activeFile={activeFile} />}
          </div>

          {/* Activity / Terminal */}
          <div className="border-t flex-shrink-0" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}>
            <button onClick={() => setTerminalOpen(v => !v)} className="w-full flex items-center gap-2 px-4 h-8 text-[11px] font-medium" style={{ borderBottom: "1px solid var(--border-faint)", color: "var(--text-muted)" }}>
              <TerminalIcon className="w-3 h-3" />
              Activity
              <span className="ml-auto">{terminalOpen ? "▼" : "▶"}</span>
              {canContinue && !busy && (
                <button onClick={onContinue} className="flex items-center gap-1 px-2 h-6 rounded-full text-[10px] font-medium" style={{ background: "var(--text-primary)", color: "var(--bg-base)" }}>
                  <ArrowUp className="w-2.5 h-2.5" /> Continue
                </button>
              )}
              {busy && <Loader2 className="w-3 h-3 animate-spin ml-2" />}
            </button>
            {terminalOpen && (
              <div className="max-h-32 overflow-auto px-4 py-2">
                {logs.slice(-15).map(l => <ActivityEntry key={l.id} line={l} onConfirm={confirmAction} onDismiss={dismissAction} />)}
              </div>
            )}
          </div>

          {/* Prompt Bar */}
          <div className="border-t px-4 py-3 flex-shrink-0" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}>
            <div className="max-w-3xl mx-auto">
              {canContinue && !busy && (
                <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5" style={{ borderColor: "rgba(245,158,11,0.3)", background: "var(--amber-tint)" }}>
                  <span className="text-xs" style={{ color: "var(--amber)" }}>Output was cut off. Continue from the exact stop point.</span>
                  <button onClick={onContinue} className="flex items-center gap-1.5 px-3 h-8 rounded-full text-[12px] font-semibold" style={{ background: "var(--amber)", color: "var(--bg-base)" }}>
                    <ArrowUp className="w-3.5 h-3.5" /> Continue
                  </button>
                </div>
              )}

              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {attachments.map(a => (
                    <div key={a.id} className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg border text-[12px]" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
                      {a.kind === "image" ? <ImageIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                      <span className="truncate max-w-[160px]">{a.name}</span>
                      <button onClick={() => setAttachments(prev => prev.filter(x => x.id !== a.id))} className="p-0.5 rounded" style={{ color: "var(--text-muted)" }}><X className="w-2.5 h-2.5" /></button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2 rounded-2xl border px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.1)", background: "var(--bg-elevated)" }}>
                <input ref={fileInputRef} type="file" multiple accept={DOCUMENT_ACCEPT} hidden onChange={e => handleFiles(e.target.files)} />
                <button onClick={onPickFiles} disabled={busy} className="w-8 h-8 grid place-items-center rounded-lg transition disabled:opacity-30" style={{ color: "var(--text-muted)" }} title="Attach files">
                  <Paperclip className="w-4 h-4" />
                </button>
                <textarea
                  ref={taRef}
                  value={prompt}
                  onChange={e => { setPrompt(e.target.value); autoResize(e.currentTarget); }}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit(); } }}
                  rows={1}
                  placeholder={busy ? "Lumina is building..." : "Ask Lumina to build something..."}
                  disabled={busy}
                  className="flex-1 bg-transparent resize-none outline-none text-[14px] placeholder:text-white/35 py-1.5 leading-relaxed max-h-[200px]"
                  style={{ color: "var(--text-primary)" }}
                />
                <button
                  onClick={onSubmit}
                  disabled={busy || !prompt.trim()}
                  className="w-8 h-8 grid place-items-center rounded-lg transition disabled:opacity-30"
                  style={{ background: "var(--text-primary)", color: "var(--bg-base)", opacity: busy || !prompt.trim() ? 0.3 : 1 }}
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
                </button>
              </div>
              <div className="text-[10px] text-center mt-2" style={{ color: "var(--text-muted)" }}>
                Model: {model || "owl-alpha"} | {files.length} file(s)
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Preview Slide-over */}
      <PreviewPanel open={previewOpen} onClose={() => setPreviewOpen(false)} files={files} activeFile={activeFile} />
    </div>
  );
}

/**
 * Lumina Computer — Ultimate AI Coding Environment
 * 
 * Features:
 * - Effort picker: Quick / Normal / Beast
 * - OpenRouter free models (auto-fallback chain)
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
import { LuminaModePicker, type LuminaMode } from "@/features/chat/components/LuminaModePicker";
import { LuminaModeIndicator } from "@/features/chat/components/LuminaModeIndicator";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

function getLuminaSystemPrompt(mode: LuminaMode): string {
  const base = `You are Lumina, an expert AI assistant. Output content using FILE: format.

FILE: path.ext
content
END FILE

Use STATUS: msg for progress. Output multiple files in one response.`;

  const prompts: Record<LuminaMode, string> = {
    research: `${base}
MODE: Deep Research — produce research-report.md, executive-summary.md, references.md. STATUS: planning→searching→collecting→synthesizing→verifying.`,
    doc: `${base}
MODE: Document — produce document.md + document.html. STATUS: outlining→writing→verifying.`,
    sheet: `${base}
MODE: Sheets — produce data.csv + schema.json + summary.csv. STATUS: designing→building→formulas→verifying.`,
    slide: `${base}
MODE: Slides — produce slides.md (--- separators for Google Slides) + slides.json. STATUS: outlining→writing→verifying.`,
    website: `${base}
MODE: Website — produce index.html + style.css + script.js. STATUS: mapping→generating→verifying.`,
  };
  return prompts[mode];
}

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
  const highlighted = useMemo(() => file ? highlightCode(file.content, file.lang) : '', [file?.content, file?.lang]);

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

// ── Slide Parser ──
interface SlideData { title: string; content: string; notes: string; }

function parseSlidesFromMd(md: string): SlideData[] {
  const slides: SlideData[] = [];
  const parts = md.split(/\n---\n/);
  for (const part of parts) {
    const lines = part.trim().split("\n");
    let title = "";
    let content = "";
    let notes = "";
    let inContent = false;
    for (const line of lines) {
      if (line.startsWith("# ")) { title = line.slice(2).trim(); inContent = true; }
      else if (line.toLowerCase().startsWith("notes:")) { notes = line.slice(6).trim(); }
      else if (inContent) { content += line + "\n"; }
    }
    if (title || content.trim()) {
      slides.push({ title: title || "Slide", content: content.trim(), notes });
    }
  }
  return slides.length > 0 ? slides : [{ title: "Slide", content: md.trim(), notes: "" }];
}

function generateHtmlPresentation(slides: SlideData[]): string {
  const slidesHtml = slides.map((s, i) => `
    <div class="slide${i === 0 ? ' active' : ''}">
      <div class="slide-inner">
        <div class="slide-number">${i + 1} / ${slides.length}</div>
        <h1>${s.title}</h1>
        <div class="slide-content">${s.content.replace(/\n/g, '<br>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')}</div>
        ${s.notes ? `<div class="slide-notes">${s.notes}</div>` : ''}
      </div>
    </div>`).join("");

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lumina Presentation</title><style>
*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0a12;font-family:-apple-system,BlinkMacSystemFont,Inter,system-ui,sans-serif;overflow:hidden;height:100vh;display:flex;align-items:center;justify-content:center}
.slide{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .4s ease;pointer-events:none;padding:40px}
.slide.active{opacity:1;pointer-events:auto}
.slide-inner{max-width:960px;width:100%;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);border-radius:24px;padding:60px;box-shadow:0 20px 60px rgba(0,0,0,.5);position:relative;min-height:500px;display:flex;flex-direction:column;justify-content:center;border:1px solid rgba(255,255,255,.06)}
.slide-number{position:absolute;top:20px;right:24px;font-size:12px;color:rgba(255,255,255,.3);font-weight:500;letter-spacing:.05em}
h1{font-size:36px;font-weight:700;color:#fff;margin-bottom:24px;line-height:1.2}
.slide-content{font-size:18px;line-height:1.7;color:rgba(255,255,255,.8)}
.slide-content strong{color:#fff}
.slide-notes{margin-top:24px;padding:12px 16px;background:rgba(255,255,255,.05);border-radius:10px;font-size:13px;color:rgba(255,255,255,.4);border-left:2px solid rgba(255,255,255,.1)}
nav{position:fixed;bottom:40px;left:50%;transform:translateX(-50%);display:flex;gap:12px;align-items:center;z-index:100}
nav button{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);color:#fff;width:44px;height:44px;border-radius:50%;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;transition:all .2s}
nav button:hover{background:rgba(255,255,255,.15)}.dots{display:flex;gap:6px;margin:0 12px}
.dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.15);transition:all .2s}
.dot.active{background:#7C5CFC;box-shadow:0 0 8px rgba(124,92,252,.5)}.dot:hover{background:rgba(255,255,255,.3)}
@media print{.slide{opacity:1!important;position:relative!important;page-break-after:always;height:100vh}nav{display:none!important}}
</style></head><body>
${slidesHtml}
<nav><button onclick="prevSlide()">←</button><div class="dots">${slides.map((_,i)=>`<div class="dot${i===0?' active':''}" onclick="goSlide(${i})"></div>`).join("")}</div><button onclick="nextSlide()">→</button></nav>
<script>let i=0;const s=document.querySelectorAll('.slide'),d=document.querySelectorAll('.dot');function show(n){s.forEach((e,j)=>{e.classList.toggle('active',j===n);d[j]?.classList.toggle('active',j===n)});i=n}
function nextSlide(){show(Math.min(i+1,s.length-1))}function prevSlide(){show(Math.max(i-1,0))}function goSlide(n){show(n)}
document.addEventListener('keydown',e=>{e.key==='ArrowRight'&&nextSlide();e.key==='ArrowLeft'&&prevSlide()})</script>
</body></html>`;
}

// ── Preview Panel ──
function PreviewPanel({ open, onClose, files, activeFile }: { open: boolean; onClose: () => void; files: LuminaFile[]; activeFile: LuminaFile | null }) {
  const [fullscreen, setFullscreen] = useState(false);
  const [slideView, setSlideView] = useState(false);
  const slideFile = useMemo(() => files.find(f => f.path === "slides.md"), [files]);
  const slides = useMemo(() => slideFile ? parseSlidesFromMd(slideFile.content) : [], [slideFile]);
  const previewTarget = useMemo(() => {
    if (slideView && slides.length > 0) return null;
    if (activeFile && activeFile.lang === "html") return activeFile;
    return files.find(f => f.lang === "html") ?? activeFile;
  }, [files, activeFile, slideView, slides]);
  const doc = useMemo(() => previewTarget ? buildPreviewDoc(previewTarget, files) : "", [previewTarget, files]);
  const pptDoc = useMemo(() => slides.length > 0 ? generateHtmlPresentation(slides) : "", [slides]);

  if (!open) return null;

  const wrapCls = fullscreen
    ? "fixed inset-0 z-[200] flex flex-col"
    : "fixed top-0 right-0 bottom-0 z-[100] w-[min(720px,60vw)] border-l flex flex-col shadow-[-30px_0_60px_-30px_rgba(0,0,0,0.7)]";

  return (
    <div className={wrapCls} style={{ background: "var(--bg-base)", borderColor: "var(--border-default)" }}>
      <div className="flex items-center gap-2 px-4 h-10 border-b flex-shrink-0" style={{ borderColor: "var(--border-subtle)" }}>
        <Eye className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
        <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Preview</span>
        {slides.length > 0 && (
          <button onClick={() => setSlideView(v => !v)} className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all" style={{ background: slideView ? "var(--text-primary)" : "transparent", color: slideView ? "var(--bg-base)" : "var(--text-muted)", border: "1px solid", borderColor: slideView ? "var(--text-primary)" : "var(--border-subtle)" }}>
            Slides
          </button>
        )}
        <div className="ml-auto flex items-center gap-1">
          {slides.length > 0 && (
            <button onClick={() => { const b = new Blob([pptDoc], { type: "text/html" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "presentation.html"; a.click(); URL.revokeObjectURL(a.href); }} className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all" style={{ background: "var(--text-primary)", color: "var(--bg-base)" }} title="Download HTML presentation">
              <Download className="w-3 h-3" /> Export
            </button>
          )}
          <button onClick={() => setFullscreen(!fullscreen)} className="p-1.5 rounded transition" style={{ color: "var(--text-muted)" }} title="Fullscreen">
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button onClick={onClose} className="p-1.5 rounded transition" style={{ color: "var(--text-muted)" }} title="Close">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="flex-1 relative overflow-hidden" style={{ minHeight: 400 }}>
        {slideView && slides.length > 0 ? (
          <iframe title="Lumina Slides" srcDoc={pptDoc} className="w-full h-full border-0" style={{ background: "#0a0a12" }} />
        ) : previewTarget ? (
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
  const [luminaMode, setLuminaMode] = useState<LuminaMode | null>(null);
  const [luminaRunning, setLuminaRunning] = useState(false);
  const [luminaStatus, setLuminaStatus] = useState("");
  const [liveContent, setLiveContent] = useState("");

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

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.key === "k") { e.preventDefault(); taRef.current?.focus(); }
      if (isMeta && e.key === "Enter" && !busy && prompt.trim()) { e.preventDefault(); onSubmit(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, prompt]);

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
    setLuminaMode(null); setLuminaRunning(false); setLuminaStatus(""); setLiveContent("");
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
    setLiveContent("");
    if (luminaMode) { setLuminaRunning(true); setLuminaStatus("Starting…"); }

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

      const sysPrompt = luminaMode ? getLuminaSystemPrompt(luminaMode) : null;
      let messages: any[];
      if (isCont) {
        // Pass full assistant context so model knows exactly what was written so far.
        // Truncate to last 16000 chars to stay within context window.
        const assistantContext = rawAssistantRef.current.slice(-16000);
        messages = [
          ...(sysPrompt ? [{ role: "system", content: sysPrompt }] : []),
          { role: "user", content: lastUserPromptRef.current },
          { role: "assistant", content: assistantContext },
          { role: "user", content: "CONTINUE EXACTLY from where you left off. Do NOT repeat anything already written. Do NOT restart. Do NOT add commentary. Output ONLY the remaining content so the document is complete and properly closed." },
        ];
      } else {
        const content = buildMessageContent(trimmed);
        setAttachments([]);
        const history = turnsRef.current.slice(-12);
        messages = [...(sysPrompt ? [{ role: "system", content: sysPrompt }] : []), ...history, { role: "user", content }];
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
        const body: Record<string, any> = { messages: payload, mode: "computer", effort };
        if (luminaMode) {
          body.lumina_mode = luminaMode;
          sessionIdRef.current = sessionIdRef.current || `${session.user.id}_${Date.now()}`;
          body.session_id = sessionIdRef.current;
        }
        const res = await fetch(CHAT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify(body),
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
              if (parsed?.lumina_meta?.model) { log("model", `Model: ${parsed.lumina_meta.model}`); }
              const delta = parsed?.choices?.[0]?.delta?.content;
              if (typeof delta === "string" && delta.length > 0) {
                if (luminaMode) {
                  const trimmed = delta.trim();
                  const statusMatch = trimmed.match(/^_(.+?)_$/);
                  if (statusMatch && statusMatch[1].length < 200) {
                    setLuminaStatus(statusMatch[1]);
                    continue;
                  }
                }
                rawAssistantRef.current += delta;
                setLiveContent(rawAssistantRef.current.slice(-2000));
                parserRef.current!.push(delta);
                applyState();
              }
              // Log finish_reason when model stops
              const finishReason = parsed?.choices?.[0]?.finish_reason;
              if (finishReason && finishReason !== 'stop') {
                log('system', `Model stopped: ${finishReason}`);
              }
            } catch { sseBuf = line + "\n" + sseBuf; break; }
          }
        }
      };

      await streamMessages(messages);
      applyState();

      // Detect truncation (server now auto-continues up to 4 passes, so this is rare)
      let st = parserRef.current!.state;
      const displayFiles = st.files.filter(f => f.path !== "response.md");
      const openFile = st.files.some(f => !f.done);
      const tail = rawAssistantRef.current.trimEnd().slice(-120);
      const cleanEnd = /END FILE\s*$/.test(tail) || /<\/html>\s*$/i.test(tail) || /<\/(lumina:)?(final|file|plan)>\s*$/.test(tail) || /```\s*$/.test(tail);
      const noFilesShipped = displayFiles.length === 0;
      const enoughOutput = rawAssistantRef.current.length > 40;
      const looksTruncated = enoughOutput && (openFile || noFilesShipped || !cleanEnd);

      if (looksTruncated) {
        setCanContinue(true);
        log("warn", `Output looks incomplete (${rawAssistantRef.current.length} chars) — press Continue to resume.`);
        if (displayFiles.length > 0) {
          log("system", `Saved ${displayFiles.length} file(s) from partial output.`);
        }
      } else {
        // Validate
        parserRef.current!.finish();
        applyState();
        st = parserRef.current!.state;
        const issues = validateLuminaProject(st.files, lastUserPromptRef.current);
        setValidationSummary(summarizeValidation(issues));
        log("done", `Done - ${displayFiles.length} file(s). ${summarizeValidation(issues)}`);

        // Auto-repair: if there are blocking errors and at least one file was produced, ask model to fix
        const errors = issues.filter(i => i.severity === "error");
        if (errors.length > 0 && displayFiles.length > 0 && !isCont && rawAssistantRef.current.length > 200) {
          log("system", `Auto-repairing ${errors.length} validation error(s)...`);
          const repairPrompt = buildRepairPrompt(lastUserPromptRef.current, st.files, issues);
          try {
            const repairMessages = [
              { role: "user", content: lastUserPromptRef.current },
              { role: "assistant", content: rawAssistantRef.current.slice(-12000) },
              { role: "user", content: repairPrompt + "\n\nFix ALL issues listed above. Return COMPLETE corrected files using the FILE: format. Do NOT truncate." },
            ];
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error("Please sign in.");
            const repairRes = await fetch(CHAT_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({ messages: repairMessages, mode: "computer", effort }),
              signal: ctrl.signal,
            });
            if (repairRes.ok && repairRes.body) {
              const repairReader = repairRes.body.getReader();
              const repairDecoder = new TextDecoder();
              let repairBuf = "";
              while (true) {
                const { done, value } = await repairReader.read();
                if (done) break;
                repairBuf += repairDecoder.decode(value, { stream: true });
                let nl: number;
                while ((nl = repairBuf.indexOf("\n")) !== -1) {
                  const rLine = repairBuf.slice(0, nl);
                  repairBuf = repairBuf.slice(nl + 1);
                  if (!rLine.startsWith("data: ")) continue;
                  const rJson = rLine.slice(6).trim();
                  if (!rJson || rJson === "[DONE]") continue;
                  try {
                    const rParsed = JSON.parse(rJson);
                    const rDelta = rParsed?.choices?.[0]?.delta?.content;
                    if (typeof rDelta === "string" && rDelta.length > 0) {
                      rawAssistantRef.current += rDelta;
                      parserRef.current!.push(rDelta);
                      applyState();
                    }
                  } catch { repairBuf = rLine + "\n" + repairBuf; break; }
                }
              }
              parserRef.current!.finish();
              applyState();
              const repairedIssues = validateLuminaProject(parserRef.current!.state.files, lastUserPromptRef.current);
              setValidationSummary(summarizeValidation(repairedIssues));
              log("done", `Repair complete — ${summarizeValidation(repairedIssues)}`);
            }
          } catch (e: any) {
            log("warn", `Auto-repair failed: ${e?.message ?? "unknown"}`);
          }
        }
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
    } finally { setBusy(false); setFactoryActive(null); setLuminaRunning(false); setLuminaStatus(""); abortRef.current = null; }
  }, [busy, log, attachments, setFactoryStage, luminaMode]);

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

        {luminaMode && (
          <LuminaModeIndicator
            mode={luminaMode}
            onClear={() => { setLuminaMode(null); setLuminaRunning(false); setLuminaStatus(""); }}
            isRunning={luminaRunning}
            statusMessage={luminaStatus}
          />
        )}

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
                <div className="flex-1 flex flex-col items-center justify-center overflow-auto py-8">
                  <LuminaModePicker
                    selected={luminaMode}
                    onSelect={(m) => setLuminaMode(m)}
                    onSend={(mode) => {
                      setLuminaMode(mode);
                      taRef.current?.focus();
                    }}
                    active={luminaRunning}
                  />
                </div>
              ) : busy && files.length === 0 && !plan && !finalMd ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-auto" style={{ background: "var(--bg-base)" }}>
                  {luminaMode && (() => {
                    const meta = ({ research: { label: "Deep Research", color: "#8B5CF6" }, doc: { label: "Documents", color: "#3B82F6" }, sheet: { label: "Sheets", color: "#10B981" }, slide: { label: "Slides", color: "#EC4899" }, website: { label: "Websites", color: "#06B6D4" } } as const)[luminaMode];
                    return (
                      <>
                        <div className="flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full" style={{ background: `${meta.color}14`, border: `1px solid ${meta.color}33` }}>
                          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}` }} />
                          <span className="text-[12px] font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                          {luminaStatus && <span className="text-[11px] ml-1" style={{ color: "var(--text-muted)" }}>— {luminaStatus}</span>}
                        </div>
                        {liveContent && (
                          <pre className="text-[11px] leading-relaxed max-w-[640px] w-full whitespace-pre-wrap font-mono" style={{ color: "var(--text-secondary)", maxHeight: 360, overflow: "auto" }}>
                            {liveContent.slice(-1500)}
                          </pre>
                        )}
                        {!liveContent && (
                          <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--text-muted)" }}>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Thinking...
                          </div>
                        )}
                      </>
                    );
                  })()}
                  {!luminaMode && (
                    <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--text-muted)" }}>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </div>
                  )}
                </div>
              ) : finalMd && !activeFile && !files.length ? (
                <div className="flex-1 overflow-auto px-6 py-5" style={{ background: "var(--bg-surface)" }}>
                  <MarkdownRenderer>{finalMd}</MarkdownRenderer>
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
              <div className="flex items-center justify-center gap-2 text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>
                <span>Effort: {effort}</span>
                <span>|</span>
                <span>{files.length} file(s)</span>
                {validationSummary && (
                  <>
                    <span>|</span>
                    <span style={{ color: validationSummary.includes("error") ? "var(--red)" : "var(--green)" }}>
                      {validationSummary}
                    </span>
                  </>
                )}
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

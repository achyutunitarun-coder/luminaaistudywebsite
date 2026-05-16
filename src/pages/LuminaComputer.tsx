/**
 * Lumina Computer — premium Claude-style research & artifact engine.
 *
 * Reuses the /chat edge function (mode: "computer") but renders responses
 * with a dedicated UI: any substantial inline HTML is auto-rendered in a
 * sandboxed iframe (so onclick / scripts work), otherwise falls back to
 * Markdown. World-class typography, ambient glow, glass surfaces.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Send,
  Paperclip,
  Search,
  Sparkles,
  Globe,
  FileText,
  FlaskConical,
  Cpu,
  ArrowDown,
  Copy as CopyIcon,
  Check,
  Maximize2,
  Code2,
  Eye,
  X,
  Loader2,
  StopCircle,
  Plus,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { toast } from 'sonner';

type Role = 'user' | 'assistant';
interface Msg {
  id: string;
  role: Role;
  content: string;
  model?: string;
  streaming?: boolean;
  ts: number;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const THINKING_STEPS = [
  'Routing to best model...',
  'Searching DuckDuckGo + Wikipedia + arXiv...',
  'Synthesising sources...',
  'Drafting structured response...',
  'Polishing artifact...',
];

const CAPABILITIES = [
  {
    icon: FileText,
    title: 'HTML Study Guides',
    desc: 'Interactive notes with formulas, MCQs and dark-mode',
    prompt: 'Generate a complete interactive HTML study guide on photosynthesis for Class 10 CBSE — include diagrams, MCQs and a quick-recall section.',
    accent: 'from-blue-500/15 to-blue-500/0',
    iconColor: 'text-blue-300',
  },
  {
    icon: FlaskConical,
    title: 'Deep Research',
    desc: 'Multi-source reports with citations and analysis',
    prompt: 'Deep research report: Climate change and its impact on Indian monsoons. Include sources, data, and key takeaways.',
    accent: 'from-emerald-500/15 to-emerald-500/0',
    iconColor: 'text-emerald-300',
  },
  {
    icon: Globe,
    title: 'MUN Mode',
    desc: 'Background guides, position papers, draft resolutions',
    prompt: 'MUN background guide — Topic: Nuclear Disarmament, Committee: DISEC. Include bloc analysis and QARMA.',
    accent: 'from-amber-500/15 to-amber-500/0',
    iconColor: 'text-amber-300',
  },
  {
    icon: Cpu,
    title: 'Code & Artifacts',
    desc: 'Runnable HTML, calculators, simulators, dashboards',
    prompt: 'Build me a complete interactive HTML page that visualises Newton\'s three laws with controllable sliders and live physics.',
    accent: 'from-fuchsia-500/15 to-fuchsia-500/0',
    iconColor: 'text-fuchsia-300',
  },
];

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Detect if a markdown blob contains a substantial HTML artifact
 * (full document or large block). If yes, return the raw HTML string.
 */
function extractArtifact(content: string): string | null {
  if (!content) return null;
  // Fenced ```html ... ``` block — biggest one wins
  const fenceRe = /```(?:html|HTML)\s*\n([\s\S]*?)```/g;
  let best: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(content)) !== null) {
    if (!best || m[1].length > best.length) best = m[1];
  }
  if (best && best.length > 400) return best.trim();

  // Bare <!doctype html>...
  const docMatch = content.match(/<!doctype html[\s\S]*<\/html>/i);
  if (docMatch && docMatch[0].length > 400) return docMatch[0];

  // Large inline HTML chunk (has style/script/multiple tags)
  if (
    content.length > 800 &&
    /<(html|body|style|script|section|article|main)\b/i.test(content) &&
    /<\/(html|body|div|section|article|main)>/i.test(content)
  ) {
    return content;
  }
  return null;
}

function buildArtifactDoc(html: string): string {
  if (/<!doctype html/i.test(html)) return html;
  if (/<html[\s>]/i.test(html)) return `<!doctype html>${html}`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    body{margin:0;padding:24px;font:15px/1.65 -apple-system,'Inter',sans-serif;background:#0a0a0f;color:#e8e6ff}
    a{color:#a78bfa}h1,h2,h3{color:#fff;margin:1.2em 0 .4em}
    code,pre{font-family:'Geist Mono',ui-monospace,monospace;background:rgba(255,255,255,0.05);border-radius:6px}
    pre{padding:14px;overflow:auto;border:1px solid rgba(255,255,255,0.08)}
  </style></head><body>${html}</body></html>`;
}

function ArtifactFrame({ html, onClose }: { html: string; onClose?: () => void }) {
  const [view, setView] = useState<'preview' | 'code'>('preview');
  const [copied, setCopied] = useState(false);
  const [full, setFull] = useState(false);
  const doc = buildArtifactDoc(html);

  const copy = () => {
    navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    const blob = new Blob([doc], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lumina-artifact-${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const containerCls = full
    ? 'fixed inset-0 z-[120] bg-[#05050b]'
    : 'mt-3 rounded-2xl border border-white/10 bg-[#0a0a14] overflow-hidden shadow-[0_20px_60px_-20px_rgba(124,111,255,0.35)]';

  return (
    <div className={containerCls}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/8 bg-gradient-to-b from-white/[0.04] to-transparent">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        </div>
        <span className="ml-2 text-[11px] font-mono text-white/40 tracking-wide">
          lumina-artifact.html
        </span>
        <div className="ml-auto flex items-center gap-1">
          <div className="flex bg-white/[0.04] rounded-lg p-0.5 border border-white/8">
            <button
              onClick={() => setView('preview')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                view === 'preview' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'
              }`}
            >
              <Eye className="w-3 h-3" /> Preview
            </button>
            <button
              onClick={() => setView('code')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                view === 'code' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'
              }`}
            >
              <Code2 className="w-3 h-3" /> Code
            </button>
          </div>
          <button
            onClick={copy}
            className="p-1.5 rounded-md text-white/50 hover:text-white hover:bg-white/8 transition"
            title="Copy code"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <CopyIcon className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={download}
            className="px-2.5 py-1 rounded-md text-[11px] font-medium text-white/60 hover:text-white hover:bg-white/8 transition"
          >
            Download
          </button>
          <button
            onClick={() => setFull((f) => !f)}
            className="p-1.5 rounded-md text-white/50 hover:text-white hover:bg-white/8 transition"
            title="Fullscreen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          {full && onClose && (
            <button
              onClick={() => setFull(false)}
              className="p-1.5 rounded-md text-white/50 hover:text-white hover:bg-white/8"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      {view === 'preview' ? (
        <iframe
          title="Lumina Artifact"
          srcDoc={doc}
          sandbox="allow-scripts allow-forms allow-popups allow-modals allow-pointer-lock"
          className={`w-full bg-white ${full ? 'h-[calc(100vh-44px)]' : 'h-[560px]'}`}
        />
      ) : (
        <pre className={`text-[12px] font-mono text-white/80 p-4 overflow-auto bg-[#05050b] ${full ? 'h-[calc(100vh-44px)]' : 'h-[560px]'}`}>
          <code>{html}</code>
        </pre>
      )}
    </div>
  );
}

function ChatBubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === 'user';
  const artifact = !isUser ? extractArtifact(msg.content) : null;
  // strip extracted artifact from prose so we don't double-render
  const prose = artifact
    ? msg.content
        .replace(/```(?:html|HTML)\s*\n[\s\S]*?```/g, '')
        .replace(/<!doctype html[\s\S]*<\/html>/i, '')
        .trim()
    : msg.content;

  return (
    <div className={`flex gap-4 max-w-[820px] mx-auto w-full ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0 ${
          isUser
            ? 'bg-white/8 text-white border border-white/10'
            : 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_0_18px_rgba(167,139,250,0.4)]'
        }`}
      >
        {isUser ? 'You' : 'L'}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`flex items-center gap-2 mb-1.5 text-[11px] text-white/35 ${isUser ? 'justify-end' : ''}`}>
          <span className="font-semibold text-white/60">
            {isUser ? 'You' : 'Lumina Computer'}
          </span>
          {msg.model && (
            <span className="font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/15 text-[10px]">
              {msg.model}
            </span>
          )}
          {msg.streaming && (
            <span className="inline-flex items-center gap-1 text-violet-300">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              streaming
            </span>
          )}
        </div>
        {isUser ? (
          <div className="inline-block max-w-full px-5 py-3 rounded-2xl rounded-br-md bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white text-[14px] leading-relaxed shadow-[0_8px_30px_-8px_rgba(167,139,250,0.5)]">
            {msg.content}
          </div>
        ) : (
          <div className="rounded-2xl rounded-tl-md bg-[#0e0e18] border border-white/8 px-6 py-5 text-[14px] leading-relaxed text-white/90">
            {prose && <MarkdownRenderer>{prose}</MarkdownRenderer>}
            {artifact && <ArtifactFrame html={artifact} />}
            {!prose && !artifact && msg.streaming && (
              <span className="text-white/40 italic">Generating...</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LuminaComputer() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [thinkStep, setThinkStep] = useState(0);
  const [model, setModel] = useState('routing...');
  const [showScroll, setShowScroll] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // thinking text rotation
  useEffect(() => {
    if (!busy) return;
    const i = setInterval(() => setThinkStep((s) => (s + 1) % THINKING_STEPS.length), 1100);
    return () => clearInterval(i);
  }, [busy]);

  // scroll handling
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScroll(dist > 200);
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // auto scroll on new content
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (dist < 300) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;

      const userMsg: Msg = { id: uid(), role: 'user', content: trimmed, ts: Date.now() };
      const aId = uid();
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: aId, role: 'assistant', content: '', streaming: true, ts: Date.now() },
      ]);
      setInput('');
      if (taRef.current) taRef.current.style.height = 'auto';
      setBusy(true);
      setThinkStep(0);
      setModel('routing...');

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const auth = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        const aiMessages = [...messages, userMsg]
          .filter((m) => m.role !== 'assistant' || m.content.length > 0)
          .slice(-20)
          .map((m) => ({ role: m.role, content: m.content }));

        const res = await fetch(CHAT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` },
          body: JSON.stringify({ messages: aiMessages, mode: 'computer' }),
          signal: ctrl.signal,
        });

        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        let acc = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf('\n')) !== -1) {
            let line = buf.slice(0, nl);
            buf = buf.slice(nl + 1);
            if (line.endsWith('\r')) line = line.slice(0, -1);
            if (!line.startsWith('data: ')) continue;
            const json = line.slice(6).trim();
            if (json === '[DONE]') continue;
            try {
              const parsed = JSON.parse(json);
              if (parsed?.lumina_meta?.model) setModel(parsed.lumina_meta.model);
              const delta = parsed?.choices?.[0]?.delta?.content;
              if (typeof delta === 'string' && delta.length) {
                acc += delta;
                setMessages((prev) =>
                  prev.map((m) => (m.id === aId ? { ...m, content: acc, model } : m)),
                );
              }
            } catch {
              buf = line + '\n' + buf;
              break;
            }
          }
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === aId
              ? { ...m, content: acc || '_(no response)_', streaming: false, model }
              : m,
          ),
        );
      } catch (e: any) {
        if (e?.name === 'AbortError') {
          setMessages((prev) =>
            prev.map((m) => (m.id === aId ? { ...m, streaming: false, content: m.content || '_(stopped)_' } : m)),
          );
        } else {
          toast.error(e?.message || 'Request failed');
          setMessages((prev) => prev.filter((m) => m.id !== aId));
        }
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, messages, model],
  );

  const stop = () => {
    abortRef.current?.abort();
  };

  const newThread = () => {
    if (busy) abortRef.current?.abort();
    setMessages([]);
    setInput('');
  };

  return (
    <div className="relative h-[calc(100vh-0px)] flex flex-col bg-[#07070d] text-white/90 overflow-hidden">
      {/* ambient glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-[radial-gradient(ellipse_at_center,rgba(124,111,255,0.18),transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 w-[500px] h-[400px] bg-[radial-gradient(ellipse_at_center,rgba(236,72,153,0.10),transparent_70%)]" />

      {/* Topbar */}
      <header className="relative z-10 flex items-center gap-3 px-6 py-3 border-b border-white/8 bg-[#0a0a14]/80 backdrop-blur-xl flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-[0_0_16px_rgba(124,111,255,0.4)]">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="leading-tight">
            <div className="font-serif italic text-[17px] text-white">Lumina</div>
            <div className="text-[9px] tracking-[0.18em] font-semibold bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
              COMPUTER
            </div>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 ml-4 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/8 text-[11px] text-white/60">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
          <span className="font-mono truncate max-w-[260px]">{model}</span>
        </div>
        <div className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-[10px] font-semibold tracking-wider text-violet-300 uppercase">
          <span className="w-1 h-1 rounded-full bg-violet-400" /> Live web · 100k tokens
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={newThread}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white/70 hover:text-white border border-white/8 hover:border-white/16 hover:bg-white/[0.04] transition"
          >
            <Plus className="w-3.5 h-3.5" /> New thread
          </button>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto px-4 sm:px-8 py-8 space-y-6">
        {messages.length === 0 ? (
          <div className="max-w-[680px] mx-auto pt-10 pb-6 animate-[fadeIn_0.6s_ease-out]">
            <h1 className="font-serif italic text-[2.4rem] sm:text-[3rem] leading-[1.05] tracking-tight bg-gradient-to-br from-white via-white to-violet-300 bg-clip-text text-transparent">
              What do you want to<br />research today?
            </h1>
            <p className="mt-4 text-[14px] text-white/55 leading-relaxed max-w-[55ch]">
              Lumina Computer pulls live sources, generates full HTML artifacts, deep reports, MUN documents,
              charts and runnable code — backed by 25+ free models.
            </p>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CAPABILITIES.map((c) => {
                const Icon = c.icon;
                return (
                  <button
                    key={c.title}
                    onClick={() => send(c.prompt)}
                    className="group text-left p-4 rounded-xl bg-[#0d0d18] border border-white/8 hover:border-white/16 hover:bg-[#10101c] transition-all relative overflow-hidden"
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${c.accent} opacity-0 group-hover:opacity-100 transition-opacity`} />
                    <div className="relative">
                      <div className={`w-9 h-9 rounded-lg bg-white/[0.04] border border-white/8 flex items-center justify-center mb-3 ${c.iconColor}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="text-[14px] font-semibold text-white mb-1">{c.title}</div>
                      <div className="text-[12px] text-white/50 leading-relaxed">{c.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          messages.map((m) => <ChatBubble key={m.id} msg={m} />)
        )}

        {busy && (
          <div className="max-w-[820px] mx-auto flex gap-4">
            <div className="w-8 h-8" />
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#0e0e18] border border-white/8 text-[12px] text-white/55">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse [animation-delay:.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse [animation-delay:.4s]" />
              </div>
              {THINKING_STEPS[thinkStep]}
            </div>
          </div>
        )}
      </div>

      {showScroll && (
        <button
          onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })}
          className="absolute bottom-[180px] right-8 z-20 w-9 h-9 rounded-full bg-[#0e0e18] border border-white/12 text-white/70 hover:text-white hover:border-white/24 flex items-center justify-center shadow-lg transition"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}

      {/* Input */}
      <div className="relative z-10 px-4 sm:px-8 pb-6 pt-3 flex-shrink-0">
        <div className="max-w-[820px] mx-auto rounded-2xl bg-[#0d0d18]/95 border border-white/10 backdrop-blur-xl shadow-[0_-10px_40px_-20px_rgba(124,111,255,0.4)] focus-within:border-violet-400/40 focus-within:shadow-[0_-10px_50px_-20px_rgba(124,111,255,0.6)] transition">
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              autoResize(e.target);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask anything · request a report · paste a topic..."
            rows={1}
            className="w-full bg-transparent border-none outline-none resize-none px-5 pt-4 pb-2 text-[14px] text-white placeholder:text-white/30 leading-relaxed min-h-[52px] max-h-[200px]"
          />
          <div className="flex items-center gap-2 px-3 pb-3 pt-1 border-t border-white/[0.06]">
            <button className="w-8 h-8 rounded-lg border border-white/8 text-white/50 hover:text-white hover:border-white/16 hover:bg-white/[0.04] flex items-center justify-center transition" title="Attach file">
              <Paperclip className="w-3.5 h-3.5" />
            </button>
            <button className="w-8 h-8 rounded-lg border border-violet-400/30 text-violet-300 hover:bg-violet-500/10 flex items-center justify-center transition" title="Web search enabled">
              <Search className="w-3.5 h-3.5" />
            </button>
            <div className="hidden sm:flex items-center gap-1 ml-1 px-2 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-[10px] font-semibold tracking-wider text-violet-300 uppercase">
              <Cpu className="w-3 h-3" /> Computer
            </div>
            <span className="ml-auto text-[10px] font-mono text-white/30 hidden sm:inline">
              ⏎ to send · ⇧⏎ for newline
            </span>
            {busy ? (
              <button
                onClick={stop}
                className="w-9 h-9 rounded-lg bg-white/8 hover:bg-white/12 text-white flex items-center justify-center transition"
                title="Stop"
              >
                <StopCircle className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => send(input)}
                disabled={!input.trim()}
                className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white flex items-center justify-center shadow-[0_0_16px_rgba(124,111,255,0.5)] hover:scale-105 transition disabled:opacity-40 disabled:hover:scale-100"
                title="Send"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <p className="text-center text-[11px] text-white/30 mt-3">
          Powered by <span className="text-violet-300 font-medium">OpenRouter · 25+ free models</span> · live web research · streaming
        </p>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  );
}

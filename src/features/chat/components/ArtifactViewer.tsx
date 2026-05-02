import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  ExternalLink,
  RefreshCcw,
  FileText,
  Code2,
  Presentation,
  ScrollText,
  Eye,
  Code,
  Check,
  Copy as CopyIcon,
  Maximize2,
  Minimize2,
  Monitor,
  Smartphone,
  Square,
  Circle,
} from 'lucide-react';

interface Props {
  html: string;
  type: 'notes' | 'exam' | 'slides' | 'code';
  topic: string;
  onRegenerate?: () => void;
  creditsUsed?: number;
  isStreaming?: boolean;
}

const TYPE_META = {
  notes:  { icon: FileText,     label: 'NOTES',  badge: 'HTML' },
  exam:   { icon: ScrollText,   label: 'EXAM',   badge: 'HTML' },
  slides: { icon: Presentation, label: 'SLIDES', badge: 'HTML' },
  code:   { icon: Code2,        label: 'CODE',   badge: 'HTML' },
} as const;

type DeviceFrame = 'full' | 'browser' | 'mobile';

// SVG noise texture data URI for tactile depth
const NOISE_BG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.04 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")";

export const ArtifactViewer = ({
  html,
  type,
  topic,
  onRegenerate,
  creditsUsed,
  isStreaming = false,
}: Props) => {
  const [view, setView] = useState<'preview' | 'code'>('preview');
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [device, setDevice] = useState<DeviceFrame>('full');
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(topic || 'Untitled artifact');
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setTitle(topic || 'Untitled artifact');
  }, [topic]);

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.select();
  }, [editingTitle]);

  // Esc closes fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [fullscreen]);

  const safeName = useMemo(
    () => (title || 'artifact').replace(/[^a-z0-9]+/gi, '-').slice(0, 40) || 'artifact',
    [title],
  );

  const download = () => {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-${safeName}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const openTab = () => {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const sizeKb = (html.length / 1024).toFixed(1);

  // ============ Toolbar ============
  const Toolbar = (
    <div
      className="flex items-center justify-between gap-2 h-12 px-4 border-b backdrop-blur-2xl"
      style={{
        background: 'rgba(17,17,19,0.85)',
        borderColor: '#1f1f23',
      }}
    >
      {/* Left */}
      <div className="flex items-center gap-3 min-w-0">
        {/* status dot */}
        <span className="relative inline-flex">
          <span
            className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-[#6ee7b7]' : 'bg-[#6ee7b7]'}`}
            style={{
              boxShadow: '0 0 8px rgba(110,231,183,0.6)',
              animation: isStreaming ? 'lumina-breath 1.4s ease-in-out infinite' : undefined,
            }}
          />
        </span>

        <Icon className="w-3.5 h-3.5 text-[#a1a1aa] shrink-0" />

        {editingTitle ? (
          <input
            ref={titleInputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                e.preventDefault();
                setEditingTitle(false);
              }
            }}
            className="bg-transparent outline-none text-[13px] text-[#f0f0f0] border-b border-[#6ee7b7]/60 min-w-0 max-w-[40ch]"
            style={{ fontFamily: "'DM Sans','Outfit',ui-sans-serif,system-ui", letterSpacing: '0.01em' }}
          />
        ) : (
          <button
            type="button"
            onDoubleClick={() => setEditingTitle(true)}
            className="text-[13px] text-[#f0f0f0] truncate max-w-[36ch] text-left hover:text-white transition-colors"
            style={{ fontFamily: "'DM Sans','Outfit',ui-sans-serif,system-ui", letterSpacing: '0.01em' }}
            title="Double-click to rename"
          >
            {title}
          </button>
        )}

        {/* type badge */}
        <span
          className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono uppercase"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid #1f1f23',
            color: '#71717a',
            letterSpacing: '0.08em',
          }}
        >
          {meta.badge}
        </span>

        {view === 'preview' && (
          <span
            className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono"
            style={{
              color: '#6ee7b7',
              background: 'rgba(110,231,183,0.08)',
              border: '1px solid rgba(110,231,183,0.2)',
              letterSpacing: '0.1em',
            }}
          >
            <span className="w-1 h-1 rounded-full bg-[#6ee7b7] animate-pulse" /> LIVE
          </span>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-1">
        {/* Preview/Code segmented pill */}
        <div
          className="relative flex items-center p-0.5 rounded-lg mr-1"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #1f1f23' }}
        >
          <button
            type="button"
            onClick={() => setView('preview')}
            className="relative z-10 flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[11px] transition-colors"
            style={{
              fontFamily: "'DM Sans','Outfit',ui-sans-serif,system-ui",
              letterSpacing: '0.02em',
              color: view === 'preview' ? '#0c0c0d' : '#a1a1aa',
              background: view === 'preview' ? '#6ee7b7' : 'transparent',
              fontWeight: view === 'preview' ? 600 : 500,
            }}
          >
            <Eye className="w-3 h-3" /> Preview
          </button>
          <button
            type="button"
            onClick={() => setView('code')}
            className="relative z-10 flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[11px] transition-colors"
            style={{
              fontFamily: "'DM Sans','Outfit',ui-sans-serif,system-ui",
              letterSpacing: '0.02em',
              color: view === 'code' ? '#0c0c0d' : '#a1a1aa',
              background: view === 'code' ? '#6ee7b7' : 'transparent',
              fontWeight: view === 'code' ? 600 : 500,
            }}
          >
            <Code className="w-3 h-3" /> Code
          </button>
        </div>

        {/* Device frame toggles (preview only) */}
        {view === 'preview' && (
          <div
            className="hidden md:flex items-center p-0.5 rounded-lg mr-1"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #1f1f23' }}
          >
            <ToolbarIconBtn
              ariaLabel="Full bleed"
              active={device === 'full'}
              onClick={() => setDevice('full')}
              tooltip="Full bleed"
            >
              <Square className="w-3.5 h-3.5" />
            </ToolbarIconBtn>
            <ToolbarIconBtn
              ariaLabel="Browser frame"
              active={device === 'browser'}
              onClick={() => setDevice('browser')}
              tooltip="Browser frame"
            >
              <Monitor className="w-3.5 h-3.5" />
            </ToolbarIconBtn>
            <ToolbarIconBtn
              ariaLabel="Mobile frame"
              active={device === 'mobile'}
              onClick={() => setDevice('mobile')}
              tooltip="Mobile frame"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </ToolbarIconBtn>
          </div>
        )}

        <ToolbarIconBtn ariaLabel="Copy source" tooltip={copied ? 'Copied' : 'Copy source'} onClick={copyCode}>
          {copied ? (
            <Check className="w-3.5 h-3.5 text-[#6ee7b7]" style={{ animation: 'lumina-pop 0.3s ease-out' }} />
          ) : (
            <CopyIcon className="w-3.5 h-3.5" />
          )}
        </ToolbarIconBtn>
        <ToolbarIconBtn ariaLabel="Download HTML" tooltip="Download .html" onClick={download}>
          <Download className="w-3.5 h-3.5" />
        </ToolbarIconBtn>
        <ToolbarIconBtn ariaLabel="Open in new tab" tooltip="Open in new tab" onClick={openTab}>
          <ExternalLink className="w-3.5 h-3.5" />
        </ToolbarIconBtn>
        {onRegenerate && (
          <ToolbarIconBtn ariaLabel="Regenerate" tooltip="Regenerate" onClick={onRegenerate}>
            <RefreshCcw className="w-3.5 h-3.5" />
          </ToolbarIconBtn>
        )}
        <ToolbarIconBtn
          ariaLabel={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          tooltip={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          onClick={() => setFullscreen((f) => !f)}
        >
          {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </ToolbarIconBtn>
      </div>
    </div>
  );

  // ============ Preview body (with device frames) ============
  const PreviewBody = (
    <div
      className="relative w-full overflow-auto"
      style={{ background: '#0c0c0d', height: fullscreen ? 'calc(100vh - 96px)' : '600px' }}
    >
      {device === 'full' && (
        <iframe
          srcDoc={html}
          sandbox="allow-scripts allow-same-origin"
          title={`${type} preview`}
          className="w-full h-full border-0 bg-white"
        />
      )}
      {device === 'browser' && (
        <div className="min-h-full w-full p-6 grid place-items-start">
          <div
            className="w-full max-w-[1100px] mx-auto rounded-xl overflow-hidden"
            style={{
              background: '#fff',
              border: '1px solid #1f1f23',
              boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
            }}
          >
            <div
              className="flex items-center gap-2 px-3 h-9"
              style={{ background: '#161618', borderBottom: '1px solid #1f1f23' }}
            >
              <Circle className="w-2.5 h-2.5 text-[#ff5f57] fill-current" />
              <Circle className="w-2.5 h-2.5 text-[#febc2e] fill-current" />
              <Circle className="w-2.5 h-2.5 text-[#28c840] fill-current" />
              <div
                className="ml-3 flex-1 h-5 rounded-md text-[10px] flex items-center px-2 text-[#71717a] font-mono"
                style={{ background: '#0c0c0d', border: '1px solid #1f1f23' }}
              >
                lumina://artifact/{safeName}
              </div>
            </div>
            <iframe
              srcDoc={html}
              sandbox="allow-scripts allow-same-origin"
              title={`${type} preview browser`}
              className="w-full border-0 bg-white"
              style={{ height: fullscreen ? 'calc(100vh - 200px)' : '520px' }}
            />
          </div>
        </div>
      )}
      {device === 'mobile' && (
        <div className="min-h-full w-full p-6 grid place-items-center">
          <div
            className="rounded-[36px] p-2"
            style={{
              background: '#1a1a1f',
              border: '1px solid #2a2a30',
              boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
            }}
          >
            <iframe
              srcDoc={html}
              sandbox="allow-scripts allow-same-origin"
              title={`${type} preview mobile`}
              className="border-0 bg-white rounded-[28px]"
              style={{ width: '390px', height: fullscreen ? 'calc(100vh - 220px)' : '560px' }}
            />
          </div>
        </div>
      )}
    </div>
  );

  // ============ Code body (custom syntax highlighting) ============
  const CodeBody = (
    <div
      className="relative overflow-hidden"
      style={{
        background: '#0d0d10',
        height: fullscreen ? 'calc(100vh - 96px)' : '600px',
      }}
    >
      <div className="flex h-full overflow-auto lumina-scroll">
        <Gutter html={html} />
        <pre
          className="m-0 py-5 pr-6 pl-4 flex-1 text-[13px] leading-[1.7] whitespace-pre overflow-visible"
          style={{
            color: '#e4e4e7',
            fontFamily: "'JetBrains Mono','Geist Mono',ui-monospace,monospace",
          }}
        >
          <HighlightedHtml code={html} />
          {isStreaming && (
            <span
              className="inline-block w-[7px] h-[15px] align-text-bottom ml-0.5"
              style={{
                background: '#6ee7b7',
                animation: 'lumina-blink 1s steps(2, start) infinite',
              }}
            />
          )}
        </pre>
      </div>
    </div>
  );

  // ============ Footer ============
  const Footer = (
    <div
      className="flex items-center justify-between text-[11px] px-4 h-9"
      style={{
        background: 'rgba(17,17,19,0.85)',
        borderTop: '1px solid #1f1f23',
        color: '#71717a',
        fontFamily: "'DM Sans','Outfit',ui-sans-serif,system-ui",
        letterSpacing: '0.02em',
      }}
    >
      <span>Sandboxed · {sizeKb} KB · {html.split('\n').length} lines</span>
      {typeof creditsUsed === 'number' && creditsUsed > 0 && (
        <span className="flex items-center gap-1.5 text-[#a78bfa]">
          ⚡ {creditsUsed} credit{creditsUsed === 1 ? '' : 's'}
        </span>
      )}
    </div>
  );

  // ============ Shell ============
  const Shell = (
    <div
      className="relative overflow-hidden"
      style={{
        background: '#0c0c0d',
        backgroundImage: NOISE_BG,
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: fullscreen ? 0 : 14,
        boxShadow: fullscreen
          ? 'none'
          : '0 0 0 1px rgba(255,255,255,0.04), 0 32px 64px rgba(0,0,0,0.6), 0 0 80px rgba(110,231,183,0.04)',
      }}
    >
      {Toolbar}
      <div style={{ position: 'relative' }}>
        <div
          key={view}
          style={{ animation: 'lumina-fade 220ms ease-out' }}
        >
          {view === 'preview' ? PreviewBody : CodeBody}
        </div>
      </div>
      {Footer}
    </div>
  );

  return (
    <>
      <StyleInjector />
      {!fullscreen && <div className="my-3">{Shell}</div>}
      {fullscreen && (
        <div
          className="fixed inset-0 z-[100] p-4 md:p-8"
          style={{
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
            animation: 'lumina-fade 200ms ease-out',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setFullscreen(false);
          }}
        >
          <div
            className="w-full h-full"
            style={{ animation: 'lumina-spring 320ms cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            {Shell}
          </div>
        </div>
      )}
    </>
  );
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const ToolbarIconBtn = ({
  children,
  onClick,
  ariaLabel,
  tooltip,
  active,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  ariaLabel: string;
  tooltip?: string;
  active?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={ariaLabel}
    title={tooltip ?? ariaLabel}
    className="relative grid place-items-center transition-colors"
    style={{
      width: 28,
      height: 28,
      borderRadius: 6,
      color: active ? '#6ee7b7' : '#a1a1aa',
      background: active ? 'rgba(110,231,183,0.1)' : 'transparent',
    }}
    onMouseEnter={(e) => {
      if (!active) (e.currentTarget.style.background = 'rgba(255,255,255,0.06)');
      e.currentTarget.style.color = '#f0f0f0';
    }}
    onMouseLeave={(e) => {
      if (!active) {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = '#a1a1aa';
      } else {
        e.currentTarget.style.color = '#6ee7b7';
      }
    }}
    onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
    onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
  >
    {children}
  </button>
);

const Gutter = ({ html }: { html: string }) => {
  const lineCount = html.split('\n').length;
  const lines = Array.from({ length: lineCount }, (_, i) => i + 1);
  return (
    <div
      className="select-none text-right py-5 pr-3 pl-4 sticky left-0"
      style={{
        background: '#0d0d10',
        borderRight: '1px solid #1f1f23',
        color: '#2e2e35',
        fontFamily: "'JetBrains Mono','Geist Mono',ui-monospace,monospace",
        fontSize: '12px',
        lineHeight: 1.7,
        minWidth: '3.5rem',
      }}
    >
      {lines.map((n) => (
        <div key={n}>{n}</div>
      ))}
    </div>
  );
};

/**
 * Lightweight HTML/JS/CSS syntax highlighter — custom Lumina theme.
 * No external deps, safe (escapes via DOM text).
 */
const HighlightedHtml = ({ code }: { code: string }) => {
  const tokens = useMemo(() => tokenizeHtml(code), [code]);
  return (
    <>
      {tokens.map((t, i) => (
        <span key={i} style={{ color: t.color, fontStyle: t.italic ? 'italic' : undefined }}>
          {t.text}
        </span>
      ))}
    </>
  );
};

type Token = { text: string; color: string; italic?: boolean };

const COLORS = {
  text: '#e4e4e7',
  tag: '#a78bfa',         // keywords / tags - violet
  attr: '#7dd3fc',        // attributes / functions - sky
  string: '#6ee7b7',      // strings - mint
  comment: '#3f3f46',     // comments
  number: '#fca5a5',      // numbers - peach
  punct: '#71717a',
  doctype: '#71717a',
};

function tokenizeHtml(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const len = src.length;

  const push = (text: string, color: string, italic = false) => {
    if (!text) return;
    if (out.length && out[out.length - 1].color === color && out[out.length - 1].italic === italic) {
      out[out.length - 1].text += text;
    } else {
      out.push({ text, color, italic });
    }
  };

  while (i < len) {
    // HTML comment
    if (src.startsWith('<!--', i)) {
      const end = src.indexOf('-->', i + 4);
      const stop = end === -1 ? len : end + 3;
      push(src.slice(i, stop), COLORS.comment, true);
      i = stop;
      continue;
    }
    // Doctype
    if (src.startsWith('<!', i)) {
      const end = src.indexOf('>', i);
      const stop = end === -1 ? len : end + 1;
      push(src.slice(i, stop), COLORS.doctype);
      i = stop;
      continue;
    }
    // <script>...</script> and <style>...</style>
    const scriptMatch = /^<(script|style)([^>]*)>/i.exec(src.slice(i));
    if (scriptMatch) {
      const tagName = scriptMatch[1].toLowerCase();
      const openLen = scriptMatch[0].length;
      // tokenize the opening tag
      tokenizeTag(scriptMatch[0], push);
      i += openLen;
      const closeIdx = src.toLowerCase().indexOf(`</${tagName}>`, i);
      const innerEnd = closeIdx === -1 ? len : closeIdx;
      const inner = src.slice(i, innerEnd);
      if (tagName === 'script') tokenizeJs(inner, push);
      else tokenizeCss(inner, push);
      i = innerEnd;
      if (closeIdx !== -1) {
        const closeTag = src.slice(closeIdx, closeIdx + tagName.length + 3);
        tokenizeTag(closeTag, push);
        i = closeIdx + tagName.length + 3;
      }
      continue;
    }
    // Tag
    if (src[i] === '<') {
      const end = src.indexOf('>', i);
      const stop = end === -1 ? len : end + 1;
      tokenizeTag(src.slice(i, stop), push);
      i = stop;
      continue;
    }
    // Text
    const next = src.indexOf('<', i);
    const stop = next === -1 ? len : next;
    push(src.slice(i, stop), COLORS.text);
    i = stop;
  }

  return out;
}

function tokenizeTag(tag: string, push: (t: string, c: string, italic?: boolean) => void) {
  // Match <tagname ...>, </tagname>, or <tagname/>
  const m = /^(<\/?)([a-zA-Z][\w-]*)([\s\S]*?)(\/?>)$/.exec(tag);
  if (!m) {
    push(tag, COLORS.punct);
    return;
  }
  push(m[1], COLORS.punct);
  push(m[2], COLORS.tag);
  // attributes
  const attrs = m[3];
  const re = /\s+([a-zA-Z_:][\w:-]*)(\s*=\s*)?("[^"]*"|'[^']*'|[^\s"'>]+)?/g;
  let last = 0;
  let am: RegExpExecArray | null;
  while ((am = re.exec(attrs)) !== null) {
    push(attrs.slice(last, am.index), COLORS.text);
    push(am[0].slice(0, am[0].indexOf(am[1])), COLORS.text); // whitespace
    push(am[1], COLORS.attr);
    if (am[2]) push(am[2], COLORS.punct);
    if (am[3]) {
      if (/^["']/.test(am[3])) push(am[3], COLORS.string);
      else push(am[3], COLORS.number);
    }
    last = am.index + am[0].length;
  }
  push(attrs.slice(last), COLORS.text);
  push(m[4], COLORS.punct);
}

function tokenizeJs(src: string, push: (t: string, c: string, italic?: boolean) => void) {
  const keywords = new Set([
    'const','let','var','function','return','if','else','for','while','do','switch','case','break','continue',
    'new','class','extends','this','super','import','export','from','default','async','await','try','catch',
    'finally','throw','typeof','instanceof','in','of','true','false','null','undefined','void','yield','static',
  ]);
  let i = 0;
  const len = src.length;
  while (i < len) {
    const c = src[i];
    // line comment
    if (c === '/' && src[i + 1] === '/') {
      const end = src.indexOf('\n', i);
      const stop = end === -1 ? len : end;
      push(src.slice(i, stop), COLORS.comment, true);
      i = stop;
      continue;
    }
    // block comment
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end === -1 ? len : end + 2;
      push(src.slice(i, stop), COLORS.comment, true);
      i = stop;
      continue;
    }
    // string
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      let j = i + 1;
      while (j < len) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === quote) { j++; break; }
        j++;
      }
      push(src.slice(i, j), COLORS.string);
      i = j;
      continue;
    }
    // number
    if (/[0-9]/.test(c)) {
      let j = i + 1;
      while (j < len && /[0-9.xXa-fA-F]/.test(src[j])) j++;
      push(src.slice(i, j), COLORS.number);
      i = j;
      continue;
    }
    // identifier
    if (/[A-Za-z_$]/.test(c)) {
      let j = i + 1;
      while (j < len && /[A-Za-z0-9_$]/.test(src[j])) j++;
      const word = src.slice(i, j);
      if (keywords.has(word)) push(word, COLORS.tag);
      else if (src[j] === '(') push(word, COLORS.attr);
      else push(word, COLORS.text);
      i = j;
      continue;
    }
    push(c, COLORS.punct);
    i++;
  }
}

function tokenizeCss(src: string, push: (t: string, c: string, italic?: boolean) => void) {
  let i = 0;
  const len = src.length;
  while (i < len) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end === -1 ? len : end + 2;
      push(src.slice(i, stop), COLORS.comment, true);
      i = stop;
      continue;
    }
    if (c === '"' || c === "'") {
      const q = c;
      let j = i + 1;
      while (j < len && src[j] !== q) {
        if (src[j] === '\\') j++;
        j++;
      }
      j = Math.min(j + 1, len);
      push(src.slice(i, j), COLORS.string);
      i = j;
      continue;
    }
    if (c === '{' || c === '}' || c === ':' || c === ';' || c === ',') {
      push(c, COLORS.punct);
      i++;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i + 1;
      while (j < len && /[0-9a-zA-Z%.\-]/.test(src[j])) j++;
      push(src.slice(i, j), COLORS.number);
      i = j;
      continue;
    }
    if (/[A-Za-z_\-#.@]/.test(c)) {
      let j = i + 1;
      while (j < len && /[A-Za-z0-9_\-]/.test(src[j])) j++;
      const word = src.slice(i, j);
      if (c === '@' || c === '#' || c === '.') push(word, COLORS.attr);
      else push(word, COLORS.tag);
      i = j;
      continue;
    }
    push(c, COLORS.text);
    i++;
  }
}

// Inject keyframes + scrollbar styles once
let stylesInjected = false;
const StyleInjector = () => {
  useEffect(() => {
    if (stylesInjected) return;
    stylesInjected = true;
    const style = document.createElement('style');
    style.setAttribute('data-lumina-artifact', '');
    style.textContent = `
      @keyframes lumina-fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes lumina-spring { 0% { opacity: 0; transform: scale(0.96) translateY(12px); } 60% { opacity: 1; transform: scale(1.005) translateY(-2px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
      @keyframes lumina-blink { 0%, 50% { opacity: 1; } 50.01%, 100% { opacity: 0; } }
      @keyframes lumina-breath { 0%, 100% { opacity: 1; box-shadow: 0 0 4px rgba(110,231,183,0.5); } 50% { opacity: 0.7; box-shadow: 0 0 12px rgba(110,231,183,0.9); } }
      @keyframes lumina-pop { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(1); } }
      .lumina-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
      .lumina-scroll::-webkit-scrollbar-track { background: transparent; }
      .lumina-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 999px; transition: background 200ms; }
      .lumina-scroll:hover::-webkit-scrollbar-thumb { background: rgba(110,231,183,0.4); }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { animation: none !important; transition: none !important; }
      }
    `;
    document.head.appendChild(style);
  }, []);
  return null;
};

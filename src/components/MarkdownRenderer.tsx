import { useState, useCallback, useMemo, useEffect, Children, cloneElement, isValidElement, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';
import { Check, Copy, Download, Play, X } from 'lucide-react';

const HTML_BREAK_TOKEN = '%%LUMINA_BR%%';

const RUNNABLE_LANGS = new Set(['html', 'htm', 'xhtml', 'svg', 'js', 'javascript', 'css']);
const EXT_FOR_LANG: Record<string, string> = {
  html: 'html', htm: 'html', xhtml: 'html', svg: 'svg',
  js: 'js', javascript: 'js', jsx: 'jsx', ts: 'ts', tsx: 'tsx',
  css: 'css', json: 'json', python: 'py', py: 'py', sh: 'sh', bash: 'sh',
  c: 'c', cpp: 'cpp', java: 'java', go: 'go', rust: 'rs', rs: 'rs',
  sql: 'sql', yaml: 'yml', yml: 'yml', md: 'md', xml: 'xml',
};

function buildRunnableDoc(lang: string, code: string): string {
  const l = lang.toLowerCase();
  if (l === 'html' || l === 'htm' || l === 'xhtml') return code;
  if (l === 'svg') return `<!doctype html><html><body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#0a0c12">${code}</body></html>`;
  if (l === 'css') return `<!doctype html><html><head><style>${code}</style></head><body><div class="demo"><h1>Hello</h1><p>This is a styled preview.</p><button>Button</button></div></body></html>`;
  // JS / generic — capture console & errors
  return `<!doctype html><html><head><style>
    body{margin:0;font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;background:#0a0c12;color:#e7eaf2;padding:14px;white-space:pre-wrap}
    .err{color:#ff6b6b}.warn{color:#ffd166}.info{color:#7dd3fc}
  </style></head><body><div id="out"></div><script>
    const out=document.getElementById('out');
    const fmt=v=>{try{return typeof v==='object'?JSON.stringify(v,null,2):String(v)}catch(_){return String(v)}};
    const write=(cls,args)=>{const d=document.createElement('div');d.className=cls;d.textContent=[...args].map(fmt).join(' ');out.appendChild(d);};
    ['log','info','warn','error'].forEach(k=>{const o=console[k].bind(console);console[k]=(...a)=>{write(k==='log'?'info':k,a);o(...a)}});
    window.addEventListener('error',e=>write('err','Error: '+e.message));
    window.addEventListener('unhandledrejection',e=>write('err','Unhandled: '+(e.reason&&e.reason.message||e.reason)));
    try{${code}\n}catch(e){write('err',['Error: '+e.message])}
  </script></body></html>`;
}

function RunModal({ lang, code, onClose }: { lang: string; code: string; onClose: () => void }) {
  const doc = useMemo(() => buildRunnableDoc(lang, code), [lang, code]);
  const srcDoc = doc;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-[#0a0c12]" onClick={(e) => e.stopPropagation()}>
        <div className="text-xs font-mono text-white/60 uppercase tracking-wider">Lumina Run · {lang}</div>
        <button onClick={onClose} className="text-white/60 hover:text-white flex items-center gap-1.5 text-xs px-2 py-1 rounded-md hover:bg-white/10">
          <X className="w-4 h-4" /> Close
        </button>
      </div>
      <iframe
        title="Lumina Code Preview"
        sandbox="allow-scripts allow-pointer-lock allow-modals allow-forms allow-popups"
        srcDoc={srcDoc}
        className="flex-1 w-full bg-white"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

function CodeBlock({ className, children }: { className?: string; children: string }) {
  const [copied, setCopied] = useState(false);
  const [running, setRunning] = useState(false);
  const lang = (className?.replace('language-', '') || '').toLowerCase();
  const isRunnable = RUNNABLE_LANGS.has(lang);
  const ext = EXT_FOR_LANG[lang] || 'txt';

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(children.replace(/\n$/, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [children]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([children.replace(/\n$/, '')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lumina-snippet.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [children, ext]);

  return (
    <>
      <div className="relative group rounded-xl overflow-hidden border border-border/20 bg-[hsl(var(--card))]/60 backdrop-blur-sm my-4 shadow-md">
        <div className="flex items-center justify-between px-4 py-2 bg-[hsl(var(--muted))]/40 border-b border-border/15 gap-3">
          <span className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">{lang || 'code'}</span>
          <div className="flex items-center gap-1">
            <button onClick={handleCopy}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors duration-200 px-2 py-1 rounded-md hover:bg-muted/30">
              {copied ? <><Check className="w-3.5 h-3.5 text-green-400" /><span className="text-green-400">Copied</span></> : <><Copy className="w-3.5 h-3.5" /><span>Copy</span></>}
            </button>
            <button onClick={handleDownload}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors duration-200 px-2 py-1 rounded-md hover:bg-muted/30">
              <Download className="w-3.5 h-3.5" /><span>Download</span>
            </button>
            {isRunnable && (
              <>
                <span className="text-muted-foreground/30 px-1">|</span>
                <button onClick={() => setRunning(true)}
                  className="flex items-center gap-1.5 text-[11px] text-primary hover:text-primary/80 transition-colors duration-200 px-2 py-1 rounded-md hover:bg-primary/10 font-medium">
                  <Play className="w-3.5 h-3.5" /><span>Run</span>
                </button>
              </>
            )}
          </div>
        </div>
        <pre className="!m-0 !rounded-none !border-0 !bg-transparent !shadow-none overflow-x-auto p-4">
          <code className={`${className || ''} text-[12px] md:text-[13px] leading-relaxed`}>{children}</code>
        </pre>
      </div>
      {running && <RunModal lang={lang} code={children.replace(/\n$/, '')} onClose={() => setRunning(false)} />}
    </>
  );
}

function renderBreaks(children: ReactNode): ReactNode {
  return Children.map(children, (child, index) => {
    if (typeof child === 'string') {
      const parts = child.split(HTML_BREAK_TOKEN);
      if (parts.length === 1) return child;
      return parts.flatMap((part, partIndex) => (
        partIndex < parts.length - 1
          ? [part, <br key={`markdown-br-${index}-${partIndex}`} />]
          : [part]
      ));
    }
    if (isValidElement<{ children?: ReactNode }>(child) && child.props.children != null) {
      return cloneElement(child, { children: renderBreaks(child.props.children) });
    }
    return child;
  });
}

/**
 * Robust LaTeX preprocessor:
 * - Protects code blocks first
 * - \( ... \) → $ ... $
 * - \[ ... \] → $$ ... $$
 * - Handles \begin{...}...\end{...} environments wrapped in $$ or standalone
 * - Handles multi-line blocks
 */
function preprocessLatex(text: string): string {
  if (!text) return text;

  // 1. Normalize line endings
  let processed = text.replace(/\r\n?/g, '\n');

  // 2. Protect code blocks (fenced + inline)
  const codeBlocks: string[] = [];
  processed = processed.replace(/```[\s\S]*?```|`[^`\n]+`/g, (match) => {
    codeBlocks.push(match);
    return `%%CODEBLOCK_${codeBlocks.length - 1}%%`;
  });

  // 3. HTML <br> tags
  processed = processed.replace(/<br\s*\/?>/gi, HTML_BREAK_TOKEN);

  // 4. \( ... \) → $ ... $   (inline; collapse internal newlines so KaTeX accepts it)
  processed = processed.replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (_, m) => `$${String(m).replace(/\s*\n\s*/g, ' ').trim()}$`);

  // 5. \[ ... \] → $$ ... $$ (display)
  processed = processed.replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (_, m) => `\n\n$$\n${String(m).trim()}\n$$\n\n`);

  // 6. Bare \begin{env}...\end{env} → wrap in $$ (only when NOT already wrapped).
  //    We protect already-$$-wrapped envs first, then wrap the rest.
  const protectedEnvs: string[] = [];
  processed = processed.replace(
    /\$\$\s*\\begin\{([a-zA-Z*]+)\}[\s\S]*?\\end\{\1\}\s*\$\$/g,
    (m) => { protectedEnvs.push(m); return `%%MATHENV_${protectedEnvs.length - 1}%%`; }
  );
  processed = processed.replace(
    /\\begin\{(aligned|align\*?|equation\*?|gather\*?|matrix|bmatrix|pmatrix|vmatrix|Vmatrix|smallmatrix|cases|array|split|multline\*?)\}([\s\S]*?)\\end\{\1\}/g,
    (m) => `\n\n$$\n${m}\n$$\n\n`
  );
  processed = processed.replace(/%%MATHENV_(\d+)%%/g, (_, i) => protectedEnvs[parseInt(i)]);

  // 7. Escape lone "$" used as currency so remark-math doesn't grab it.
  //    Heuristic: $ immediately followed by a digit and NOT closed by another $ on the same line.
  processed = processed.replace(/(^|[^\\$])\$(\d[\d,.]*)(?!\s*[^\n$]*\$)/g, '$1\\$$$2');

  // 8. Inline $...$ — kill internal newlines (LLMs sometimes wrap)
  processed = processed.replace(/(^|[^\$\\])\$([^\n$][^$]*?)\$(?!\$)/g, (_, pre, body) => {
    if (!body || body.length > 200) return _;
    return `${pre}$${body.replace(/\s*\n\s*/g, ' ').trim()}$`;
  });

  // 9. Ensure $$ display blocks have blank-line separation (remark-math is strict)
  processed = processed.replace(/([^\n])\$\$/g, '$1\n\n$$');
  processed = processed.replace(/\$\$([^\n])/g, '$$\n$1');

  // 9b. Auto-wrap obvious bare LaTeX (no delimiters) so the renderer doesn't show raw backslashes.
  //     Heuristic: a line containing common KaTeX commands (\frac, \sqrt, \sum, \int, \alpha, etc.)
  //     or sub/sup constructs ({_}, {^}) with NO existing $ on the line.
  const BARE_LATEX_RE = /\\(frac|sqrt|sum|int|prod|lim|alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|phi|omega|infty|cdot|times|approx|leq|geq|neq|rightarrow|leftarrow|partial|nabla|hat|vec|bar|overline|underline|mathbb|mathrm|mathbf|mathcal|begin\{)/;
  processed = processed
    .split('\n')
    .map((line) => {
      if (line.includes('$') || line.startsWith('%%CODEBLOCK_')) return line;
      // Skip lines that are part of markdown structure (headings, lists, tables, blockquotes)
      if (/^\s*(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|\|)/.test(line)) return line;
      if (BARE_LATEX_RE.test(line) || /[A-Za-z]_\{[^}]+\}|[A-Za-z]\^\{[^}]+\}/.test(line)) {
        const trimmed = line.trim();
        if (trimmed.length > 0 && trimmed.length < 200) {
          return line.replace(trimmed, `$$${trimmed}$$`);
        }
      }
      return line;
    })
    .join('\n');

  // 10. Restore code blocks
  processed = processed.replace(/%%CODEBLOCK_(\d+)%%/g, (_, idx) => codeBlocks[parseInt(idx)]);

  return processed;
}

interface MarkdownRendererProps {
  children: string;
  className?: string;
  streaming?: boolean;
}

const markdownComponents = {
  pre: ({ children }: any) => <>{children}</>,
  code: ({ className, children, ...props }: any) => {
    const isBlock = className?.startsWith('language-') ||
      (typeof children === 'string' && children.includes('\n'));
    if (isBlock) return <CodeBlock className={className}>{String(children)}</CodeBlock>;
    return (
      <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded-md text-[12px] md:text-[13px] font-mono before:content-none after:content-none" {...props}>
        {children}
      </code>
    );
  },
  p: ({ children }: any) => <p className="my-2.5 leading-[1.8]">{renderBreaks(children)}</p>,
  h1: ({ children }: any) => <h1 className="text-2xl font-bold mt-6 mb-3 pb-2 border-b border-border/20">{renderBreaks(children)}</h1>,
  h2: ({ children }: any) => <h2 className="text-xl font-bold mt-5 mb-2 pb-1.5 border-b border-border/15">{renderBreaks(children)}</h2>,
  h3: ({ children }: any) => <h3 className="text-lg font-semibold mt-4 mb-2">{renderBreaks(children)}</h3>,
  h4: ({ children }: any) => <h4 className="text-base font-semibold mt-3 mb-1.5">{renderBreaks(children)}</h4>,
  ul: ({ children }: any) => <ul className="my-2.5 ml-5 space-y-1 list-disc marker:text-primary/50">{children}</ul>,
  ol: ({ children }: any) => <ol className="my-2.5 ml-5 space-y-1 list-decimal marker:text-primary/50">{children}</ol>,
  li: ({ children }: any) => <li className="leading-[1.75] pl-1">{renderBreaks(children)}</li>,
  blockquote: ({ children }: any) => (
    <blockquote className="my-4 border-l-3 border-primary/40 bg-primary/5 rounded-r-xl py-3 px-5 not-italic">{renderBreaks(children)}</blockquote>
  ),
  table: ({ children }: any) => (
    <div className="my-4 overflow-x-auto rounded-xl border border-border/20 -mx-1">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }: any) => <thead className="bg-muted/30">{children}</thead>,
  th: ({ children }: any) => <th className="px-3 py-2 align-top text-left font-semibold text-foreground border-b border-border/20 whitespace-nowrap">{renderBreaks(children)}</th>,
  td: ({ children }: any) => <td className="px-3 py-2 align-top border-b border-border/10 leading-[1.7]">{renderBreaks(children)}</td>,
  hr: () => <hr className="my-6 border-border/20" />,
  strong: ({ children }: any) => <strong className="font-semibold text-foreground">{renderBreaks(children)}</strong>,
};

// CRITICAL: remarkMath MUST come before remarkGfm to prevent pipe conflicts in tables
const remarkPlugins = [remarkMath, remarkGfm];
const rehypePlugins = [[rehypeKatex, { strict: false, throwOnError: false, trust: true }], rehypeRaw] as any[];

export default function MarkdownRenderer({ children, className }: MarkdownRendererProps) {
  const processed = useMemo(() => preprocessLatex(children), [children]);

  return (
    <div className={`break-words markdown-content ${className || ''}`}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={markdownComponents}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}

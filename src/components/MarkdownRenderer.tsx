import { useState, useCallback, useMemo, Children, cloneElement, isValidElement, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Check, Copy } from 'lucide-react';

const HTML_BREAK_TOKEN = '%%LUMINA_BR%%';

function CodeBlock({ className, children }: { className?: string; children: string }) {
  const [copied, setCopied] = useState(false);
  const lang = className?.replace('language-', '') || '';

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(children.replace(/\n$/, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [children]);

  return (
    <div className="relative group rounded-xl overflow-hidden border border-border/20 bg-[hsl(var(--card))]/60 backdrop-blur-sm my-4 shadow-md">
      <div className="flex items-center justify-between px-4 py-2 bg-[hsl(var(--muted))]/40 border-b border-border/15">
        <span className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">{lang || 'code'}</span>
        <button onClick={handleCopy}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50 hover:text-foreground transition-colors duration-200 px-2 py-1 rounded-md hover:bg-muted/30">
          {copied ? <><Check className="w-3.5 h-3.5 text-green-400" /><span className="text-green-400">Copied!</span></> : <><Copy className="w-3.5 h-3.5" /><span>Copy</span></>}
        </button>
      </div>
      <pre className="!m-0 !rounded-none !border-0 !bg-transparent !shadow-none overflow-x-auto p-4">
        <code className={`${className || ''} text-[12px] md:text-[13px] leading-relaxed`}>{children}</code>
      </pre>
    </div>
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
      return cloneElement(child, {
        children: renderBreaks(child.props.children),
      });
    }

    return child;
  });
}

/**
 * Robust LaTeX preprocessor that handles all common AI model output formats:
 * - \( ... \) → $ ... $
 * - \[ ... \] → $$ ... $$
 * - Already-correct $...$ and $$...$$ are left alone
 * - Handles multi-line \[ \] blocks
 * - Protects code blocks from transformation
 */
function preprocessLatex(text: string): string {
  if (!text) return text;

  // Protect code blocks from LaTeX processing
  const codeBlocks: string[] = [];
  let processed = text.replace(/\r\n?/g, '\n').replace(/```[\s\S]*?```|`[^`\n]+`/g, (match) => {
    codeBlocks.push(match);
    return `%%CODEBLOCK_${codeBlocks.length - 1}%%`;
  });

  processed = processed.replace(/<br\s*\/?>/gi, HTML_BREAK_TOKEN);

  // Convert \( ... \) to inline math $ ... $ (non-greedy, single line)
  processed = processed.replace(/\\\((.+?)\\\)/g, (_, math) => `$${math.trim()}$`);

  // Convert \[ ... \] to display math $$ ... $$ (handles multi-line)
  processed = processed.replace(/\\\[([\s\S]+?)\\\]/g, (_, math) => `\n$$${math.trim()}$$\n`);

  // Restore code blocks
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
    <div className="my-4 overflow-x-auto rounded-xl border border-border/20 -mx-1"><table className="w-full text-sm border-collapse">{children}</table></div>
  ),
  thead: ({ children }: any) => <thead className="bg-muted/30">{children}</thead>,
  th: ({ children }: any) => <th className="px-3 py-2 align-top text-left font-semibold text-foreground border-b border-border/20 whitespace-nowrap">{renderBreaks(children)}</th>,
  td: ({ children }: any) => <td className="px-3 py-2 align-top border-b border-border/10 leading-[1.7]">{renderBreaks(children)}</td>,
  hr: () => <hr className="my-6 border-border/20" />,
  strong: ({ children }: any) => <strong className="font-semibold text-foreground">{renderBreaks(children)}</strong>,
};

const remarkPluginsAll = [remarkGfm, remarkMath];
const rehypePluginsAll = [rehypeKatex];

export default function MarkdownRenderer({ children, className, streaming = false }: MarkdownRendererProps) {
  const processed = useMemo(() => preprocessLatex(children), [children]);

  return (
    <div className={`break-words markdown-content ${className || ''}`}>
      <ReactMarkdown
        remarkPlugins={remarkPluginsAll}
        rehypePlugins={rehypePluginsAll}
        components={markdownComponents}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}

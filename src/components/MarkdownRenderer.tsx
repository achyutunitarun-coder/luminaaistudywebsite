import { useState, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Check, Copy } from 'lucide-react';

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
  let processed = text.replace(/```[\s\S]*?```|`[^`\n]+`/g, (match) => {
    codeBlocks.push(match);
    return `%%CODEBLOCK_${codeBlocks.length - 1}%%`;
  });

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
}

export default function MarkdownRenderer({ children, className }: MarkdownRendererProps) {
  const processed = useMemo(() => preprocessLatex(children), [children]);

  return (
    <div className={`overflow-hidden break-words markdown-content ${className || ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children, ...props }) => {
            const isBlock = className?.startsWith('language-') ||
              (typeof children === 'string' && children.includes('\n'));

            if (isBlock) {
              return <CodeBlock className={className}>{String(children)}</CodeBlock>;
            }

            return (
              <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded-md text-[12px] md:text-[13px] font-mono before:content-none after:content-none" {...props}>
                {children}
              </code>
            );
          },
          p: ({ children }) => <p className="my-3 leading-[1.8]">{children}</p>,
          h1: ({ children }) => <h1 className="text-2xl font-bold mt-6 mb-3 pb-2 border-b border-border/20">{children}</h1>,
          h2: ({ children }) => <h2 className="text-xl font-bold mt-8 mb-3 pb-2 border-b border-border/15">{children}</h2>,
          h3: ({ children }) => <h3 className="text-lg font-semibold mt-6 mb-2">{children}</h3>,
          h4: ({ children }) => <h4 className="text-base font-semibold mt-4 mb-2">{children}</h4>,
          ul: ({ children }) => <ul className="my-3 ml-1 space-y-1.5 list-disc list-inside">{children}</ul>,
          ol: ({ children }) => <ol className="my-3 ml-1 space-y-1.5 list-decimal list-inside">{children}</ol>,
          li: ({ children }) => <li className="leading-[1.75]">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-4 border-l-3 border-primary/40 bg-primary/5 rounded-r-xl py-3 px-5 not-italic">{children}</blockquote>
          ),
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-xl border border-border/20"><table className="w-full text-sm">{children}</table></div>
          ),
          thead: ({ children }) => <thead className="bg-muted/30">{children}</thead>,
          th: ({ children }) => <th className="px-4 py-2.5 text-left font-semibold text-foreground border-b border-border/20">{children}</th>,
          td: ({ children }) => <td className="px-4 py-2 border-b border-border/10">{children}</td>,
          hr: () => <hr className="my-6 border-border/20" />,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}

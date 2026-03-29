import { useState, useCallback } from 'react';
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
    <div className="relative group rounded-xl overflow-hidden border border-border/20 bg-[hsl(var(--card))]/60 backdrop-blur-sm my-3 shadow-md">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[hsl(var(--muted))]/40 border-b border-border/15">
        <span className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">
          {lang || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50 hover:text-foreground transition-colors duration-200 px-2 py-1 rounded-md hover:bg-muted/30"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-400" />
              <span className="text-green-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      {/* Code content */}
      <pre className="!m-0 !rounded-none !border-0 !bg-transparent !shadow-none overflow-x-auto p-4">
        <code className={`${className || ''} text-[12px] md:text-[13px] leading-relaxed`}>
          {children}
        </code>
      </pre>
    </div>
  );
}

interface MarkdownRendererProps {
  children: string;
  className?: string;
}

export default function MarkdownRenderer({ children, className }: MarkdownRendererProps) {
  return (
    <div className={`overflow-hidden break-words ${className || ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children, ...props }) => {
            const isBlock = className?.startsWith('language-') || 
              (typeof children === 'string' && children.includes('\n'));
            
            if (isBlock) {
              return (
                <CodeBlock className={className}>
                  {String(children)}
                </CodeBlock>
              );
            }

            return (
              <code
                className="text-primary bg-primary/10 px-1.5 py-0.5 rounded-md text-[12px] md:text-[13px] font-mono before:content-none after:content-none"
                {...props}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

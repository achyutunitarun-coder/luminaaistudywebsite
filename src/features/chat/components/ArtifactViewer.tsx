import { useState } from 'react';
import { Download, ExternalLink, RefreshCcw, FileText, Code2, Presentation, ScrollText, Eye, Code } from 'lucide-react';

interface Props {
  html: string;
  type: 'notes' | 'exam' | 'slides' | 'code';
  topic: string;
  onRegenerate?: () => void;
  creditsUsed?: number;
}

const TYPE_META = {
  notes:  { icon: FileText,     label: 'Notes',      color: 'text-violet-400'  },
  exam:   { icon: ScrollText,   label: 'Exam Paper', color: 'text-amber-400'   },
  slides: { icon: Presentation, label: 'Slides',     color: 'text-pink-400'    },
  code:   { icon: Code2,        label: 'Code',       color: 'text-emerald-400' },
} as const;

export const ArtifactViewer = ({ html, type, topic, onRegenerate, creditsUsed }: Props) => {
  const [view, setView] = useState<'preview' | 'code'>('preview');
  const meta = TYPE_META[type];
  const Icon = meta.icon;

  const download = () => {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safe = topic.replace(/[^a-z0-9]+/gi, '-').slice(0, 40) || 'artifact';
    a.download = `${type}-${safe}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const openTab = () => {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <div className="rounded-2xl bg-card/60 backdrop-blur-xl border border-border overflow-hidden my-2">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-card/40">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={`w-4 h-4 shrink-0 ${meta.color}`} />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{meta.label}</span>
          <span className="text-xs text-muted-foreground/60 truncate">· {topic}</span>
        </div>
        <div className="flex items-center gap-1">
          {/* View toggle */}
          <div className="flex items-center rounded-md bg-background/60 p-0.5 mr-1">
            <button
              type="button"
              onClick={() => setView('preview')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors ${
                view === 'preview' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Preview"
            >
              <Eye className="w-3 h-3" /> Preview
            </button>
            <button
              type="button"
              onClick={() => setView('code')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors ${
                view === 'code' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="View source"
            >
              <Code className="w-3 h-3" /> Code
            </button>
          </div>

          <button type="button" onClick={download} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Download">
            <Download className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={openTab} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Open in new tab">
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          {onRegenerate && (
            <button type="button" onClick={onRegenerate} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Regenerate">
              <RefreshCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {view === 'preview' ? (
        <iframe
          srcDoc={html}
          sandbox="allow-scripts allow-same-origin"
          title={`${type} preview`}
          className="w-full h-[600px] border-0 bg-white"
        />
      ) : (
        <pre className="m-0 p-3 max-h-[600px] overflow-auto text-[11px] leading-relaxed bg-[#0d1117] text-[#e6edf3] font-mono whitespace-pre-wrap break-words">
          {html}
        </pre>
      )}

      <div className="px-3 py-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Sandboxed iframe · {(html.length / 1024).toFixed(1)} KB</span>
        {typeof creditsUsed === 'number' && creditsUsed > 0 && (
          <span className="flex items-center gap-1">⚡ {creditsUsed} credit{creditsUsed === 1 ? '' : 's'} used</span>
        )}
      </div>
    </div>
  );
};

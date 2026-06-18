import { useState, useMemo } from 'react';
import { User, Sparkles, AlertCircle, Zap, Copy, RefreshCw, ThumbsUp, ThumbsDown, Pencil, Brain, ChevronRight, FileText, ArrowUpRight } from 'lucide-react';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { LoadingStages } from './LoadingStages';
import { ActionConfirmCard } from './ActionConfirmCard';
import { useArtifactStore } from '@/features/artifacts/artifactStore';
import { CREDIT_PACKS, openCheckout } from '@/features/credits/DodoPayments';
import { toast } from 'sonner';
import type { Message } from '../ChatPage';

interface Props {
  message: Message;
  onRegenerate?: () => void;
  onRetry?: () => void;
  onEdit?: (newText: string) => void;
  onTopUp?: () => void;
  onConfirmAction?: () => void | Promise<void>;
  onCancelAction?: () => void;
  loadingStage?: string;
}

function extractThinking(content: string): { thinking: string | null; main: string } {
  if (!content) return { thinking: null, main: '' };
  const m = content.match(/<think>([\s\S]*?)<\/think>/i);
  if (!m) return { thinking: null, main: content };
  const thinking = m[1].trim();
  const main = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  return { thinking: thinking || null, main };
}

const ThinkingBlock = ({ content }: { content: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-3 rounded-lg border border-violet-500/20 bg-violet-500/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-violet-300 hover:bg-violet-500/10 transition-colors"
      >
        <Brain className="w-3.5 h-3.5" />
        <span className="font-medium">Thinking process</span>
        <ChevronRight className={`w-3.5 h-3.5 ml-auto transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="px-3 py-2 border-t border-violet-500/20 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
          {content}
        </div>
      )}
    </div>
  );
};

export const MessageBubble = ({ message, onRegenerate, onRetry, onEdit, onTopUp, onConfirmAction, onCancelAction, loadingStage }: Props) => {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const openArtifact = useArtifactStore((s) => s.openArtifact);

  if (message.type === 'action_confirm' && message.pendingAction) {
    return (
      <ActionConfirmCard
        action={message.pendingAction}
        summary={message.actionSummary || message.content}
        done={message.actionResolved}
        onConfirm={async () => { await onConfirmAction?.(); }}
        onCancel={() => onCancelAction?.()}
      />
    );
  }

  if (message.type === 'loading') {
    return (
      <div className="flex gap-3 max-w-3xl mx-auto px-4">
        <div className="shrink-0 w-7 h-7 rounded-lg grid place-items-center bg-primary/10">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <LoadingStages stage={loadingStage || message.content} active />
        </div>
      </div>
    );
  }

  if (message.type === 'error') {
    return (
      <div className="max-w-3xl mx-auto px-4">
        <div className="rounded-xl border-l-4 border-destructive bg-destructive/5 p-3 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-sm text-foreground">{message.content}</div>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-2 text-xs px-2.5 py-1 rounded-md bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
              >
                Try again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (message.type === 'insufficient_credits') {
    const need = message.requiredCredits ?? 1.5;
    const have = message.currentBalance ?? 0;
    const quickPacks = CREDIT_PACKS.slice(0, 3);
    return (
      <div className="max-w-3xl mx-auto px-4">
        <div className="rounded-2xl p-4 bg-card border border-white/[0.04]">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-xp/10">
              <Zap className="w-4 h-4 text-amber-400" fill="currentColor" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-foreground leading-relaxed">
                {message.content}{' '}
                <span className="text-muted-foreground">You have</span>{' '}
                <span className="text-amber-400 font-semibold">{have.toFixed(1)} credits</span>,{' '}
                <span className="text-muted-foreground">need</span>{' '}
                <span className="text-amber-400 font-semibold">{need}</span>.
              </div>
              {onTopUp && (
                <button type="button" onClick={onTopUp} className="mt-3 text-xs font-medium px-3 py-1.5 rounded-lg text-amber-400 border border-amber-500/20 hover:bg-amber-500/10 transition-colors">
                  Top up credits →
                </button>
              )}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {quickPacks.map((p) => (
              <button key={p.id} type="button" onClick={() => openCheckout(p.checkout)} className="text-left rounded-xl p-2.5 transition-all hover:scale-[1.02] bg-card border border-white/[0.04]">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{p.name}</div>
                <div className="text-sm font-bold text-foreground mt-0.5">{p.credits} credits</div>
                <div className="text-[11px] text-muted-foreground">₹{p.price}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const isUser = message.role === 'user';
  const isStreaming = !!(message as any).isStreaming;
  const { thinking, main } = useMemo(
    () => (isUser ? { thinking: null, main: message.content } : extractThinking(message.content)),
    [message.content, isUser],
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    toast.success('Copied');
  };

  if (isUser) {
    return (
      <div
        id={`msg-${message.id}`}
        className="flex gap-3 max-w-3xl mx-auto px-4 justify-end group"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="min-w-0 max-w-[85%] flex flex-col items-end gap-1">
          {editing ? (
            <div className="w-full min-w-[280px]">
              <textarea
                autoFocus
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={Math.min(8, Math.max(2, editText.split('\n').length))}
                className="w-full text-sm rounded-xl bg-card border border-border focus:border-primary/60 outline-none p-3 resize-none"
              />
              <div className="mt-1.5 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setEditing(false); setEditText(message.content); }}
                  className="text-xs px-3 py-1.5 rounded-md hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!editText.trim()) return;
                    setEditing(false);
                    onEdit?.(editText.trim());
                  }}
                  className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Submit
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words bg-primary text-primary-foreground" style={{ borderRadius: '16px 16px 4px 16px' }}>
              {message.content}
            </div>
          )}
          {!editing && hovered && onEdit && (
            <div className="flex gap-1 opacity-80">
              <button
                type="button"
                onClick={() => { setEditText(message.content); setEditing(true); }}
                title="Edit"
                className="w-6 h-6 grid place-items-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={handleCopy}
                title="Copy"
                className="w-6 h-6 grid place-items-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
        <div className="shrink-0 w-7 h-7 rounded-lg grid place-items-center bg-muted border border-white/[0.04]">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Assistant
  return (
    <div
      id={`msg-${message.id}`}
      className="flex gap-3 max-w-3xl mx-auto px-4 group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="shrink-0 w-7 h-7 rounded-lg grid place-items-center bg-primary/10">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        {message.type === 'artifact' && message.artifactHtml && message.artifactType ? (
          <>
            <button
              type="button"
              onClick={() => openArtifact(message.id)}
              className="group/artifact-card w-full rounded-2xl border border-white/10 bg-card p-4 text-left shadow-xl backdrop-blur-xl transition-all hover:scale-[1.01] hover:border-primary/40"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground truncate">{message.topic || 'Generated artifact'}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{message.artifactType.toUpperCase()} · opened in Artifact Studio</div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover/artifact-card:translate-x-0.5 group-hover/artifact-card:-translate-y-0.5" />
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background/70">
                <div className="h-full w-2/3 rounded-full bg-primary/70 shadow-[0_0_16px_hsl(var(--primary)/.45)]" />
              </div>
            </button>
            {typeof message.creditsUsed === 'number' && message.creditsUsed > 0 && (
              <div className="mt-1.5 inline-flex items-center gap-2 text-[11px] px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300">
                <Zap className="w-3 h-3" fill="currentColor" />
                <span>{message.creditsUsed} credit{message.creditsUsed === 1 ? '' : 's'} used</span>
                {typeof message.newBalance === 'number' && (
                  <span className="text-muted-foreground">· Balance: {message.newBalance.toFixed(1)}</span>
                )}
                {typeof message.newBalance === 'number' && message.newBalance < 5 && onTopUp && (
                  <button
                    type="button"
                    onClick={onTopUp}
                    className="ml-1 underline underline-offset-2 hover:text-violet-200"
                  >
                    Top up →
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="text-sm leading-relaxed">
            {thinking && <ThinkingBlock content={thinking} />}
            <MarkdownRenderer>{main}</MarkdownRenderer>
            {isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-primary/70 align-text-bottom ml-0.5 animate-pulse" />
            )}
          </div>
        )}

        {message.type !== 'artifact' && hovered && !isStreaming && message.content && (
          <div className="mt-2 flex items-center gap-1">
            <button type="button" onClick={handleCopy} title="Copy" className="action-btn">
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={onRegenerate} title="Regenerate" className="action-btn">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => toast.success('Thanks for the feedback')} title="Good response" className="action-btn">
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => toast.success('Thanks — we’ll improve')} title="Bad response" className="action-btn">
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

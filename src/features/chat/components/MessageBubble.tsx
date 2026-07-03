import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Sparkles, AlertCircle, Zap, Copy, RefreshCw,
  ThumbsUp, ThumbsDown, Pencil, Brain, ChevronRight,
  FileText, ArrowUpRight, Download, Eye, ExternalLink,
  Table, Presentation, Code2, BookOpen, Globe,
} from 'lucide-react';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { LoadingStages } from './LoadingStages';
import { ActionConfirmCard } from './ActionConfirmCard';
import { useArtifactStore } from '@/features/artifacts/artifactStore';
import { useWorkspace } from '@/features/computer/workspace';
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
    <motion.div
      initial={false}
      className="mb-3 rounded-xl border border-violet-500/15 bg-violet-500/[0.03] overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-violet-300/80 hover:bg-violet-500/8 transition-colors"
      >
        <Brain className="w-3.5 h-3.5" />
        <span className="font-medium">Thinking process</span>
        <ChevronRight
          className={`w-3.5 h-3.5 ml-auto transition-transform duration-300 ${open ? 'rotate-90' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="thinking-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 py-2.5 border-t border-violet-500/15 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const ARTIFACT_ICONS: Record<string, React.ReactNode> = {
  slides: <Presentation className="h-4 w-4" />,
  doc: <BookOpen className="h-4 w-4" />,
  sheet: <Table className="h-4 w-4" />,
  research: <BookOpen className="h-4 w-4" />,
  website: <Globe className="h-4 w-4" />,
  notes: <FileText className="h-4 w-4" />,
  exam: <Code2 className="h-4 w-4" />,
  code: <Code2 className="h-4 w-4" />,
};

const ARTIFACT_COLORS: Record<string, string> = {
  slides: 'from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-300',
  doc: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-300',
  sheet: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-300',
  research: 'from-violet-500/20 to-violet-600/10 border-violet-500/30 text-violet-300',
  website: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-300',
  notes: 'from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-300',
};

interface ExportButton {
  format: string;
  label: string;
  action: 'download' | 'google_push' | 'preview';
}

function useExportActions(type: string): ExportButton[] {
  return useWorkspace((s) => s.getExportActions(type));
}

const ArtifactCard = ({ message, onOpen }: { message: Message; onOpen: () => void }) => {
  const [expanded, setExpanded] = useState(false);
  const type = message.artifactType || 'notes';
  const icon = ARTIFACT_ICONS[type] || <FileText className="h-4 w-4" />;
  const colors = ARTIFACT_COLORS[type] || 'from-zinc-500/20 to-zinc-600/10 border-zinc-500/30 text-zinc-300';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="group/artifact"
    >
      <button
        type="button"
        onClick={() => { onOpen(); setExpanded((e) => !e); }}
        className="w-full text-left"
      >
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent p-4 transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.06] hover:scale-[1.01] active:scale-[0.99]">
          <div className="flex items-center gap-3">
            <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border bg-gradient-to-br ${colors}`}>
              {icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-foreground truncate">
                {message.topic || 'Generated artifact'}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="uppercase tracking-wider">{type}</span>
                <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                <span>opened in Artifact Studio</span>
              </div>
            </div>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all duration-300 group-hover/artifact:text-foreground group-hover/artifact:translate-x-0.5 group-hover/artifact:-translate-y-0.5" />
          </div>

          {message.artifactHtml && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary/30"
                initial={{ width: '60%' }}
                animate={{ width: expanded ? '100%' : '60%' }}
                transition={{ duration: 0.4, ease: 'easeInOut' }}
              />
            </div>
          )}

          {typeof message.creditsUsed === 'number' && message.creditsUsed > 0 && (
            <div className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-violet-500/8 border border-violet-500/15 text-violet-300/80">
              <Zap className="w-3 h-3" fill="currentColor" />
              <span>{message.creditsUsed} credit{message.creditsUsed === 1 ? '' : 's'} used</span>
              {typeof message.newBalance === 'number' && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span>Balance: {message.newBalance.toFixed(1)}</span>
                </>
              )}
            </div>
          )}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="mt-2 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { action: 'download', label: 'Download', icon: Download },
                  { action: 'preview', label: 'Preview', icon: Eye },
                  { action: 'google_push', label: 'Push to Google', icon: ExternalLink },
                ].map(({ action, label, icon: Icon }) => (
                  <button
                    key={action}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toast.success(`${label} — coming soon`);
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground bg-white/[0.02] hover:bg-white/[0.06] border border-transparent hover:border-white/[0.08] transition-all duration-200"
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const FeedbackButton = ({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    title={label}
    className="msg-action-btn group relative"
  >
    <Icon className="w-3.5 h-3.5" />
    <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-zinc-800 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
      {label}
    </span>
  </button>
);

export const MessageBubble = ({ message, onRegenerate, onRetry, onEdit, onTopUp, onConfirmAction, onCancelAction, loadingStage }: Props) => {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const openArtifact = useArtifactStore((s) => s.openArtifact);
  const { thinking, main } = useMemo(
    () => (message.role === 'user' ? { thinking: null, main: message.content } : extractThinking(message.content)),
    [message.content, message.role],
  );

  if (message.type === 'action_confirm' && message.pendingAction) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="msg-row msg-row-assistant"
      >
        <ActionConfirmCard
          action={message.pendingAction}
          summary={message.actionSummary || message.content}
          done={message.actionResolved}
          onConfirm={async () => { await onConfirmAction?.(); }}
          onCancel={() => onCancelAction?.()}
        />
      </motion.div>
    );
  }

  if (message.type === 'loading') {
    return (
      <div className="msg-row msg-row-assistant">
        <div className="shrink-0 w-7 h-7 rounded-full grid place-items-center" style={{
          background: 'var(--brand-tint)',
          border: '1px solid var(--border-brand)',
          boxShadow: '0 0 12px rgba(124,92,252,0.15)',
        }}>
          <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--brand-glow)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <LoadingStages stage={loadingStage || message.content} active />
        </div>
      </div>
    );
  }

  if (message.type === 'error') {
    return (
      <div className="msg-row msg-row-assistant msg-enter">
        <div className="shrink-0 w-7 h-7 rounded-full grid place-items-center" style={{
          background: 'var(--red-tint)',
          border: '1px solid rgba(248,113,113,0.3)',
        }}>
          <AlertCircle className="w-3.5 h-3.5" style={{ color: 'var(--red)' }} />
        </div>
        <div className="msg-bubble msg-bubble-error flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div>{message.content}</div>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-2 text-xs px-3 py-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive transition-all hover:scale-[1.02] active:scale-[0.98]"
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
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto px-4"
      >
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-amber-500/10">
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
                <button type="button" onClick={onTopUp} className="mt-3 text-xs font-medium px-3 py-1.5 rounded-lg text-amber-400 border border-amber-500/20 hover:bg-amber-500/10 transition-all hover:scale-[1.02] active:scale-[0.98]">
                  Top up credits →
                </button>
              )}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {quickPacks.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => openCheckout(p.checkout)}
                className="text-left rounded-xl p-3 transition-all hover:scale-[1.02] active:scale-[0.98] bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12]"
              >
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{p.name}</div>
                <div className="text-sm font-bold text-foreground mt-0.5">{p.credits} credits</div>
                <div className="text-[11px] text-muted-foreground">₹{p.price}</div>
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    );
  }

  const isUser = message.role === 'user';
  const isStreaming = !!(message as any).isStreaming;

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    toast.success('Copied');
  };

  if (isUser) {
    return (
      <motion.div
        id={`msg-${message.id}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="msg-row msg-row-user"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="min-w-0 max-w-[85%] flex flex-col items-end gap-1.5">
          {editing ? (
            <div className="w-full min-w-[280px]">
              <textarea
                autoFocus
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={Math.min(8, Math.max(2, editText.split('\n').length))}
                className="w-full text-sm rounded-xl bg-card border border-border focus:border-primary/60 outline-none p-3 resize-none transition-all"
              />
              <div className="mt-2 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setEditing(false); setEditText(message.content); }}
                  className="text-xs px-3 py-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground"
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
                  className="text-xs px-4 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Submit
                </button>
              </div>
            </div>
          ) : (
            <div className="msg-bubble msg-bubble-user">
              {message.content}
            </div>
          )}
          {!editing && hovered && onEdit && (
            <div className="flex gap-1 opacity-80">
              <button
                type="button"
                onClick={() => { setEditText(message.content); setEditing(true); }}
                title="Edit"
                className="w-7 h-7 grid place-items-center rounded-md hover:bg-white/[0.08] text-muted-foreground hover:text-foreground transition-all"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={handleCopy}
                title="Copy"
                className="w-7 h-7 grid place-items-center rounded-md hover:bg-white/[0.08] text-muted-foreground hover:text-foreground transition-all"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
        <div className="shrink-0 w-7 h-7 rounded-full grid place-items-center" style={{
          background: 'linear-gradient(135deg, var(--brand) 0%, #6B4CE6 100%)',
          boxShadow: '0 0 12px rgba(124,92,252,0.2)',
        }}>
          <User className="w-3.5 h-3.5 text-white" />
        </div>
      </motion.div>
    );
  }

  // Assistant
  return (
    <motion.div
      id={`msg-${message.id}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="msg-row msg-row-assistant"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="shrink-0 w-7 h-7 rounded-full grid place-items-center" style={{
        background: 'var(--brand-tint)',
        border: '1px solid var(--border-brand)',
        boxShadow: '0 0 12px rgba(124,92,252,0.15)',
      }}>
        <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--brand-glow)' }} />
      </div>
      <div className="min-w-0 flex-1">
        {message.type === 'artifact' ? (
          <ArtifactCard
            message={message}
            onOpen={() => openArtifact(message.id)}
          />
        ) : (
          <div className="msg-bubble msg-bubble-ai">
            {thinking && <ThinkingBlock content={thinking} />}
            <MarkdownRenderer>{main}</MarkdownRenderer>
            {isStreaming && (
              <span className="msg-streaming-cursor" />
            )}
          </div>
        )}

        {message.type !== 'artifact' && hovered && !isStreaming && message.content && (
          <div className="msg-actions">
            <FeedbackButton icon={Copy} label="Copy" onClick={handleCopy} />
            <FeedbackButton icon={RefreshCw} label="Regenerate" onClick={onRegenerate} />
            <FeedbackButton icon={ThumbsUp} label="Good response" onClick={() => toast.success('Thanks for the feedback')} />
            <FeedbackButton icon={ThumbsDown} label="Bad response" onClick={() => toast.success('Thanks — we\'ll improve')} />
          </div>
        )}
      </div>
    </motion.div>
  );
};

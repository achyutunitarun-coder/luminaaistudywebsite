import { User, Sparkles, AlertCircle, Zap } from 'lucide-react';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { ArtifactViewer } from './ArtifactViewer';
import { LoadingStages } from './LoadingStages';
import { CREDIT_PACKS, openCheckout } from '@/features/credits/DodoPayments';
import type { Message } from '../ChatPage';

interface Props {
  message: Message;
  onRegenerate?: () => void;
  onRetry?: () => void;
  onTopUp?: () => void;
  loadingStage?: string;
}

export const MessageBubble = ({ message, onRegenerate, onRetry, onTopUp, loadingStage }: Props) => {
  if (message.type === 'loading') {
    return (
      <div className="flex gap-3 max-w-3xl mx-auto px-4">
        <div className="shrink-0 w-7 h-7 rounded-lg grid place-items-center bg-primary/10 text-primary">
          <Sparkles className="w-3.5 h-3.5" />
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
        <div className="rounded-xl border-l-4 border-amber-500 bg-amber-500/5 p-3">
          <div className="flex items-start gap-3">
            <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="currentColor" />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-foreground">
                {message.content}{' '}
                <span className="text-muted-foreground">
                  You have <span className="text-amber-300 font-medium">⚡ {have.toFixed(1)}</span>, need{' '}
                  <span className="text-amber-300 font-medium">⚡ {need}</span>.
                </span>
              </div>
              {onTopUp && (
                <button
                  type="button"
                  onClick={onTopUp}
                  className="mt-2 text-xs px-2.5 py-1 rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-colors"
                >
                  Top up credits →
                </button>
              )}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {quickPacks.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => openCheckout(p.checkout)}
                className="text-left rounded-lg border border-border bg-card/40 hover:bg-card/60 hover:border-primary/40 p-2 transition-all"
              >
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{p.name}</div>
                <div className="text-sm font-bold text-violet-300">{p.credits} ⚡</div>
                <div className="text-[11px] text-muted-foreground">₹{p.price}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 max-w-3xl mx-auto px-4 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <div className="shrink-0 w-7 h-7 rounded-lg grid place-items-center bg-primary/10 text-primary">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
      )}
      <div className={`min-w-0 ${isUser ? 'max-w-[85%]' : 'flex-1'}`}>
        {message.type === 'artifact' && message.artifactHtml && message.artifactType ? (
          <>
            <ArtifactViewer
              html={message.artifactHtml}
              type={message.artifactType}
              topic={message.topic ?? ''}
              onRegenerate={onRegenerate}
              creditsUsed={message.creditsUsed}
            />
            {typeof message.creditsUsed === 'number' && message.creditsUsed > 0 && (
              <div className="mt-1.5 inline-flex items-center gap-2 text-[11px] px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300">
                <Zap className="w-3 h-3" fill="currentColor" />
                <span>{message.creditsUsed} credit{message.creditsUsed === 1 ? '' : 's'} used</span>
                {typeof message.newBalance === 'number' && (
                  <span className="text-muted-foreground">
                    · Balance: {message.newBalance.toFixed(1)}
                  </span>
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
        ) : isUser ? (
          <div className="rounded-2xl bg-primary text-primary-foreground px-4 py-2.5 text-sm whitespace-pre-wrap break-words">
            {message.content}
          </div>
        ) : (
          <div className="text-sm leading-relaxed">
            <MarkdownRenderer>{message.content}</MarkdownRenderer>
          </div>
        )}
      </div>
      {isUser && (
        <div className="shrink-0 w-7 h-7 rounded-lg grid place-items-center bg-card border border-border text-muted-foreground">
          <User className="w-3.5 h-3.5" />
        </div>
      )}
    </div>
  );
};

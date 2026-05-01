import { User, Sparkles, AlertCircle } from 'lucide-react';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { ArtifactViewer } from './ArtifactViewer';
import { LoadingStages } from './LoadingStages';
import type { Message } from '../ChatPage';

interface Props {
  message: Message;
  onRegenerate?: () => void;
  onRetry?: () => void;
  loadingStage?: string;
}

export const MessageBubble = ({ message, onRegenerate, onRetry, loadingStage }: Props) => {
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
          <ArtifactViewer
            html={message.artifactHtml}
            type={message.artifactType}
            topic={message.topic ?? ''}
            onRegenerate={onRegenerate}
            creditsUsed={message.creditsUsed}
          />
        ) : isUser ? (
          <div className="rounded-2xl bg-primary text-primary-foreground px-4 py-2.5 text-sm whitespace-pre-wrap break-words">
            {message.content}
          </div>
        ) : (
          <div className="text-sm leading-relaxed">
            <MarkdownRenderer content={message.content} />
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

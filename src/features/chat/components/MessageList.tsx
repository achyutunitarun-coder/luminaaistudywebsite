import { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import type { Message } from '../ChatPage';

interface Props {
  messages: Message[];
  loadingStage: string;
  onRegenerate: (id: string) => void;
  onRetry: (id: string) => void;
  onEdit?: (id: string, newText: string) => void;
  onTopUp?: () => void;
}

export const MessageList = ({ messages, loadingStage, onRegenerate, onRetry, onEdit, onTopUp }: Props) => {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, loadingStage]);

  return (
    <div className="flex-1 overflow-y-auto py-6 space-y-5">
      {messages.map((m) => (
        <MessageBubble
          key={m.id}
          message={m}
          loadingStage={loadingStage}
          onRegenerate={() => onRegenerate(m.id)}
          onRetry={() => onRetry(m.id)}
          onEdit={onEdit ? (text) => onEdit(m.id, text) : undefined}
          onTopUp={onTopUp}
        />
      ))}
      <div ref={endRef} />
    </div>
  );
};

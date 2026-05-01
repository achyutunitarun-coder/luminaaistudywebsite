/**
 * Lumina AI Chat — full rebuild.
 * Lives entirely inside /src/features/chat/. No imports from other features.
 *
 * Flow: detectIntent → if CHAT, stream a chat reply (free) → if artifact,
 * call attemptGeneration (charges credit only on validated success).
 */

import { useCallback, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from 'sonner';
import { detectIntent, type Intent } from './utils/intentDetector';
import { attemptGeneration } from './utils/generationWrapper';
import { MessageList } from './components/MessageList';
import { InputBar } from './components/InputBar';
import { ModelSelector, type ModelMode } from './components/ModelSelector';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  type: 'text' | 'artifact' | 'error' | 'loading';
  artifactHtml?: string;
  artifactType?: 'notes' | 'exam' | 'slides' | 'code';
  topic?: string;
  creditsUsed?: number;
  timestamp: number;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

// Credit cost map — sourced from external pricing page.
const CREDIT_COST: Record<'notes' | 'exam' | 'slides' | 'code', number> = {
  notes: 1.5,
  exam: 1.5,
  slides: 1.5,
  code: 1.5,
};

const SUGGESTIONS = [
  'Explain quantum entanglement in simple terms',
  'Create notes on photosynthesis',
  'Make an exam paper on thermodynamics',
  'Build me a Snake game',
  'Slides on Newton\'s laws of motion',
  'Quick study on cell division',
];

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const ChatPage = () => {
  const { user } = useAuth();
  const { isPro } = useSubscription();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [model, setModel] = useState<ModelMode>('auto');
  const abortRef = useRef<AbortController | null>(null);
  const lastUserMsgRef = useRef<string>('');

  /** Free chat reply via streaming SSE. */
  const streamChat = useCallback(
    async (history: Message[]) => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const aiMessages = history
        .filter((m) => m.type === 'text')
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content }));

      const { data: { session } } = await supabase.auth.getSession();
      const auth = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const res = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` },
        body: JSON.stringify({ messages: aiMessages, mode: model }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${txt.slice(0, 120)}`);
      }

      // Append empty assistant bubble we'll fill
      const aId = uid();
      setMessages((prev) => [...prev, { id: aId, role: 'assistant', content: '', type: 'text', timestamp: Date.now() }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let acc = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') continue;
          try {
            const parsed = JSON.parse(json);
            const delta = parsed?.choices?.[0]?.delta?.content;
            if (typeof delta === 'string' && delta.length > 0) {
              acc += delta;
              setMessages((prev) =>
                prev.map((m) => (m.id === aId ? { ...m, content: acc } : m)),
              );
            }
          } catch {
            buf = line + '\n' + buf;
            break;
          }
        }
      }

      if (acc.trim().length === 0) {
        // No content arrived → replace bubble with error
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aId
              ? { ...m, type: 'error' as const, content: 'No response received. Please try again.' }
              : m,
          ),
        );
      }
    },
    [model],
  );

  /** Quick-study formatted CHAT response (no artifact, no credit). */
  const runQuickStudy = useCallback(
    async (topic: string, history: Message[]) => {
      const promptMsg: Message = {
        id: uid(),
        role: 'user',
        content: `Create a 10-minute revision guide for: ${topic}.

Format strictly as:
## ⚡ Quick Revision: ${topic}
**Read time: ~10 minutes**

### 1. Key Facts (2 min)
[5–8 bullets]

### 2. Critical Formulas / Definitions (2 min)
[List with brief explanations]

### 3. Common Exam Mistakes (2 min)
[3–4 mistakes]

### 4. Quick Quiz (4 min)
Q1: ... || A: ...
Q2: ... || A: ...
Q3: ... || A: ...

### 5. 60-Second Summary
[2–3 sentences]`,
        type: 'text',
        timestamp: Date.now(),
      };
      // We stream the reply but use the synthesized prompt (don't show it)
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const aiMessages = history
        .filter((m) => m.type === 'text')
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));
      aiMessages.push({ role: 'user', content: promptMsg.content });

      const { data: { session } } = await supabase.auth.getSession();
      const auth = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` },
        body: JSON.stringify({ messages: aiMessages, mode: 'study' }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);

      const aId = uid();
      setMessages((prev) => [...prev, { id: aId, role: 'assistant', content: '', type: 'text', timestamp: Date.now() }]);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '', acc = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') continue;
          try {
            const parsed = JSON.parse(json);
            const delta = parsed?.choices?.[0]?.delta?.content;
            if (typeof delta === 'string') {
              acc += delta;
              setMessages((prev) => prev.map((m) => (m.id === aId ? { ...m, content: acc } : m)));
            }
          } catch { buf = line + '\n' + buf; break; }
        }
      }
    },
    [],
  );

  /** Artifact generation with safe wrapper. */
  const runArtifact = useCallback(
    async (type: 'notes' | 'exam' | 'slides' | 'code', topic: string, originalPrompt: string) => {
      const cost = CREDIT_COST[type];
      const loadingId = uid();
      setMessages((prev) => [
        ...prev,
        { id: loadingId, role: 'assistant', content: `Preparing your ${type}…`, type: 'loading', timestamp: Date.now() },
      ]);

      const result = await attemptGeneration({
        type,
        topic,
        prompt: originalPrompt,
        onStage: (s) => setLoadingStage(s),
      });

      if (result.success) {
        // Charge credit only on successful, validated output (Pro users skip)
        if (!isPro && user) {
          try {
            await supabase.rpc('increment_usage', {
              p_user_id: user.id,
              p_feature: 'chat_messages',
              p_period_type: 'daily',
            });
          } catch (e) {
            console.warn('Credit charge failed (non-blocking):', e);
          }
        }
        setMessages((prev) =>
          prev
            .filter((m) => m.id !== loadingId)
            .concat({
              id: uid(),
              role: 'assistant',
              content: '',
              type: 'artifact',
              artifactHtml: result.content,
              artifactType: type,
              topic,
              creditsUsed: isPro ? 0 : cost,
              timestamp: Date.now(),
            }),
        );
      } else {
        setMessages((prev) =>
          prev
            .filter((m) => m.id !== loadingId)
            .concat({
              id: uid(),
              role: 'assistant',
              content: `Generation failed (${result.error ?? 'unknown'}) — no credits were charged. Please try again.`,
              type: 'error',
              timestamp: Date.now(),
            }),
        );
      }
    },
    [isPro, user],
  );

  const handleSend = useCallback(
    async (overrideText?: string, forcedType?: 'notes' | 'exam' | 'slides' | 'code') => {
      const text = (overrideText ?? input).trim();
      if (!text || loading) return;

      lastUserMsgRef.current = text;
      const userMsg: Message = { id: uid(), role: 'user', content: text, type: 'text', timestamp: Date.now() };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setLoading(true);
      setLoadingStage('Detecting intent…');

      try {
        let intent: Intent;
        let topic = text;
        if (forcedType) {
          intent = (forcedType.toUpperCase() + '_ARTIFACT') as Intent;
          topic = text;
        } else {
          const r = detectIntent(text);
          intent = r.confidence < 0.85 ? 'CHAT' : r.intent;
          topic = r.topic || text;
        }

        if (intent === 'CHAT') {
          setLoadingStage('Thinking…');
          await streamChat([...messages, userMsg]);
        } else if (intent === 'QUICK_STUDY') {
          setLoadingStage('Building 10-minute revision guide…');
          await runQuickStudy(topic, [...messages, userMsg]);
        } else {
          const type =
            intent === 'NOTES_ARTIFACT'  ? 'notes'  :
            intent === 'EXAM_ARTIFACT'   ? 'exam'   :
            intent === 'SLIDES_ARTIFACT' ? 'slides' : 'code';
          setLoadingStage(`Preparing your ${type}…`);
          await runArtifact(type, topic, text);
        }
      } catch (e: any) {
        const isAbort = e?.name === 'AbortError';
        if (!isAbort) {
          setMessages((prev) => [
            ...prev,
            {
              id: uid(),
              role: 'assistant',
              content: e?.message?.includes('429')
                ? 'Too many requests. Please wait 30 seconds.'
                : e?.message ?? 'Something went wrong. Please try again.',
              type: 'error',
              timestamp: Date.now(),
            },
          ]);
        }
      } finally {
        setLoading(false);
        setLoadingStage('');
        abortRef.current = null;
      }
    },
    [input, loading, messages, streamChat, runQuickStudy, runArtifact],
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
    setLoadingStage('');
    toast.info('Stopped.');
  }, []);

  const handleRegenerate = useCallback(() => {
    if (!lastUserMsgRef.current) return;
    handleSend(lastUserMsgRef.current);
  }, [handleSend]);

  const handleRetry = useCallback(() => {
    if (!lastUserMsgRef.current) return;
    handleSend(lastUserMsgRef.current);
  }, [handleSend]);

  const empty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-2rem)]">
      <div className="flex-1 flex flex-col min-h-0 max-w-4xl w-full mx-auto px-2 md:px-4">
        {empty ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 grid place-items-center mb-4">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">How can I help you study?</h1>
            <p className="text-sm text-muted-foreground mb-8 max-w-md">
              Chat is free. Generated notes, exam papers, slides and code each cost 1.5 credits — only when generation succeeds.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full max-w-2xl">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSend(s)}
                  className="text-left text-sm px-3 py-2.5 rounded-xl bg-card/40 border border-border hover:border-primary/40 hover:bg-card/60 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <MessageList
            messages={messages}
            loadingStage={loadingStage}
            onRegenerate={handleRegenerate}
            onRetry={handleRetry}
          />
        )}

        <div className="shrink-0 pb-3 pt-2 space-y-2 sticky bottom-0 bg-gradient-to-t from-background via-background to-transparent">
          <ModelSelector value={model} onChange={setModel} />
          <InputBar
            value={input}
            onChange={setInput}
            onSend={() => handleSend()}
            onStop={handleStop}
            isLoading={loading}
            onPickArtifact={(t) => {
              if (!input.trim()) {
                toast.info('Type a topic first, then pick an artifact type.');
                return;
              }
              handleSend(input, t);
            }}
          />
          <p className="text-[10px] text-center text-muted-foreground/60">
            Lumina can make mistakes. Verify important info. Credits are only charged on successful artifact generation.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;

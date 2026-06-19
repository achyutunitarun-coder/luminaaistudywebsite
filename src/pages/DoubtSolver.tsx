/**
 * DOUBT SOLVER — Complete Rewrite
 * Clean design, proper streaming, no repeated outputs
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Send, Sparkles, User, Copy, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string; id: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const SUGGESTIONS = [
  "Explain photosynthesis",
  "What is Newton's 3rd law?",
  "Help with quadratic equations",
  "Explain quantum entanglement",
];

export default function DoubtSolver() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = useCallback(async (text?: string) => {
    const t = (text || input).trim();
    if (!t || isLoading) return;

    const userMsg: Msg = { role: "user", content: t, id: crypto.randomUUID() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (!s?.access_token) { toast.error("Please sign in."); setIsLoading(false); return; }

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const systemPrompt = "You are Lumina, an adaptive AI tutor. Explain concepts clearly and concisely. Use markdown formatting. Be direct and helpful. Do not repeat yourself.";

      const res = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.access_token}` },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            ...newMessages.map(m => ({ role: m.role, content: m.content })),
          ],
          mode: "conversational",
        }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const assistantId = crypto.randomUUID();
      let fullText = "";

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        let nl;
        while ((nl = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);

          if (line.endsWith("\r")) line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") continue;

          try {
            const parsed = JSON.parse(json);
            const delta = parsed?.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta) {
              fullText += delta;
              setMessages(prev => {
                const existing = prev.find(m => m.id === assistantId);
                if (existing) {
                  return prev.map(m => m.id === assistantId ? { ...m, content: fullText } : m);
                }
                return [...prev, { role: "assistant" as const, content: fullText, id: assistantId }];
              });
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.error(e.message || "Failed to get response");
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [input, isLoading, messages]);

  const handleStop = () => {
    abortRef.current?.abort();
    setIsLoading(false);
  };

  const copyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const empty = messages.length === 0 && !isLoading;

  return (
    <div className="doubt-layout">
      {/* Header */}
      <header className="doubt-header">
        <h1 className="doubt-title">Doubt Solver</h1>
        <p className="doubt-sub">Ask anything. Get instant, clear explanations.</p>
      </header>

      {/* Messages */}
      <div className="doubt-messages">
        {empty && (
          <div className="doubt-empty">
            <Sparkles className="doubt-empty-icon" />
            <h3 className="doubt-empty-title">What's your doubt?</h3>
            <p className="doubt-empty-desc">Ask any question — from basic concepts to advanced problems.</p>
            <div className="doubt-suggestions">
              {SUGGESTIONS.map(q => (
                <button key={q} onClick={() => handleSend(q)} className="doubt-suggestion">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`doubt-msg ${msg.role === "user" ? "doubt-msg-user" : "doubt-msg-ai"}`}>
            {msg.role === "assistant" && (
              <div className="doubt-avatar doubt-avatar-ai">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
            )}
            <div className={`doubt-bubble ${msg.role === "user" ? "doubt-bubble-user" : "doubt-bubble-ai"}`}>
              {msg.role === "assistant" ? (
                <MarkdownRenderer>{msg.content}</MarkdownRenderer>
              ) : (
                <p className="doubt-text">{msg.content}</p>
              )}
              {msg.role === "assistant" && msg.content && (
                <button onClick={() => copyMessage(msg.id, msg.content)} className="doubt-copy">
                  {copiedId === msg.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
              )}
            </div>
            {msg.role === "user" && (
              <div className="doubt-avatar doubt-avatar-user">
                <User className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="doubt-msg doubt-msg-ai">
            <div className="doubt-avatar doubt-avatar-ai">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div className="doubt-bubble doubt-bubble-ai">
              <div className="doubt-loading">
                <div className="doubt-dots">
                  <span /><span /><span />
                </div>
                <span className="doubt-loading-text">Thinking…</span>
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="doubt-input-area">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Ask your doubt…"
          className="doubt-input"
        />
        {isLoading ? (
          <Button onClick={handleStop} className="doubt-stop">
            <Loader2 className="w-4 h-4 animate-spin" />
          </Button>
        ) : (
          <Button onClick={() => handleSend()} disabled={!input.trim()} className="doubt-send">
            <Send className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

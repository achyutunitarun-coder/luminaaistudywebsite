import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowUp, Bot, Brain, Loader2, PauseCircle, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { checkConnection, streamChat, type OllamaConnectionStatus } from "@/lib/ollama";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  status?: "streaming" | "error";
};

const QUICK_PROMPTS = [
  "Explain the difference between React state and props.",
  "Help me write a TypeScript helper for API errors.",
  "Give me a 5-minute study plan for calculus.",
];

const createId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const OllamaChatPage = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaConnectionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    checkConnection().then(setOllamaStatus);
  }, []);

  const canSend = draft.trim().length > 0 && !isLoading;

  const stopGeneration = () => {
    abortRef.current?.abort();
    setIsLoading(false);
    setError("Generation stopped.");
  };

  const sendPrompt = async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = { id: createId(), role: "user", content: trimmed };
    const assistantMessage: ChatMessage = { id: createId(), role: "assistant", content: "", status: "streaming" };

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setDraft("");
    setIsLoading(true);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let content = "";
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      history.push({ role: "user", content: trimmed });

      await streamChat(
        history,
        (token) => {
          content += token;
          setMessages((current) =>
            current.map((message) => (message.id === assistantMessage.id ? { ...message, content } : message))
          );
        },
        { signal: controller.signal }
      );

      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessage.id ? { ...message, status: undefined } : message
        )
      );
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Generation failed.";
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantMessage.id ? { ...item, content: item.content || "The assistant could not produce a response.", status: "error" } : item
        )
      );
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await sendPrompt(draft);
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
    toast.success("Conversation cleared");
  };

  const statusLabel = useMemo(() => {
    if (!ollamaStatus) return "Checking local Ollama connection…";
    if (ollamaStatus.connected && ollamaStatus.modelReady) return ollamaStatus.message;
    if (ollamaStatus.connected) return `Connected — ${ollamaStatus.message}`;
    return ollamaStatus.message;
  }, [ollamaStatus]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_35%),linear-gradient(135deg,_#07111f_0%,_#0f172a_100%)] p-4 text-slate-100 sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-cyan-300">
                <Sparkles className="h-5 w-5" />
                <span className="text-sm font-semibold uppercase tracking-[0.3em]">Local Ollama Chat</span>
              </div>
              <h1 className="text-2xl font-semibold">Lumina is running on your local AI backend.</h1>
              <p className="max-w-2xl text-sm text-slate-400">
                This chat uses the locally installed model qwen2.5-coder:3b through Ollama. It streams responses token by token and keeps the current conversation in memory.
              </p>
            </div>
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
              <div className="flex items-center gap-2">
                {!ollamaStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : ollamaStatus.connected && ollamaStatus.modelReady ? <Brain className="h-4 w-4" /> : <Loader2 className="h-4 w-4" />}
                <span>{statusLabel}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.35fr]">
          <div className="flex min-h-[640px] flex-col rounded-3xl border border-white/10 bg-slate-950/70 shadow-2xl shadow-slate-950/20 backdrop-blur">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-cyan-300" />
                <span className="font-medium">Current session</span>
              </div>
              <button
                type="button"
                onClick={clearChat}
                className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-sm text-slate-300 transition hover:border-cyan-400/40 hover:text-white"
              >
                <Trash2 className="h-4 w-4" />
                Clear
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.length === 0 && (
                <div className="rounded-2xl border border-dashed border-cyan-400/30 bg-cyan-400/10 p-4 text-sm text-slate-300">
                  Start a conversation with Ollama. The reply will stream directly below your prompt.
                </div>
              )}

              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-7 shadow-lg ${
                      message.role === "user"
                        ? "bg-cyan-500 text-slate-950"
                        : "border border-white/10 bg-slate-900/80 text-slate-200"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{message.content || (message.status === "streaming" ? "Thinking…" : "")}</div>
                    {message.status === "streaming" && <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-cyan-300" />}
                  </div>
                </div>
              ))}

              {error && (
                <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                  {error}
                </div>
              )}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-slate-300">
                    <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
                    Streaming response from Ollama…
                  </div>
                </div>
              )}

              <div ref={endRef} />
            </div>

            <form onSubmit={handleSubmit} className="border-t border-white/10 p-4">
              <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-slate-900/70 p-2">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSubmit(event);
                    }
                  }}
                  placeholder="Ask Lumina anything locally…"
                  rows={2}
                  className="min-h-[48px] flex-1 resize-none border-0 bg-transparent px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
                />
                {isLoading ? (
                  <button
                    type="button"
                    onClick={stopGeneration}
                    className="flex items-center gap-2 rounded-xl bg-rose-500/90 px-3 py-2 text-sm font-medium text-white transition hover:bg-rose-400"
                  >
                    <PauseCircle className="h-4 w-4" />
                    Stop
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!canSend}
                    className="flex items-center gap-2 rounded-xl bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ArrowUp className="h-4 w-4" />
                    Send
                  </button>
                )}
              </div>
            </form>
          </div>

          <aside className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/70 p-4 shadow-2xl shadow-slate-950/20 backdrop-blur">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">Quick prompts</h2>
              <div className="mt-3 space-y-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void sendPrompt(prompt)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-3 py-2 text-left text-sm text-slate-300 transition hover:border-cyan-400/40 hover:text-white"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-sm text-cyan-100">
              <p className="font-medium">How to switch models later</p>
              <p className="mt-1 text-cyan-100/80">
                Update the model in your environment variables and the app will use the new Ollama model automatically.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default OllamaChatPage;

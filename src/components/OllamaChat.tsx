import { useCallback, useEffect, useRef, useState } from "react";
import {
  MessageCircle,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Zap,
} from "lucide-react";
import { streamChat, checkStatus } from "@/api/ollamaClient";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  loading?: boolean;
}

export function OllamaChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ healthy: false, modelLoaded: false });
  const [temperature, setTemperature] = useState(0.3);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkOllama = async () => {
      const s = await checkStatus();
      setStatus(s);
      if (!s.healthy) {
        toast.error(s.message);
      }
    };
    checkOllama();
    const interval = setInterval(checkOllama, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || loading || !status.modelLoaded) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      loading: true,
    };

    setMessages((prev) => [...prev, assistantMessage]);

    try {
      let fullContent = "";
      for await (const token of streamChat(input, temperature)) {
        fullContent += token;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? { ...m, content: fullContent }
              : m
          )
        );
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? { ...m, loading: false }
            : m
        )
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Error: ${msg}`);
      setMessages((prev) =>
        prev.filter((m) => m.id !== assistantMessageId)
      );
    } finally {
      setLoading(false);
    }
  }, [input, loading, temperature, status.modelLoaded]);

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="border-b border-slate-700 bg-slate-800/50 backdrop-blur px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageCircle className="w-6 h-6 text-cyan-400" />
            <div>
              <h1 className="text-xl font-bold text-white">Lumina + Ollama</h1>
              <p className="text-sm text-slate-400">Local AI Chat (qwen2.5-coder:3b)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {status.modelLoaded ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <span className="text-sm text-green-400">Ready</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-red-400" />
                <span className="text-sm text-red-400">
                  {status.healthy ? "Model loading..." : "Not connected"}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Zap className="w-12 h-12 text-cyan-400 mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Start a conversation</h2>
            <p className="text-slate-400">Your messages will be processed locally by Ollama</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[70%] rounded-lg px-4 py-3 ${
                  message.role === "user"
                    ? "bg-cyan-600 text-white"
                    : "bg-slate-700 text-slate-100"
                }`}
              >
                <div className="whitespace-pre-wrap break-words">
                  {message.content}
                </div>
                {message.loading && (
                  <div className="flex items-center gap-2 mt-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm opacity-75">Generating...</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-slate-700 bg-slate-800/50 backdrop-blur p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="text-sm text-slate-400">Temperature</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              disabled={loading}
              className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-sm text-cyan-400 font-mono w-8">{temperature.toFixed(1)}</span>
          </div>

          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask anything... (Shift+Enter for new line)"
              disabled={loading || !status.modelLoaded}
              className="flex-1 bg-slate-700 text-white rounded-lg px-4 py-3 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={loading || !status.modelLoaded || !input.trim()}
              className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-600 text-white rounded-lg px-6 py-3 font-semibold transition-colors"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

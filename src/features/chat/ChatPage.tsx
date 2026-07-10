/**
 * LUMINA AI CHAT — Production-Grade UI
 * Linear/Vercel/Notion quality. Every pixel justified.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  MessageSquarePlus, PanelLeftClose, PanelLeftOpen,
  Sparkles, Trash2, Send, Square, Paperclip, Plus, X,
  FileText, Code2, Presentation, BookOpen, Brain, Target,
  User, AlertCircle, Copy, RefreshCw, ThumbsUp, ThumbsDown, Pencil,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { attemptGeneration } from "./utils/generationWrapper";
import { CanvasPanel } from "@/features/canvas/CanvasPanel";
import { detectCanvas, wrapAsHtmlDoc } from "@/features/canvas/canvasDetector";
import { PremiumArtifactWorkspace } from "@/features/artifacts/PremiumArtifactWorkspace";
import { useArtifactStore } from "@/features/artifacts/artifactStore";
import { type ModelMode } from "./components/ModelSelector";

import { CreditsDisplay } from "@/features/credits/CreditsDisplay";
import { BuyCreditsModal } from "@/features/credits/BuyCreditsModal";
import { ManualRestoreButton } from "@/features/credits/ManualRestore";
import { useCreditsStore, creditsActions } from "@/features/credits/useCreditsStore";
import { CREDIT_COSTS, hasEnoughCredits, type CreditAction } from "@/features/credits/creditsSystem";
import { executeAgentAction, type AgentAction } from "@/lib/agent/actions";
import { useMemory } from "@/contexts/MemoryContext";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import { extractToolCallFromText, type OllamaToolCall } from "@/lib/ollama";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

// ─── Types ───
export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  type: "text" | "artifact" | "error" | "loading" | "insufficient_credits" | "action_confirm";
  artifactHtml?: string;
  artifactType?: "notes" | "exam" | "slides" | "code";
  topic?: string;
  creditsUsed?: number;
  newBalance?: number;
  isStreaming?: boolean;
  pendingAction?: AgentAction;
  actionResolved?: boolean;
  actionSummary?: string;
  requiredCredits?: number;
  currentBalance?: number;
  timestamp: number;
}

interface ChatSummary { id: string; title: string; updated_at: string; created_at: string; }

// ─── Constants ───
const uid = () => crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
const titleFrom = (t: string) => { const c = t.replace(/\s+/g, " ").trim(); return c.length > 48 ? c.slice(0, 48).trim() + "…" : c || "New chat"; };

const SUGGESTIONS = [
  { text: "Explain quantum entanglement", icon: Brain, color: "var(--brand)" },
  { text: "Create notes on photosynthesis", icon: BookOpen, color: "var(--teal)" },
  { text: "Make a thermodynamics exam", icon: FileText, color: "var(--amber)" },
  { text: "Build a Snake game", icon: Code2, color: "#38bdf8" },
  { text: "Newton's laws slides", icon: Presentation, color: "#f472b6" },
  { text: "Quick study: cell division", icon: Target, color: "#22d3ee" },
];

const ARTIFACT_TYPES = [
  { id: "notes" as const, icon: FileText, label: "Notes" },
  { id: "exam" as const, icon: Target, label: "Exam" },
  { id: "slides" as const, icon: Presentation, label: "Slides" },
  { id: "code" as const, icon: Code2, label: "Code" },
];

const MODES: { key: ModelMode; label: string }[] = [
  { key: "auto", label: "Auto" },
  { key: "reasoning", label: "Reasoning" },
  { key: "study", label: "Study" },
  { key: "coding", label: "Coding" },
  { key: "deepDive", label: "Deep Dive" },
  { key: "creative", label: "Creative" },
  { key: "fast", label: "Fast" },
];

// ─── Message Bubble ───
const MessageBubble = ({
  message, onRegenerate, onRetry, onEdit, onTopUp,
}: {
  message: Message;
  onRegenerate?: () => void;
  onRetry?: () => void;
  onEdit?: (newText: string) => void;
  onTopUp?: () => void;
  onConfirmAction?: () => void | Promise<void>;
  onCancelAction?: () => void;
}) => {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const isUser = message.role === "user";
  const isStreaming = !!message.isStreaming;

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    toast.success("Copied");
  };

  // User message
  if (isUser) {
    return (
      <div className={`msg-row ${isUser ? "msg-row-user" : "msg-row-assistant"}`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <div className="msg-bubble msg-bubble-user">
          {editing ? (
            <div className="w-full min-w-[280px]">
              <textarea autoFocus value={editText} onChange={(e) => setEditText(e.target.value)} rows={Math.min(8, Math.max(2, editText.split("\n").length))} className="w-full text-sm rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-default)] focus:border-[var(--border-brand)] outline-none p-3 resize-none" style={{ color: "var(--text-primary)" }} />
              <div className="mt-1.5 flex gap-2 justify-end">
                <button type="button" onClick={() => { setEditing(false); setEditText(message.content); }} className="text-xs px-3 py-1.5 rounded-md hover:bg-[var(--bg-hover)] transition-colors" style={{ color: "var(--text-secondary)" }}>Cancel</button>
                <button type="button" onClick={() => { if (!editText.trim()) return; setEditing(false); onEdit?.(editText.trim()); }} className="text-xs px-3 py-1.5 rounded-md bg-[var(--brand)] text-white hover:brightness-110 transition-all">Submit</button>
              </div>
            </div>
          ) : (
            <div>{message.content}</div>
          )}
        </div>
        <div className="msg-avatar msg-avatar-user"><User className="w-3.5 h-3.5" /></div>
        {!editing && hovered && onEdit && (
          <div className="flex gap-1 opacity-60 ml-2">
            <button type="button" onClick={() => { setEditText(message.content); setEditing(true); }} title="Edit" className="w-6 h-6 grid place-items-center rounded-md hover:bg-[var(--bg-hover)] transition-colors" style={{ color: "var(--text-muted)" }}><Pencil className="w-3 h-3" /></button>
            <button type="button" onClick={handleCopy} title="Copy" className="w-6 h-6 grid place-items-center rounded-md hover:bg-[var(--bg-hover)] transition-colors" style={{ color: "var(--text-muted)" }}><Copy className="w-3 h-3" /></button>
          </div>
        )}
      </div>
    );
  }

  // Error
  if (message.type === "error") {
    return (
      <div className="msg-row msg-row-assistant">
        <div className="msg-avatar msg-avatar-ai"><Sparkles className="w-3.5 h-3.5" /></div>
        <div className="msg-bubble msg-bubble-error">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <div className="flex-1 min-w-0">
            <div>{message.content}</div>
            {onRetry && <button type="button" onClick={onRetry} className="mt-2 text-xs px-2.5 py-1 rounded-md transition-colors" style={{ background: "var(--red-tint)", color: "var(--red)" }}>Try again</button>}
          </div>
        </div>
      </div>
    );
  }

  // Loading
  if (message.type === "loading") {
    return (
      <div className="msg-row msg-row-assistant">
        <div className="msg-avatar msg-avatar-ai"><Sparkles className="w-3.5 h-3.5" /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--teal)" }} />
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  // Assistant text
  return (
    <div className="msg-row msg-row-assistant" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="msg-avatar msg-avatar-ai"><Sparkles className="w-3.5 h-3.5" /></div>
      <div className="msg-bubble msg-bubble-ai">
        <MarkdownRenderer>{message.content}</MarkdownRenderer>
        {isStreaming && <span className="msg-streaming-cursor" />}
      </div>
      {hovered && !isStreaming && message.content && (
        <div className="msg-actions">
          <button type="button" onClick={handleCopy} title="Copy" className="msg-action-btn"><Copy className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={onRegenerate} title="Regenerate" className="msg-action-btn"><RefreshCw className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => toast.success("Thanks for the feedback")} title="Good" className="msg-action-btn"><ThumbsUp className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => toast.success("Thanks — we'll improve")} title="Bad" className="msg-action-btn"><ThumbsDown className="w-3.5 h-3.5" /></button>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───
const ChatPage = () => {
  const { user } = useAuth();
    const { isPro } = useSubscription();
    const navigate = useNavigate();
    const credits = useCreditsStore();
    const upsertArtifact = useArtifactStore((s) => s.upsertArtifact);
    const openArtifact = useArtifactStore((s) => s.openArtifact);
    const activeArtifactId = useArtifactStore((s) => s.activeArtifactId);
    const [messages, setMessages] = useState<Message[]>([]);
    const empty = messages.length === 0;
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadingStage, setLoadingStage] = useState("");
    const [model, setModel] = useState<ModelMode>("auto");
    const [buyOpen, setBuyOpen] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(() => typeof window === "undefined" || window.innerWidth >= 768);
    const [chatSessions, setChatSessions] = useState<ChatSummary[]>([]);
    const [currentChatId, setCurrentChatId] = useState<string | null>(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [showArtifactPicker, setShowArtifactPicker] = useState(false);
    const [canvasOpen, setCanvasOpen] = useState(false);
    const [canvasVersions, setCanvasVersions] = useState<Array<{ code: string; html: string; ts: number }>>([]);
    // (removed local-Ollama status — chat goes through the edge function)


    const abortRef = useRef<AbortController | null>(null);
    const loadingRef = useRef(false);
    const currentChatIdRef = useRef<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [artifactBarOpen, setArtifactBarOpen] = useState(false);

    useEffect(() => { currentChatIdRef.current = currentChatId; }, [currentChatId]);

    useEffect(() => {
      const el = messagesEndRef.current;
      if (!el) return;
      const parent = el.closest(".chat-messages") || el.parentElement;
      if (!parent) return;
      const atBottom = parent.scrollHeight - parent.scrollTop - parent.clientHeight < 80;
      if (atBottom) el.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // no-op: chat runs through the server edge function; no local status probe needed

    useEffect(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.style.height = "auto";
        ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
        ta.style.overflowY = ta.scrollHeight > 200 ? "auto" : "hidden";
      }
    }, [input]);

    useEffect(() => {
      try {
        const i = localStorage.getItem("lumina_canvas_import");
        if (i) { setCanvasVersions([{ code: i, html: wrapAsHtmlDoc(i, /<!doctype html|<html/i.test(i) ? "html" : "html"), ts: Date.now() }]); setCanvasOpen(true); localStorage.removeItem("lumina_canvas_import"); }
      } catch { /* ignore */ }
    }, []);

    const pushCanvasFromMessage = useCallback((text: string) => {
      const f = detectCanvas(text);
      if (!f) return;
      setCanvasVersions(p => [...p, { code: f.code, html: wrapAsHtmlDoc(f.code, f.lang), ts: Date.now() }].slice(-20));
      setCanvasOpen(true);
    }, []);

    const refreshChats = useCallback(async () => {
      if (!user) { setChatSessions([]); setCurrentChatId(null); currentChatIdRef.current = null; return; }
      const { data, error } = await supabase.from("chats").select("id,title,created_at,updated_at").eq("user_id", user.id).eq("chat_type", "general").order("updated_at", { ascending: false }).limit(40);
      if (!error) setChatSessions((data ?? []) as ChatSummary[]);
    }, [user]);

    useEffect(() => { refreshChats(); }, [refreshChats]);

    const ensureChat = useCallback(async (t: string): Promise<string | null> => {
      if (!user) return null;
      if (currentChatIdRef.current) return currentChatIdRef.current;
      const { data, error } = await supabase.from("chats").insert({ user_id: user.id, title: titleFrom(t), chat_type: "general" }).select("id,title,created_at,updated_at").single();
      if (error || !data) return null;
      const c = data as ChatSummary;
      setCurrentChatId(c.id); currentChatIdRef.current = c.id;
      setChatSessions(p => [c, ...p.filter(x => x.id !== c.id)]);
      return c.id;
    }, [user]);

    const persistMessage = useCallback(async (chatId: string | null, msg: Message) => {
      if (!chatId || !user || msg.type === "loading" || msg.role === "system") return;
      if (msg.role !== "user" && msg.role !== "assistant") return;
      try {
        await (supabase as any).from("chat_messages").upsert({
          id: msg.id, chat_id: chatId, role: msg.role, content: msg.content || "",
          message_type: msg.type, artifact_type: msg.artifactType ?? null,
          artifact_html: msg.artifactHtml ?? null, topic: msg.topic ?? null,
          credits_used: msg.creditsUsed ?? null, new_balance: msg.newBalance ?? null,
        }, { onConflict: "id" });
      } catch { /* ignore */ }
    }, [user]);

    const loadChat = useCallback(async (chat: ChatSummary) => {
      setHistoryLoading(true);
      try {
        const { data, error } = await (supabase as any).from("chat_messages").select("id,role,content,created_at,message_type,artifact_type,artifact_html,topic,credits_used,new_balance").eq("chat_id", chat.id).order("created_at", { ascending: true });
        if (error) throw error;
        setCurrentChatId(chat.id); currentChatIdRef.current = chat.id;
        setMessages(((data ?? []) as any[]).map(r => ({
          id: r.id, role: r.role, content: r.content ?? "", type: (r.message_type || "text") as Message["type"],
          artifactType: r.artifact_type ?? undefined, artifactHtml: r.artifact_html ?? undefined,
          topic: r.topic ?? undefined, timestamp: new Date(r.created_at).getTime(),
        })));
        setHistoryOpen(false);
      } catch (e: any) { toast.error(e?.message ?? "Could not open chat."); }
      finally { setHistoryLoading(false); }
    }, []);

    const startNewChat = useCallback(() => {
      abortRef.current?.abort(); setCurrentChatId(null); currentChatIdRef.current = null;
      setMessages([]); setInput(""); setLoading(false); setLoadingStage("");
    }, []);

    const deleteChat = useCallback(async (id: string) => {
      if (!user) return;
      const { error } = await supabase.from("chats").delete().eq("id", id).eq("user_id", user.id);
      if (error) { toast.error("Could not delete."); return; }
      setChatSessions(p => p.filter(c => c.id !== id));
      if (currentChatIdRef.current === id) startNewChat();
    }, [startNewChat, user]);

    const executeToolCalls = useCallback(async (toolCalls: OllamaToolCall[], history: Message[], chatId: string | null) => {
      for (const tc of toolCalls) {
        if (tc.function.name === "create_artifact") {
          try {
            const args = JSON.parse(tc.function.arguments);
            const type = args.type as "notes" | "exam" | "slides" | "code";
            const topic = args.topic || "";
            const content = args.content || "";
            const msg: Message = {
              id: uid(), role: "assistant", type: "artifact",
              content: "", artifactHtml: content, artifactType: type,
              topic, timestamp: Date.now(),
            };
            setMessages(p => [...p, msg]);
            upsertArtifact({
              id: msg.id, type, title: topic, html: content,
              createdAt: msg.timestamp, sourceMessageId: msg.id,
              contextMessageIds: [], summary: `Created ${type}`,
            });
            openArtifact(msg.id);
            await persistMessage(chatId, msg);
          } catch { /* ignore parse errors */ }
        }
      }
    }, [upsertArtifact, openArtifact, persistMessage]);

    const streamChat = useCallback(async (history: Message[], chatId: string | null) => {
      abortRef.current?.abort();
      const ctrl = new AbortController(); abortRef.current = ctrl;
      const aId = uid();
      const assistantPlaceholder: Message = {
        id: aId, role: "assistant", content: "", type: "text",
        isStreaming: true, timestamp: Date.now(),
      };
      setMessages(p => [...p, assistantPlaceholder]);
      let acc = "";

      const status = await checkConnection();
      setOllamaStatus(status);
      if (!status.connected) {
        const final: Message = {
          id: aId, role: "assistant", type: "error",
          content: `Ollama unavailable — please make sure Ollama is running on your laptop with OLLAMA_ORIGINS=*`,
          timestamp: Date.now(),
        };
        setMessages(p => p.map(m => m.id === aId ? final : m));
        await persistMessage(chatId, final);
        return;
      }
      if (!status.modelReady) {
        const final: Message = {
          id: aId, role: "assistant", type: "error",
          content: `Model not found. Run: ollama pull ${MODEL_NAME}`,
          timestamp: Date.now(),
        };
        setMessages(p => p.map(m => m.id === aId ? final : m));
        await persistMessage(chatId, final);
        return;
      }

      // Send as Ollama chat messages
      const aiMessages = history.filter(m => m.type === "text").slice(-12).map(m => ({ role: m.role, content: m.content }));

      let result: { text: string; toolCalls?: OllamaToolCall[] };
      try {
        result = await ollamaStream(aiMessages, (token) => {
          acc += token;
          setMessages(p => p.map(m => m.id === aId ? { ...m, content: acc } : m));
        }, { signal: ctrl.signal, tools: TOOLS });
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        const final: Message = {
          id: aId, role: "assistant", type: "error",
          content: err?.message ?? "Ollama request failed.",
          timestamp: Date.now(),
        };
        setMessages(p => p.map(m => m.id === aId ? { ...m, isStreaming: false, ...final } : m));
        await persistMessage(chatId, final);
        return;
      }

      // Handle tool calls
      let toolCalls = result.toolCalls;

      // If no tool_calls but content has JSON, try extracting
      if ((!toolCalls || toolCalls.length === 0) && result.text) {
        const extracted = extractToolCallFromText(result.text);
        if (extracted) {
          toolCalls = [extracted];
          // Retry once with a system message instructing tool-calling interface
          const retryMessages = [
            ...aiMessages,
            { role: "assistant" as const, content: result.text },
            { role: "system" as const, content: "You MUST use the tool-calling interface only. Do NOT output tool calls as raw text. Call the function using the proper tool_calls format." },
            { role: "user" as const, content: "Please use the tool calling interface to complete your previous request." },
          ];
          try {
            const retryResult = await ollamaStream(retryMessages, undefined, { signal: ctrl.signal, tools: TOOLS });
            if (retryResult.toolCalls && retryResult.toolCalls.length > 0) {
              toolCalls = retryResult.toolCalls;
              acc = retryResult.text || acc;
            }
          } catch { /* keep original result */ }
        }
      }

      // Execute tool calls
      if (toolCalls && toolCalls.length > 0) {
        setMessages(p => p.map(m => m.id === aId ? { ...m, isStreaming: false } : m));
        await executeToolCalls(toolCalls, history, chatId);
        return;
      }

      // Plain text response
      const final: Message = acc.trim().length === 0
        ? { id: aId, role: "assistant", type: "error", content: "No response received.", timestamp: Date.now() }
        : { id: aId, role: "assistant", type: "text", content: acc, timestamp: Date.now() };
      setMessages(p => p.map(m => m.id === aId ? final : m));
      await persistMessage(chatId, final);
      if (final.type === "text") pushCanvasFromMessage(final.content);
    }, [persistMessage, pushCanvasFromMessage, executeToolCalls]);

    const runArtifact = useCallback(async (type: "notes" | "exam" | "slides" | "code", topic: string, originalPrompt: string, chatId: string | null) => {
      const action = `${type}_artifact` as CreditAction; const cost = CREDIT_COSTS[action];
      if (!isPro && !hasEnoughCredits(action, credits.balance)) { setBuyOpen(true); return; }
      const lid = uid();
      setMessages(p => [...p, { id: lid, role: "assistant", content: `Creating your ${type}…`, type: "loading", timestamp: Date.now() }]);
      try {
        const result = await attemptGeneration({ type, topic, prompt: originalPrompt, chatId: chatId ?? undefined, timeoutMs: 540_000, maxRetries: 1, onStage: setLoadingStage });
        if (result.success) {
          let nb = credits.balance;
          if (!isPro) {
            try { const { data } = await (supabase as any).rpc("spend_user_credits", { _amount: cost, _action: action.replace(/_/g, " ") }); const r = Array.isArray(data) ? data[0] : data; if (r?.success && typeof r.balance !== "undefined") { nb = Number(r.balance); credits.setBalance(nb); } else { creditsActions.deduct(action); nb = Math.max(0, +(credits.balance - cost).toFixed(2)); } }
            catch { creditsActions.deduct(action); nb = Math.max(0, +(credits.balance - cost).toFixed(2)); }
          }
          const msg: Message = { id: uid(), role: "assistant", type: "artifact", content: "", artifactHtml: result.content, artifactType: type, topic, creditsUsed: isPro ? 0 : cost, newBalance: nb, timestamp: Date.now() };
          upsertArtifact({ id: msg.id, type, title: topic, html: result.content, createdAt: msg.timestamp, sourceMessageId: msg.id, contextMessageIds: [], summary: `Created ${type}` });
          openArtifact(msg.id); setMessages(p => p.filter(m => m.id !== lid).concat(msg)); await persistMessage(chatId, msg);
        } else { setMessages(p => p.filter(m => m.id !== lid).concat({ id: uid(), role: "assistant", type: "error", content: "Generation failed — no credits charged.", timestamp: Date.now() })); }
      } catch { setMessages(p => p.filter(m => m.id !== lid).concat({ id: uid(), role: "assistant", type: "error", content: "Generation failed — no credits charged.", timestamp: Date.now() })); }
    }, [credits.balance, isPro, upsertArtifact, openArtifact, persistMessage]);

    const handleSend = useCallback(async (text?: string, artifactType?: "notes" | "exam" | "slides" | "code") => {
      const t = (text || input).trim();
      if (!t || loadingRef.current) return;

      // Explicit artifact generation (via artifact picker or quick buttons)
      if (artifactType) {
        setShowArtifactPicker(false);
        const cid = await ensureChat(t);
        if (cid) {
          await runArtifact(artifactType, t, t, cid);
          setInput("");
        }
        return;
      }

      // Check if user explicitly requested artifact generation
      const artMatch = t.match(/^(create|generate|make|build|write|draft)\s+(a|an|me|some)?\s*(notes?|exam|test|quiz|slides?|presentation|deck|code|app|game|website)\s+(on|for|about)\s+(.+)/i);
      if (artMatch) {
        const artTypeRaw = artMatch[3].toLowerCase();
        const artTopic = artMatch[5].trim();
        const artType = /\b(exam|test|quiz)\b/.test(artTypeRaw) ? "exam"
          : /\b(slides?|presentation|deck)\b/.test(artTypeRaw) ? "slides"
          : /\b(code|app|game|website)\b/.test(artTypeRaw) ? "code"
          : "notes";
        const cid = await ensureChat(artTopic);
        if (cid) {
          await runArtifact(artType, artTopic, t, cid);
          setInput("");
        }
        return;
      }

      // Normal chat flow
      const cid = await ensureChat(t);
      if (!cid) return;

      const um: Message = { id: uid(), role: "user", content: t, type: "text", timestamp: Date.now() };
      const updatedMessages = [...messages, um];
      setMessages(updatedMessages);
      setInput("");
      loadingRef.current = true;
      setLoading(true);
      setLoadingStage("Thinking…");

      await persistMessage(cid, um);
      logActivity("chat_sent", "chat", t.slice(0, 80), { page: "/chat" });

      try {
        await streamChat(updatedMessages, cid);
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          setMessages(current => current.filter(m => m.type !== "loading").concat({
            id: uid(), role: "assistant", type: "error" as const,
            content: e?.message ?? "Something went wrong. Please try again.",
            timestamp: Date.now(),
          }));
        }
      } finally {
        loadingRef.current = false;
        setLoading(false);
        setLoadingStage("");
      }
    }, [input, loading, messages, ensureChat, streamChat, persistMessage, runArtifact]);

    const handleRegenerate = useCallback(async (mid: string) => {
      if (loadingRef.current) return;
      const idx = messages.findIndex(m => m.id === mid);
      if (idx < 0) return;
      const cid = currentChatIdRef.current;
      if (!cid) return;
      abortRef.current?.abort();
      const removed = messages.slice(idx);
      const toDelete = removed.filter(m => m.role === "assistant" && m.type !== "error").map(m => m.id);
      setMessages(p => p.slice(0, idx));
      loadingRef.current = true; setLoading(true);
      try {
        await streamChat(messages.slice(0, idx), cid);
        if (toDelete.length > 0 && user) {
          supabase.from("chat_messages").delete().in("id", toDelete).eq("chat_id", cid).then(() => {}).catch(() => {});
        }
      } catch { /* ignore */ }
      finally { loadingRef.current = false; setLoading(false); }
    }, [messages, streamChat, user]);
    const handleRetry = useCallback(async (mid: string) => { await handleRegenerate(mid); }, [handleRegenerate]);
    const handleEdit = useCallback(async (mid: string, nt: string) => {
      if (loadingRef.current) return;
      const idx = messages.findIndex(m => m.id === mid);
      if (idx < 0) return;
      const cid = currentChatIdRef.current;
      if (!cid) return;
      abortRef.current?.abort();
      const removed = messages.slice(idx);
      const toDelete = removed.filter(m => m.role === "assistant" && m.type !== "error").map(m => m.id);
      const edited = { ...messages[idx], content: nt };
      setMessages(p => p.slice(0, idx).concat(edited));
      loadingRef.current = true; setLoading(true);
      try {
        await streamChat(messages.slice(0, idx).concat(edited), cid);
        if (toDelete.length > 0 && user) {
          supabase.from("chat_messages").delete().in("id", toDelete).eq("chat_id", cid).then(() => {}).catch(() => {});
        }
      } catch { /* ignore */ }
      finally { loadingRef.current = false; setLoading(false); }
    }, [messages, streamChat, user]);
    const handleConfirmAction = useCallback(async (mid: string) => { const msg = messages.find(m => m.id === mid); if (!msg?.pendingAction) return; setMessages(p => p.map(m => m.id === mid ? { ...m, actionResolved: true } : m)); const result = await executeAgentAction(msg.pendingAction, p => navigate(p)); setMessages(p => p.concat({ id: uid(), role: "assistant", type: "text", content: result.message, timestamp: Date.now() })); }, [messages, navigate]);
    const handleCancelAction = useCallback((mid: string) => { setMessages(p => p.map(m => m.id === mid ? { ...m, actionResolved: true } : m)); }, []);
    const handleStop = useCallback(() => { abortRef.current?.abort(); loadingRef.current = false; setLoading(false); setLoadingStage(""); }, []);

    const { logActivity } = useMemory();

    useEffect(() => {
      logActivity("page_view", "navigation", "Viewed Chat", { page: "/chat" });
    }, [logActivity]);

  return (
    <div className="chat-root">
      <AnimatePresence>
        {historyOpen && (
          <motion.aside initial={{ width: 0, opacity: 0 }} animate={{ width: 260, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="chat-sidebar">
            <div className="chat-sidebar-header">
              <button onClick={startNewChat} className="chat-sidebar-new-btn"><Plus className="w-4 h-4" /> New Chat</button>
            </div>
            <div className="chat-sidebar-list">
              {chatSessions.map(chat => (
                <div key={chat.id} onClick={() => loadChat(chat)} className={`chat-sidebar-item ${currentChatId === chat.id ? "active" : ""}`}>
                  <span className="chat-sidebar-item-title">{chat.title}</span>
                  <button onClick={e => { e.stopPropagation(); deleteChat(chat.id); }} className="chat-sidebar-item-delete" title="Delete"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
              {chatSessions.length === 0 && <div className="text-center p-3 text-xs" style={{ color: "var(--text-muted)" }}>No conversations yet</div>}
            </div>
            <div className="chat-sidebar-footer"><CreditsDisplay onClick={() => setBuyOpen(true)} /></div>
          </motion.aside>
        )}
      </AnimatePresence>

      <div className="chat-main">
        <div className="chat-topbar">
          <div className="chat-topbar-left">
            <button onClick={() => setHistoryOpen(v => !v)} className="chat-topbar-btn">
              {historyOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>
            <div className="chat-topbar-title">
              <div className="chat-topbar-logo"><Sparkles className="w-3.5 h-3.5" /></div>
              <span className="chat-topbar-name">Lumina AI</span>
              <span className="flex items-center gap-1 ml-1.5" title={ollamaStatus?.message || "Checking…"}>
                <span className={`w-1.5 h-1.5 rounded-full ${!ollamaStatus ? "bg-amber-500 animate-pulse" : ollamaStatus.connected && ollamaStatus.modelReady ? "bg-green-500" : ollamaStatus.connected ? "bg-yellow-500" : "bg-red-500"}`} />
              </span>
              {loading && <span className="flex items-center gap-1.5 text-[10px] font-medium ml-2" style={{ color: "var(--teal)" }}><span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--teal)" }} />Thinking…</span>}
            </div>
          </div>
          <div className="chat-topbar-center">
            <div className="chat-mode-pills">
              {MODES.map(m => <button key={m.key} onClick={() => setModel(m.key)} className={`chat-mode-pill ${model === m.key ? "active" : ""}`}>{m.label}</button>)}
            </div>
          </div>
          <div className="chat-topbar-right">
            <button onClick={startNewChat} className="chat-topbar-btn hidden sm:inline-flex"><MessageSquarePlus className="w-3.5 h-3.5" /> New</button>
            <CreditsDisplay onClick={() => setBuyOpen(true)} />
            <ManualRestoreButton />
          </div>
        </div>

        <div className="chat-content">
          {empty ? (
            <div className="chat-empty">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as const }} className="chat-empty-hero">
                <div className="chat-empty-icon"><Sparkles className="w-8 h-8" style={{ color: "var(--brand-glow)" }} /></div>
                <h1 className="chat-empty-heading">How can I help you study?</h1>
                <p className="chat-empty-sub">Generate notes, exams, slides, code, and explanations instantly.</p>
              </motion.div>
              <div className="chat-suggestions">
                {SUGGESTIONS.map((s, i) => (
                  <motion.button key={s.text} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.04, duration: 0.35, ease: [0.16, 1, 0.3, 1] as const }} onClick={() => handleSend(s.text)} className="chat-suggestion-card">
                    <div className="chat-suggestion-icon-wrap"><s.icon className="w-4 h-4" style={{ color: s.color }} /></div>
                    <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{s.text}</span>
                  </motion.button>
                ))}
              </div>
              <div className="chat-artifact-bar">
                <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Or generate:</span>
                {ARTIFACT_TYPES.map(a => <button key={a.id} onClick={() => setShowArtifactPicker(true)} className="chat-artifact-btn"><a.icon className="w-3 h-3" /> {a.label}</button>)}
              </div>
              {showArtifactPicker && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="chat-artifact-input">
                  <span className="text-xs mr-1" style={{ color: "var(--text-muted)" }}>Topic:</span>
                  <input autoFocus placeholder="e.g. Photosynthesis" className="flex-1 bg-transparent border-none outline-none text-sm" style={{ color: "var(--text-primary)" }}
                    onKeyDown={e => { if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) { handleSend((e.target as HTMLInputElement).value, ARTIFACT_TYPES[0].id); setShowArtifactPicker(false); } if (e.key === "Escape") setShowArtifactPicker(false); }}
                  />
                  <button onClick={() => setShowArtifactPicker(false)} className="p-1 rounded" style={{ color: "var(--text-muted)" }}><X className="w-3.5 h-3.5" /></button>
                </motion.div>
              )}
            </div>
          ) : (
            <div className="chat-messages">
              {messages.map(m => (
                <MessageBubble key={m.id} message={m}
                  onRegenerate={() => handleRegenerate(m.id)} onRetry={() => handleRetry(m.id)}
                  onEdit={(text) => handleEdit(m.id, text)} onTopUp={() => setBuyOpen(true)}
                  onConfirmAction={handleConfirmAction ? () => handleConfirmAction(m.id) : undefined}
                  onCancelAction={handleCancelAction ? () => handleCancelAction(m.id) : undefined}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="chat-input-area">
          <div className="chat-input-box">
            <button type="button" className="chat-input-btn" title="Attach file"><Paperclip className="w-4 h-4" /></button>
            <textarea ref={textareaRef} rows={1} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!loading && input.trim()) handleSend(); } }}
              placeholder="Ask anything…" className="chat-textarea"
            />
            {loading ? (
              <button type="button" onClick={handleStop} className="chat-stop-btn" title="Stop"><Square className="w-3.5 h-3.5" style={{ fill: "currentColor" }} /></button>
            ) : (
              <button type="button" onClick={() => input.trim() && handleSend()} disabled={!input.trim()} className="chat-send-btn" title="Send"><Send className="w-4 h-4" /></button>
            )}
          </div>
          <p className="chat-disclaimer">Model: qwen2.5-coder:3b (local Ollama) · Press ⌘↵ to send · Shift↵ for new line</p>
        </div>

        <BuyCreditsModal open={buyOpen} onOpenChange={setBuyOpen} />
      </div>

      {canvasOpen && <div className="hidden md:flex" style={{ flex: "0 0 54%", minWidth: 0 }}><CanvasPanel open={canvasOpen} versions={canvasVersions} onClose={() => setCanvasOpen(false)} /></div>}
      {activeArtifactId && <PremiumArtifactWorkspace messages={messages} onQuote={t => setInput(p => `${p}${p ? "\n\n" : ""}${t}`)} onRegenerate={id => handleRegenerate(id)} />}
    </div>
  );
};

export default ChatPage;

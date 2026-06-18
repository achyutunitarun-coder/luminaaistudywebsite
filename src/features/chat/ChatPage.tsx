/**
 * Lumina AI Chat — Cinematic Production-Grade UI
 * Complete visual rewrite. Every pixel has purpose.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  MessageSquarePlus, PanelLeftClose, PanelLeftOpen,
  Sparkles, Trash2, Send, Square, Paperclip, Plus, X,
  FileText, Code2, Presentation, BookOpen, Brain, Target,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";
import { detectIntent } from "./utils/intentDetector";
import { attemptGeneration } from "./utils/generationWrapper";
import { MessageList } from "./components/MessageList";
import { CanvasPanel } from "@/features/canvas/CanvasPanel";
import { detectCanvas, wrapAsHtmlDoc } from "@/features/canvas/canvasDetector";
import { PremiumArtifactWorkspace } from "@/features/artifacts/PremiumArtifactWorkspace";
import { useArtifactStore } from "@/features/artifacts/artifactStore";
import { ModelSelector, type ModelMode } from "./components/ModelSelector";
import { CreditsDisplay } from "@/features/credits/CreditsDisplay";
import { BuyCreditsModal } from "@/features/credits/BuyCreditsModal";
import { ManualRestoreButton } from "@/features/credits/ManualRestore";
import { useCreditsStore, creditsActions } from "@/features/credits/useCreditsStore";
import { CREDIT_COSTS, hasEnoughCredits, type CreditAction } from "@/features/credits/creditsSystem";
import { planAction, planToAction, executeAgentAction, actionRequiresConfirmation, type AgentAction } from "@/lib/agent/actions";
import { useNavigate } from "react-router-dom";

export interface Message {
  id: string; role: "user" | "assistant" | "system"; content: string;
  type: "text" | "artifact" | "error" | "loading" | "insufficient_credits" | "action_confirm";
  artifactHtml?: string; artifactType?: "notes" | "exam" | "slides" | "code";
  topic?: string; creditsUsed?: number; newBalance?: number;
  requiredCredits?: number; currentBalance?: number;
  isStreaming?: boolean; pendingAction?: AgentAction;
  actionSummary?: string; actionResolved?: boolean; timestamp: number;
}
type ChatSummary = { id: string; title: string; updated_at: string; created_at: string; };
type SavedMessageRow = {
  id: string; role: "user" | "assistant"; content: string; created_at: string;
  message_type?: Message["type"]; artifact_type?: Message["artifactType"] | null;
  artifact_html?: string | null; topic?: string | null;
  credits_used?: number | string | null; new_balance?: number | string | null;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const uid = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
const titleFrom = (text: string) => { const c = text.replace(/\s+/g, " ").trim(); return c.length > 48 ? `${c.slice(0, 48).trim()}…` : c || "New chat"; };
const toNumber = (v: number | string | null | undefined) => { if (typeof v === "number") return v; if (typeof v === "string") { const n = Number(v); return Number.isFinite(n) ? n : undefined; } return undefined; };
const rowToMessage = (row: SavedMessageRow): Message => ({ id: row.id, role: row.role, content: row.content ?? "", type: (row.message_type || "text") as Message["type"], artifactType: row.artifact_type ?? undefined, artifactHtml: row.artifact_html ?? undefined, topic: row.topic ?? undefined, creditsUsed: toNumber(row.credits_used), newBalance: toNumber(row.new_balance), timestamp: new Date(row.created_at).getTime() });

const SUGGESTIONS = [
  { text: "Explain quantum entanglement", icon: Brain, color: "#a855f7" },
  { text: "Create notes on photosynthesis", icon: BookOpen, color: "#2dd4bf" },
  { text: "Make a thermodynamics exam", icon: FileText, color: "#fbbf24" },
  { text: "Build a Snake game", icon: Code2, color: "#38bdf8" },
  { text: "Newton's laws slides", icon: Presentation, color: "#f472b6" },
  { text: "Quick study: cell division", icon: Target, color: "#22d3ee" },
];

const artifactTypes = [
  { id: "notes" as const, icon: FileText, label: "Notes" },
  { id: "exam" as const, icon: Target, label: "Exam" },
  { id: "slides" as const, icon: Presentation, label: "Slides" },
  { id: "code" as const, icon: Code2, label: "Code" },
];

const ChatPage = () => {
  const { user } = useAuth();
  const { isPro } = useSubscription();
  const navigate = useNavigate();
  const credits = useCreditsStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState("");
  const [model, setModel] = useState<ModelMode>("auto");
  const [buyOpen, setBuyOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(() => typeof window === "undefined" ? true : window.innerWidth >= 768);
  const [chatSessions, setChatSessions] = useState<ChatSummary[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [artifactSplit, setArtifactSplit] = useState(40);
  const [showArtifactPicker, setShowArtifactPicker] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const lastUserMsgRef = useRef<string>("");
  const currentChatIdRef = useRef<string | null>(null);
  const upsertArtifact = useArtifactStore((s) => s.upsertArtifact);
  const openArtifact = useArtifactStore((s) => s.openArtifact);
  const activeArtifactId = useArtifactStore((s) => s.activeArtifactId);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [canvasVersions, setCanvasVersions] = useState<Array<{ code: string; html: string; ts: number }>>([]);

  useEffect(() => { try { const i = localStorage.getItem("lumina_canvas_import"); if (i) { setCanvasVersions([{ code: i, html: wrapAsHtmlDoc(i, /<!doctype html|<html/i.test(i) ? "html" : "html"), ts: Date.now() }]); setCanvasOpen(true); localStorage.removeItem("lumina_canvas_import"); } } catch {} }, []);
  const pushCanvasFromMessage = useCallback((text: string) => { const f = detectCanvas(text); if (!f) return; setCanvasVersions(p => [...p, { code: f.code, html: wrapAsHtmlDoc(f.code, f.lang), ts: Date.now() }].slice(-20)); setCanvasOpen(true); }, []);
  useEffect(() => { currentChatIdRef.current = currentChatId; }, [currentChatId]);
  useEffect(() => { const h = (e: Event) => { const d = (e as CustomEvent<number>).detail; if (typeof d === "number") setArtifactSplit(d); }; window.addEventListener("lumina-artifact-split", h); return () => window.removeEventListener("lumina-artifact-split", h); }, []);
  useEffect(() => { messages.forEach((m, i) => { if (m.type !== "artifact" || !m.artifactHtml || !m.artifactType) return; upsertArtifact({ id: m.id, type: m.artifactType, title: m.topic || "Untitled", html: m.artifactHtml, createdAt: m.timestamp, sourceMessageId: m.id, contextMessageIds: messages.slice(Math.max(0, i - 6), i + 1).map(x => x.id), summary: "Restored from chat" }); }); }, [messages, upsertArtifact]);

  const refreshChats = useCallback(async () => { if (!user) { setChatSessions([]); setCurrentChatId(null); currentChatIdRef.current = null; return; } const { data, error } = await supabase.from("chats").select("id,title,created_at,updated_at").eq("user_id", user.id).eq("chat_type", "general").order("updated_at", { ascending: false }).limit(40); if (error) return; setChatSessions((data ?? []) as ChatSummary[]); }, [user]);
  useEffect(() => { refreshChats(); }, [refreshChats]);
  const ensureChat = useCallback(async (t: string): Promise<string | null> => { if (!user) return null; if (currentChatIdRef.current) return currentChatIdRef.current; const { data, error } = await supabase.from("chats").insert({ user_id: user.id, title: titleFrom(t), chat_type: "general" }).select("id,title,created_at,updated_at").single(); if (error || !data) return null; const c = data as ChatSummary; setCurrentChatId(c.id); currentChatIdRef.current = c.id; setChatSessions(p => [c, ...p.filter(x => x.id !== c.id)]); return c.id; }, [user]);
  const touchChat = useCallback(async (id: string) => { setChatSessions(p => p.map(c => c.id === id ? { ...c, updated_at: new Date().toISOString() } : c)); await supabase.from("chats").update({ updated_at: new Date().toISOString() }).eq("id", id); }, []);
  const persistMessage = useCallback(async (chatId: string | null, msg: Message) => { if (!chatId || !user || msg.type === "loading" || msg.role === "system" || (msg.role !== "user" && msg.role !== "assistant")) return; try { await (supabase as any).from("chat_messages").upsert({ id: msg.id, chat_id: chatId, role: msg.role, content: msg.content || "", message_type: msg.type, artifact_type: msg.artifactType ?? null, artifact_html: msg.artifactHtml ?? null, topic: msg.topic ?? null, credits_used: msg.creditsUsed ?? null, new_balance: msg.newBalance ?? null }, { onConflict: "id" }); await touchChat(chatId); } catch {} }, [touchChat, user]);
  const loadChat = useCallback(async (chat: ChatSummary) => { setHistoryLoading(true); try { const { data, error } = await (supabase as any).from("chat_messages").select("id,role,content,created_at,message_type,artifact_type,artifact_html,topic,credits_used,new_balance").eq("chat_id", chat.id).order("created_at", { ascending: true }); if (error) throw error; setCurrentChatId(chat.id); currentChatIdRef.current = chat.id; setMessages(((data ?? []) as SavedMessageRow[]).map(rowToMessage)); setHistoryOpen(false); } catch (e: any) { toast.error(e?.message ?? "Could not open chat."); } finally { setHistoryLoading(false); } }, []);
  const startNewChat = useCallback(() => { abortRef.current?.abort(); setCurrentChatId(null); currentChatIdRef.current = null; setMessages([]); setInput(""); setLoading(false); setLoadingStage(""); }, []);
  const deleteChat = useCallback(async (id: string) => { if (!user) return; const { error } = await supabase.from("chats").delete().eq("id", id).eq("user_id", user.id); if (error) { toast.error("Could not delete."); return; } setChatSessions(p => p.filter(c => c.id !== id)); if (currentChatIdRef.current === id) startNewChat(); }, [startNewChat, user]);

  const streamChat = useCallback(async (history: Message[], chatId: string | null) => {
    const ctrl = new AbortController(); abortRef.current = ctrl;
    const aiMessages = history.filter(m => m.type === "text").slice(-20).map(m => ({ role: m.role, content: m.content }));
    const { data: { session } } = await supabase.auth.getSession(); if (!session?.access_token) throw new Error("Please sign in.");
    const wireMode = model === "deepDive" ? "long_context" : model;
    const res = await fetch(CHAT_URL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ messages: aiMessages, mode: wireMode }), signal: ctrl.signal });
    if (!res.ok || !res.body) { const t = await res.text().catch(() => ""); throw new Error(`HTTP ${res.status}: ${t.slice(0, 120)}`); }
    const aId = uid(); setMessages(p => [...p, { id: aId, role: "assistant", content: "", type: "text", isStreaming: true, timestamp: Date.now() }]);
    const reader = res.body.getReader(); const decoder = new TextDecoder(); let buf = ""; let acc = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.charCodeAt(line.length - 1) === 13) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") continue;
          try {
            const parsed = JSON.parse(json);
            const delta = parsed?.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta.length > 0) {
              acc += delta;
              setMessages(p => p.map(m => m.id === aId ? { ...m, content: acc } : m));
            }
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
    } finally {
      setMessages(p => p.map(m => m.id === aId ? { ...m, isStreaming: false } : m));
    }
    const final: Message = acc.trim().length === 0
      ? { id: aId, role: "assistant", type: "error", content: "No response received.", timestamp: Date.now() }
      : { id: aId, role: "assistant", type: "text", content: acc, timestamp: Date.now() };
    setMessages(p => p.map(m => m.id === aId ? final : m));
    await persistMessage(chatId, final);
    if (final.type === "text") pushCanvasFromMessage(final.content);
  }, [model, persistMessage, pushCanvasFromMessage]);

  const runArtifact = useCallback(async (type: "notes" | "exam" | "slides" | "code", topic: string, originalPrompt: string, chatId: string | null) => {
    const action = `${type}_artifact` as CreditAction; const cost = CREDIT_COSTS[action];
    if (!isPro && !hasEnoughCredits(action, credits.balance)) { setBuyOpen(true); return; }
    const lid = uid(); setMessages(p => [...p, { id: lid, role: "assistant", content: `Creating your ${type}…`, type: "loading", timestamp: Date.now() }]);
    try { const result = await attemptGeneration({ type, topic, prompt: originalPrompt, chatId: chatId ?? undefined, timeoutMs: 540_000, maxRetries: 1, onStage: setLoadingStage }); if (result.success) { let nb = credits.balance; if (!isPro) { try { const { data } = await (supabase as any).rpc("spend_user_credits", { _amount: cost, _action: action.replace(/_/g, " ") }); const r = Array.isArray(data) ? data[0] : data; if (r?.success && typeof r.balance !== "undefined") { nb = Number(r.balance); credits.setBalance(nb); } else { creditsActions.deduct(action); nb = Math.max(0, +(credits.balance - cost).toFixed(2)); } } catch { creditsActions.deduct(action); nb = Math.max(0, +(credits.balance - cost).toFixed(2)); } } const msg: Message = { id: uid(), role: "assistant", type: "artifact", content: "", artifactHtml: result.content, artifactType: type, topic, creditsUsed: isPro ? 0 : cost, newBalance: nb, timestamp: Date.now() }; upsertArtifact({ id: msg.id, type, title: topic, html: result.content, createdAt: msg.timestamp, sourceMessageId: msg.id, contextMessageIds: [], summary: `Created ${type}` }); openArtifact(msg.id); setMessages(p => p.filter(m => m.id !== lid).concat(msg)); await persistMessage(chatId, msg); } else { setMessages(p => p.filter(m => m.id !== lid).concat({ id: uid(), role: "assistant", type: "error", content: "Generation failed — no credits charged.", timestamp: Date.now() })); } } catch { setMessages(p => p.filter(m => m.id !== lid).concat({ id: uid(), role: "assistant", type: "error", content: "Generation failed — no credits charged.", timestamp: Date.now() })); }
  }, [credits.balance, isPro, upsertArtifact, openArtifact, persistMessage]);

  const handleSend = useCallback(async (text?: string, artifactType?: "notes" | "exam" | "slides" | "code") => {
    const t = (text || input).trim(); if (!t || loading) return;
    if (artifactType) { setShowArtifactPicker(false); const cid = await ensureChat(t); if (cid) { await runArtifact(artifactType, t, t, cid); setInput(""); } return; }
    const isArt = /\b(create|generate|make|build|write|draft)\b.*\b(notes?|exam|test|quiz|slides?|presentation|deck|code|app|game|website)\b/i.test(t) || /\b(notes?|exam|test|quiz|slides?|presentation|deck)\b.*\b(on|for|about)\b/i.test(t);
    const dt = isArt ? (/\b(exam|test|quiz)\b/i.test(t) ? "exam" : /\b(slides?|presentation|deck)\b/i.test(t) ? "slides" : /\b(code|app|game|website|build)\b/i.test(t) ? "code" : "notes") : undefined;
    if (dt) { const cid = await ensureChat(t); if (cid) { await runArtifact(dt, t, t, cid); setInput(""); } return; }
    const cid = await ensureChat(t); if (!cid) return;
    const um: Message = { id: uid(), role: "user", content: t, type: "text", timestamp: Date.now() };
    const nm = [...messages, um]; setMessages(nm); setInput(""); setLoading(true); setLoadingStage("Thinking…"); lastUserMsgRef.current = t;
    await persistMessage(cid, um);
    try { await streamChat(nm, cid); } catch (e: any) { if (e?.name !== "AbortError") setMessages(p => p.filter(m => m.type !== "loading").concat({ id: uid(), role: "assistant", type: "error", content: e?.message ?? "Something went wrong.", timestamp: Date.now() })); } finally { setLoading(false); setLoadingStage(""); }
  }, [input, loading, messages, ensureChat, streamChat, persistMessage, runArtifact]);

  const handleStop = useCallback(() => { abortRef.current?.abort(); setLoading(false); setLoadingStage(""); }, []);
  const handleRegenerate = useCallback(async (mid: string) => { const idx = messages.findIndex(m => m.id === mid); if (idx < 0) return; const cid = currentChatIdRef.current; if (!cid) return; setMessages(p => p.slice(0, idx)); try { await streamChat(messages.slice(0, idx), cid); } catch {} }, [messages, streamChat]);
  const handleRetry = useCallback(async (mid: string) => { handleRegenerate(mid); }, [handleRegenerate]);
  const handleEdit = useCallback(async (mid: string, nt: string) => { const idx = messages.findIndex(m => m.id === mid); if (idx < 0) return; const cid = currentChatIdRef.current; if (!cid) return; setMessages(p => p.slice(0, idx).concat({ ...messages[idx], content: nt })); try { await streamChat(messages.slice(0, idx).concat({ ...messages[idx], content: nt }), cid); } catch {} }, [messages, streamChat]);
  const handleConfirmAction = useCallback(async (mid: string) => { const msg = messages.find(m => m.id === mid); if (!msg?.pendingAction) return; setMessages(p => p.map(m => m.id === mid ? { ...m, actionResolved: true } : m)); const result = await executeAgentAction(msg.pendingAction, p => navigate(p)); setMessages(p => p.concat({ id: uid(), role: "assistant", type: "text", content: result.message, timestamp: Date.now() })); }, [messages, navigate]);
  const handleCancelAction = useCallback((mid: string) => { setMessages(p => p.map(m => m.id === mid ? { ...m, actionResolved: true } : m)); }, []);
  const empty = messages.length === 0;

  return (
    <div className="chat-root">
      {/* ═══ SIDEBAR ═══ */}
      <AnimatePresence>
        {historyOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="chat-sidebar hidden md:flex"
          >
            <div className="chat-sidebar-header">
              <button onClick={startNewChat} className="chat-sidebar-new-btn">
                <Plus className="w-4 h-4" /> New Chat
              </button>
            </div>
            <div className="chat-sidebar-list">
              {chatSessions.map(chat => (
                <div
                  key={chat.id}
                  onClick={() => loadChat(chat)}
                  className={`chat-sidebar-item ${currentChatId === chat.id ? 'active' : ''}`}
                >
                  <span className="chat-sidebar-item-title">{chat.title}</span>
                  <button
                    onClick={e => { e.stopPropagation(); deleteChat(chat.id); }}
                    className="chat-sidebar-item-delete"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {chatSessions.length === 0 && (
                <div className="text-center p-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                  No conversations yet
                </div>
              )}
            </div>
            <div className="chat-sidebar-footer">
              <CreditsDisplay onClick={() => setBuyOpen(true)} />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ═══ MAIN ═══ */}
      <div className="chat-main">
        {/* Top bar */}
        <div className="chat-topbar">
          <div className="chat-topbar-left">
            <button
              onClick={() => setHistoryOpen(v => !v)}
              className="p-2 rounded-lg hover:bg-white/[0.04] transition-colors"
              style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {historyOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>
            <div className="chat-topbar-title">
              <div className="chat-topbar-logo">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <span className="chat-topbar-name">Lumina AI</span>
              {loading && (
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-teal-400 ml-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                  Thinking…
                </span>
              )}
            </div>
          </div>
          <div className="chat-topbar-right">
            <button
              onClick={startNewChat}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', background: 'none', cursor: 'pointer' }}
            >
              <MessageSquarePlus className="w-3.5 h-3.5" /> New
            </button>
            <CreditsDisplay onClick={() => setBuyOpen(true)} />
            <ManualRestoreButton />
          </div>
        </div>

        {/* Content */}
        <div className="chat-content">
          {empty ? (
            <div className="chat-empty">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as const }}
                style={{ textAlign: 'center', marginBottom: 40 }}
              >
                <div className="chat-empty-icon">
                  <Sparkles className="w-8 h-8" style={{ color: 'var(--brand-glow)' }} />
                </div>
                <h1 className="chat-empty-heading">How can I help you study?</h1>
                <p className="chat-empty-sub">
                  Generate notes, exams, slides, code, and explanations instantly.
                </p>
              </motion.div>
              <div className="chat-suggestions">
                {SUGGESTIONS.map((s, i) => (
                  <motion.button
                    key={s.text}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12 + i * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] as const }}
                    onClick={() => handleSend(s.text)}
                    className="chat-suggestion-card"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background: `${s.color}15`, border: `1px solid ${s.color}25` }}>
                      <s.icon className="w-4 h-4" style={{ color: s.color }} />
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{s.text}</span>
                  </motion.button>
                ))}
              </div>
              {/* Artifact type picker */}
              <div className="flex items-center gap-2 mt-6">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Or generate:</span>
                {artifactTypes.map(a => (
                  <button
                    key={a.id}
                    onClick={() => setShowArtifactPicker(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-gray-400 hover:text-white hover:bg-white/[0.04] transition-colors border border-white/[0.06]"
                  >
                    <a.icon className="w-3 h-3" /> {a.label}
                  </button>
                ))}
              </div>
              {showArtifactPicker && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 mt-3 p-3 rounded-xl border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <span className="text-xs text-gray-400 mr-1">Topic:</span>
                  <input
                    autoFocus
                    placeholder="e.g. Photosynthesis"
                    className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder:text-gray-500"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                        handleSend((e.target as HTMLInputElement).value, artifactTypes[0].id);
                        setShowArtifactPicker(false);
                      }
                      if (e.key === 'Escape') setShowArtifactPicker(false);
                    }}
                  />
                  <button onClick={() => setShowArtifactPicker(false)} className="p-1 rounded hover:bg-white/[0.04] text-gray-500">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              )}
            </div>
          ) : (
            <MessageList
              messages={messages}
              loadingStage={loadingStage}
              onRegenerate={handleRegenerate}
              onRetry={handleRetry}
              onEdit={handleEdit}
              onTopUp={() => setBuyOpen(true)}
              onConfirmAction={handleConfirmAction}
              onCancelAction={handleCancelAction}
            />
          )}

          {/* Input */}
          <div className="chat-input-area">
            <div className="chat-mode-pills">
              {(["auto", "reasoning", "study", "coding", "deepDive", "creative", "fast"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setModel(m)}
                  className={`chat-mode-pill ${model === m ? 'active' : ''}`}
                >
                  {m === "auto" ? "Auto" : m === "deepDive" ? "Deep Dive" : m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
            <div className="chat-input-box">
              <button type="button" className="chat-input-btn" title="Attach file">
                <Paperclip className="w-4 h-4" />
              </button>
              <textarea
                rows={1}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!loading && input.trim()) handleSend(); } }}
                placeholder="Ask anything…"
                className="chat-textarea"
              />
              {loading ? (
                <button type="button" onClick={handleStop} className="chat-stop-btn" title="Stop generating">
                  <Square className="w-3.5 h-3.5" style={{ fill: 'currentColor' }} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => input.trim() && handleSend()}
                  disabled={!input.trim()}
                  className="chat-send-btn"
                  title="Send"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="chat-disclaimer">Lumina can make mistakes. Verify important info.</p>
          </div>
        </div>

        <BuyCreditsModal open={buyOpen} onOpenChange={setBuyOpen} />
      </div>

      {canvasOpen && (
        <div className="hidden md:flex" style={{ flex: '0 0 54%', minWidth: 0 }}>
          <CanvasPanel open={canvasOpen} versions={canvasVersions} onClose={() => setCanvasOpen(false)} />
        </div>
      )}
      {activeArtifactId && (
        <PremiumArtifactWorkspace
          messages={messages}
          onQuote={t => setInput(p => `${p}${p ? "\n\n" : ""}${t}`)}
          onRegenerate={id => handleRegenerate(id)}
        />
      )}
    </div>
  );
};

export default ChatPage;

/**
 * Lumina AI Chat — Production-Grade UI
 * Stunning edtech+SaaS design with consistent visual hierarchy
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Clock3, MessageSquarePlus, PanelLeftClose, PanelLeftOpen,
  Sparkles, Trash2, Zap, Plus, ArrowUp, FileText, Code2,
  Presentation, BookOpen, Send, Mic, Paperclip, X, ChevronDown,
  Bot, User, Copy, RefreshCw, ThumbsUp, ThumbsDown, Settings2,
  Wand2, Brain, Target, Layers, History, Search, Command
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";
import { detectIntent } from "./utils/intentDetector";
import { attemptGeneration } from "./utils/generationWrapper";
import { MessageList } from "./components/MessageList";
import { InputBar } from "./components/InputBar";
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
import { isGmailRequest, loadRecentGmailContext } from "@/lib/connectors/gmailContext";
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
const rowToMessage = (row: SavedMessageRow): Message => ({
  id: row.id, role: row.role, content: row.content ?? "",
  type: (row.message_type || "text") as Message["type"],
  artifactType: row.artifact_type ?? undefined, artifactHtml: row.artifact_html ?? undefined,
  topic: row.topic ?? undefined, creditsUsed: toNumber(row.credits_used), newBalance: toNumber(row.new_balance),
  timestamp: new Date(row.created_at).getTime(),
});

const SUGGESTIONS = [
  { icon: Brain, label: "Explain a concept", text: "Explain quantum entanglement in simple terms", color: "from-violet-500/20 to-purple-500/20" },
  { icon: FileText, label: "Generate notes", text: "Create detailed notes on photosynthesis", color: "from-emerald-500/20 to-teal-500/20" },
  { icon: Target, label: "Create exam", text: "Make an exam paper on thermodynamics", color: "from-amber-500/20 to-orange-500/20" },
  { icon: Code2, label: "Build something", text: "Build me a Snake game with HTML/CSS/JS", color: "from-blue-500/20 to-cyan-500/20" },
  { icon: Presentation, label: "Make slides", text: "Create slides on Newton's laws of motion", color: "from-rose-500/20 to-pink-500/20" },
  { icon: BookOpen, label: "Quick study", text: "Quick study guide on cell division", color: "from-indigo-500/20 to-blue-500/20" },
];

const artifactTypes = [
  { id: "notes" as const, icon: FileText, label: "Notes", desc: "Detailed study notes" },
  { id: "exam" as const, icon: Target, label: "Exam", desc: "Practice test paper" },
  { id: "slides" as const, icon: Presentation, label: "Slides", desc: "Presentation deck" },
  { id: "code" as const, icon: Code2, label: "Code", desc: "Interactive build" },
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

  const refreshChats = useCallback(async () => {
    if (!user) { setChatSessions([]); setCurrentChatId(null); currentChatIdRef.current = null; return; }
    const { data, error } = await supabase.from("chats").select("id,title,created_at,updated_at").eq("user_id", user.id).eq("chat_type", "general").order("updated_at", { ascending: false }).limit(40);
    if (error) return; setChatSessions((data ?? []) as ChatSummary[]);
  }, [user]);
  useEffect(() => { refreshChats(); }, [refreshChats]);

  const ensureChat = useCallback(async (t: string): Promise<string | null> => {
    if (!user) return null; if (currentChatIdRef.current) return currentChatIdRef.current;
    const { data, error } = await supabase.from("chats").insert({ user_id: user.id, title: titleFrom(t), chat_type: "general" }).select("id,title,created_at,updated_at").single();
    if (error || !data) return null; const c = data as ChatSummary; setCurrentChatId(c.id); currentChatIdRef.current = c.id; setChatSessions(p => [c, ...p.filter(x => x.id !== c.id)]); return c.id;
  }, [user]);

  const touchChat = useCallback(async (id: string) => { setChatSessions(p => p.map(c => c.id === id ? { ...c, updated_at: new Date().toISOString() } : c)); await supabase.from("chats").update({ updated_at: new Date().toISOString() }).eq("id", id); }, []);

  const persistMessage = useCallback(async (chatId: string | null, msg: Message) => {
    if (!chatId || !user || msg.type === "loading" || msg.role === "system" || (msg.role !== "user" && msg.role !== "assistant")) return;
    try { await (supabase as any).from("chat_messages").upsert({ id: msg.id, chat_id: chatId, role: msg.role, content: msg.content || "", message_type: msg.type, artifact_type: msg.artifactType ?? null, artifact_html: msg.artifactHtml ?? null, topic: msg.topic ?? null, credits_used: msg.creditsUsed ?? null, new_balance: msg.newBalance ?? null }, { onConflict: "id" }); await touchChat(chatId); } catch {}
  }, [touchChat, user]);

  const loadChat = useCallback(async (chat: ChatSummary) => {
    setHistoryLoading(true);
    try {
      const { data, error } = await (supabase as any).from("chat_messages").select("id,role,content,created_at,message_type,artifact_type,artifact_html,topic,credits_used,new_balance").eq("chat_id", chat.id).order("created_at", { ascending: true });
      if (error) throw error; setCurrentChatId(chat.id); currentChatIdRef.current = chat.id; setMessages(((data ?? []) as SavedMessageRow[]).map(rowToMessage)); setHistoryOpen(false);
    } catch (e: any) { toast.error(e?.message ?? "Could not open chat."); } finally { setHistoryLoading(false); }
  }, []);

  const startNewChat = useCallback(() => { abortRef.current?.abort(); setCurrentChatId(null); currentChatIdRef.current = null; setMessages([]); setInput(""); setLoading(false); setLoadingStage(""); }, []);

  const deleteChat = useCallback(async (id: string) => {
    if (!user) return; const { error } = await supabase.from("chats").delete().eq("id", id).eq("user_id", user.id);
    if (error) { toast.error("Could not delete."); return; } setChatSessions(p => p.filter(c => c.id !== id)); if (currentChatIdRef.current === id) startNewChat();
  }, [startNewChat, user]);

  const streamChat = useCallback(async (history: Message[], chatId: string | null) => {
    const ctrl = new AbortController(); abortRef.current = ctrl;
    const aiMessages = history.filter(m => m.type === "text").slice(-20).map(m => ({ role: m.role, content: m.content }));
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Please sign in.");
    const wireMode = model === "deepDive" ? "long_context" : model;
    const res = await fetch(CHAT_URL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ messages: aiMessages, mode: wireMode }), signal: ctrl.signal });
    if (!res.ok || !res.body) { const t = await res.text().catch(() => ""); throw new Error(`HTTP ${res.status}: ${t.slice(0, 120)}`); }
    const aId = uid();
    setMessages(p => [...p, { id: aId, role: "assistant", content: "", type: "text", isStreaming: true, timestamp: Date.now() }]);
    const reader = res.body.getReader(); const decoder = new TextDecoder(); let buf = ""; let acc = "";
    try { while (true) { const { done, value } = await reader.read(); if (done) break; buf += decoder.decode(value, { stream: true }); let nl: number; while ((nl = buf.indexOf("\n")) !== -1) { let line = buf.slice(0, nl); buf = buf.slice(nl + 1); if (line.endsWith("\r")) line = line.slice(0, -1); if (!line.startsWith("data: ")) continue; const json = line.slice(6).trim(); if (json === "[DONE]") continue; try { const parsed = JSON.parse(json); const delta = parsed?.choices?.[0]?.delta?.content; if (typeof delta === "string" && delta.length > 0) { acc += delta; setMessages(p => p.map(m => m.id === aId ? { ...m, content: acc } : m)); } } catch { buf = line + "\n" + buf; break; } } } finally { setMessages(p => p.map(m => m.id === aId ? { ...m, isStreaming: false } : m)); }
    const final: Message = acc.trim().length === 0 ? { id: aId, role: "assistant", type: "error", content: "No response received. Please try again.", timestamp: Date.now() } : { id: aId, role: "assistant", type: "text", content: acc, timestamp: Date.now() };
    setMessages(p => p.map(m => m.id === aId ? final : m)); await persistMessage(chatId, final); if (final.type === "text") pushCanvasFromMessage(final.content);
  }, [model, persistMessage, pushCanvasFromMessage]);

  const runQuickStudy = useCallback(async (topic: string, history: Message[], chatId: string | null) => {
    const p = `Create a 10-minute revision guide for: ${topic}.\n\nFormat strictly as:\n## ⚡ Quick Revision: ${topic}\n**Read time: ~10 minutes**\n\n### 1. Key Facts (2 min)\n[5–8 bullets]\n\n### 2. Critical Formulas / Definitions (2 min)\n[List with brief explanations]\n\n### 3. Common Exam Mistakes (2 min)\n[3–4 mistakes]\n\n### 4. Quick Quiz (4 min)\nQ1: ... || A: ...\nQ2: ... || A: ...\nQ3: ... || A: ...\n\n### 5. 60-Second Summary\n[2–3 sentences]`;
    const ctrl = new AbortController(); abortRef.current = ctrl;
    const ai = history.filter(m => m.type === "text").slice(-10).map(m => ({ role: m.role, content: m.content })); ai.push({ role: "user", content: p });
    const { data: { session } } = await supabase.auth.getSession(); if (!session?.access_token) throw new Error("Please sign in.");
    const res = await fetch(CHAT_URL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ messages: ai, mode: "study" }), signal: ctrl.signal });
    if (!res.ok || !res.body) throw new Error("HTTP " + res.status);
    const aId = uid(); setMessages(p => [...p, { id: aId, role: "assistant", content: "", type: "text", isStreaming: true, timestamp: Date.now() }]);
    const reader = res.body.getReader(); const decoder = new TextDecoder(); let buf = "", acc = "";
    try { while (true) { const { done, value } = await reader.read(); if (done) break; buf += decoder.decode(value, { stream: true }); let nl: number; while ((nl = buf.indexOf("\n")) !== -1) { let line = buf.slice(0, nl); buf = buf.slice(nl + 1); if (line.endsWith("\r")) line = line.slice(0, -1); if (!line.startsWith("data: ")) continue; const json = line.slice(6).trim(); if (json === "[DONE]") continue; try { const parsed = JSON.parse(json); const d = parsed?.choices?.[0]?.delta?.content; if (typeof d === "string") { acc += d; setMessages(p => p.map(m => m.id === aId ? { ...m, content: acc } : m)); } } catch { buf = line + "\n" + buf; break; } } } finally { setMessages(p => p.map(m => m.id === aId ? { ...m, isStreaming: false } : m)); }
    const final: Message = { id: aId, role: "assistant", content: acc, type: "text", timestamp: Date.now() };
    setMessages(p => p.map(m => m.id === aId ? final : m)); await persistMessage(chatId, final);
  }, [persistMessage]);

  const runArtifact = useCallback(async (type: "notes" | "exam" | "slides" | "code", topic: string, originalPrompt: string, chatId: string | null, contextMessageIds: string[] = []) => {
    const action = `${type}_artifact` as CreditAction; const cost = CREDIT_COSTS[action];
    if (!isPro && !hasEnoughCredits(action, credits.balance)) { setBuyOpen(true); return; }
    const allowed = await checkAndIncrement('artifact_generation'); if (!allowed) return;
    const lid = uid(); setMessages(p => [...p, { id: lid, role: "assistant", content: `Creating your ${type} on "${topic}"...`, type: "loading", timestamp: Date.now() }]);
    try {
      const result = await attemptGeneration({ type, topic, prompt: originalPrompt, chatId: chatId ?? undefined, timeoutMs: 540_000, maxRetries: 1, onStage: setLoadingStage });
      if (result.success) {
        let newBalance = credits.balance; if (!isPro) { try { const { data } = await (supabase as any).rpc("spend_user_credits", { _amount: cost, _action: action.replace(/_/g, " ") }); const row = Array.isArray(data) ? data[0] : data; if (row?.success && typeof row.balance !== "undefined") { newBalance = Number(row.balance); credits.setBalance(newBalance); } else { creditsActions.deduct(action); newBalance = Math.max(0, +(credits.balance - cost).toFixed(2)); } } catch { creditsActions.deduct(action); newBalance = Math.max(0, +(credits.balance - cost).toFixed(2)); } }
        const msg: Message = { id: uid(), role: "assistant", type: "artifact", content: "", artifactHtml: result.content, artifactType: type, topic, creditsUsed: isPro ? 0 : cost, newBalance, timestamp: Date.now() };
        upsertArtifact({ id: msg.id, type, title: topic, html: result.content, createdAt: msg.timestamp, sourceMessageId: msg.id, contextMessageIds, summary: `Created ${type} from chat` }); openArtifact(msg.id);
        setMessages(p => p.filter(m => m.id !== lid).concat(msg)); await persistMessage(chatId, msg);
      } else { setMessages(p => p.filter(m => m.id !== lid).concat({ id: uid(), role: "assistant", type: "error", content: `Generation failed (${result.error ?? "unknown"}) — no credits were charged.`, timestamp: Date.now() })); }
    } catch { setMessages(p => p.filter(m => m.id !== lid).concat({ id: uid(), role: "assistant", type: "error", content: "Generation failed — no credits were charged.", timestamp: Date.now() })); }
  }, [credits.balance, isPro, upsertArtifact, openArtifact, persistMessage]);

  const handleSend = useCallback(async (text?: string, artifactType?: "notes" | "exam" | "slides" | "code") => {
    const t = (text || input).trim(); if (!t || loading) return;
    if (artifactType) { setShowArtifactPicker(false); const chatId = await ensureChat(t); if (!chatId) return; await runArtifact(artifactType, t, t, chatId); setInput(""); return; }
    const isArtifactReq = /\b(create|generate|make|build|write|draft)\b.*\b(notes?|exam|test|quiz|slides?|presentation|deck|code|app|game|website)\b/i.test(t) || /\b(notes?|exam|test|quiz|slides?|presentation|deck)\b.*\b(on|for|about)\b/i.test(t);
    const detectedType = isArtifactReq ? (/\b(exam|test|quiz|question)\b/i.test(t) ? "exam" : /\b(slides?|presentation|deck|ppt)\b/i.test(t) ? "slides" : /\b(code|app|game|website|build)\b/i.test(t) ? "code" : "notes") : undefined;
    if (detectedType) { const chatId = await ensureChat(t); if (!chatId) return; await runArtifact(detectedType, t, t, chatId); setInput(""); return; }
    const chatId = await ensureChat(t); if (!chatId) return;
    const userMsg: Message = { id: uid(), role: "user", content: t, type: "text", timestamp: Date.now() };
    const newMessages = [...messages, userMsg]; setMessages(newMessages); setInput(""); setLoading(true); setLoadingStage("Thinking…"); lastUserMsgRef.current = t;
    await persistMessage(chatId, userMsg);
    try { await streamChat(newMessages, chatId); } catch (e: any) { if (e?.name === "AbortError") return; setMessages(p => p.filter(m => m.type !== "loading").concat({ id: uid(), role: "assistant", type: "error", content: e?.message ?? "Something went wrong.", timestamp: Date.now() })); } finally { setLoading(false); setLoadingStage(""); }
  }, [input, loading, messages, ensureChat, streamChat, persistMessage, runArtifact]);

  const handleStop = useCallback(() => { abortRef.current?.abort(); setLoading(false); setLoadingStage(""); }, []);
  const handleRegenerate = useCallback(async (messageId: string) => { const idx = messages.findIndex(m => m.id === messageId); if (idx < 0) return; const chatId = currentChatIdRef.current; if (!chatId) return; setMessages(p => p.slice(0, idx)); try { await streamChat(messages.slice(0, idx), chatId); } catch {} }, [messages, streamChat]);
  const handleRetry = useCallback(async (messageId: string) => { const msg = messages.find(m => m.id === messageId); if (!msg) return; handleRegenerate(messageId); }, [messages, handleRegenerate]);
  const handleEdit = useCallback(async (messageId: string, newText: string) => { const idx = messages.findIndex(m => m.id === messageId); if (idx < 0) return; const chatId = currentChatIdRef.current; if (!chatId) return; setMessages(p => p.slice(0, idx).concat({ ...messages[idx], content: newText })); try { await streamChat(messages.slice(0, idx).concat({ ...messages[idx], content: newText }), chatId); } catch {} }, [messages, streamChat]);
  const handleConfirmAction = useCallback(async (messageId: string) => { const msg = messages.find(m => m.id === messageId); if (!msg?.pendingAction) return; setMessages(p => p.map(m => m.id === messageId ? { ...m, actionResolved: true } : m)); const result = await executeAgentAction(msg.pendingAction, p => navigate(p)); setMessages(p => p.concat({ id: uid(), role: "assistant", type: "text", content: result.message, timestamp: Date.now() })); }, [messages, navigate]);
  const handleCancelAction = useCallback((messageId: string) => { setMessages(p => p.map(m => m.id === messageId ? { ...m, actionResolved: true } : m)); }, []);

  const empty = messages.length === 0 && !loading;

  return (
    <div className="flex h-full bg-background">
      {/* ═══ SIDEBAR ═══ */}
      <AnimatePresence>
        {historyOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as const }}
            className="hidden md:flex flex-col h-full border-r border-border/50 bg-sidebar overflow-hidden shrink-0"
            style={{ background: 'hsl(230 22% 8%)' }}
          >
            {/* Sidebar Header */}
            <div className="p-4 space-y-3">
              <button onClick={startNewChat} className="w-full flex items-center gap-2.5 h-10 px-3 rounded-xl bg-primary/10 text-primary hover:bg-primary/15 transition-colors text-sm font-medium">
                <Plus className="w-4 h-4" /> New Chat
              </button>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                <input placeholder="Search conversations..." className="w-full h-9 pl-9 pr-3 rounded-lg bg-muted/20 border border-border/20 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 transition-colors" />
              </div>
            </div>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
              {chatSessions.map(chat => (
                <div key={chat.id} className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${currentChatId === chat.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-white/[0.03] hover:text-foreground'}`} onClick={() => loadChat(chat)}>
                  <MessageSquarePlus className="w-3.5 h-3.5 shrink-0 opacity-50" />
                  <span className="flex-1 text-sm truncate">{chat.title}</span>
                  <button onClick={e => { e.stopPropagation(); deleteChat(chat.id); }} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-all">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {chatSessions.length === 0 && !historyLoading && (
                <div className="text-center py-8 text-muted-foreground/40 text-xs">No conversations yet</div>
              )}
            </div>

            {/* Sidebar Footer */}
            <div className="p-3 border-t border-border/10 space-y-2">
              <CreditsDisplay onClick={() => setBuyOpen(true)} />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ═══ MAIN CHAT AREA ═══ */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Top Bar */}
        <div className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-border/50" style={{ background: 'hsl(230 25% 7% / 0.8)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setHistoryOpen(!historyOpen)} className="p-2 rounded-lg hover:bg-white/[0.04] text-muted-foreground hover:text-foreground transition-colors">
              {historyOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              <span className="text-sm font-semibold text-foreground">Lumina AI</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/15 text-primary border border-primary/20">PRO</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ModelSelector value={model} onChange={setModel} />
            <ManualRestoreButton className="hidden md:inline-flex" />
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          {empty ? (
            <div className="h-full flex flex-col items-center justify-center px-6 max-w-3xl mx-auto">
              {/* Welcome Hero */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mx-auto mb-5 border border-primary/10">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-3xl font-display font-bold text-foreground mb-2">How can I help you study?</h1>
                <p className="text-muted-foreground text-sm max-w-md">Chat is free. Generate notes, exams, slides & code with AI — only pay when generation succeeds.</p>
              </motion.div>

              {/* Suggestion Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
                {SUGGESTIONS.map((s, i) => (
                  <motion.button
                    key={s.label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.05 }}
                    onClick={() => handleSend(s.text)}
                    className="group text-left p-4 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{ background: 'hsl(230 20% 11% / 0.5)', border: '1px solid hsl(0 0% 100% / 0.06)', boxShadow: '0 4px 16px hsl(0 0% 0% / 0.2)' }}
                  >
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center`}>
                        <s.icon className="w-4 h-4 text-foreground" />
                      </div>
                      <span className="text-sm font-semibold text-foreground">{s.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{s.text}</p>
                  </motion.button>
                ))}
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2 mt-6">
                <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider">Quick:</span>
                {artifactTypes.map(a => (
                  <button key={a.id} onClick={() => { setShowArtifactPicker(true); }} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors border border-border/10">
                    <a.icon className="w-3 h-3" /> {a.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-6">
              <MessageList messages={messages} loadingStage={loadingStage} onRegenerate={handleRegenerate} onRetry={handleRetry} onEdit={handleEdit} onTopUp={() => setBuyOpen(true)} onConfirmAction={handleConfirmAction} onCancelAction={handleCancelAction} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="shrink-0 pb-4 pt-2 px-4 space-y-3" style={{ background: 'linear-gradient(to top, hsl(230 25% 7%) 60%, transparent)' }}>
          {/* Artifact Picker */}
          <AnimatePresence>
            {showArtifactPicker && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="flex items-center gap-2 p-3 rounded-2xl" style={{ background: 'hsl(230 20% 11% / 0.6)', border: '1px solid hsl(0 0% 100% / 0.06)', backdropFilter: 'blur(20px)' }}>
                <span className="text-xs text-muted-foreground mr-1">Generate:</span>
                {artifactTypes.map(a => (
                  <button key={a.id} onClick={() => { if (input.trim()) handleSend(input, a.id); setShowArtifactPicker(false); }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-primary/10 text-primary hover:bg-primary/15 transition-colors border border-primary/15">
                    <a.icon className="w-3.5 h-3.5" /> {a.label}
                  </button>
                ))}
                <button onClick={() => setShowArtifactPicker(false)} className="ml-auto p-1.5 rounded-lg hover:bg-white/[0.04] text-muted-foreground transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <InputBar value={input} onChange={setInput} onSend={handleSend} onStop={handleStop} isLoading={loading} onPickArtifact={t => { if (!input.trim()) { toast.info("Type a topic first."); return; } handleSend(input, t); }} />
          <p className="text-[10px] text-center text-muted-foreground/40">Lumina can make mistakes. Verify important info. Credits only charged after successful generation.</p>
        </div>
      </div>

      {/* ═══ CANVAS PANEL ═══ */}
      {canvasOpen && (
        <div className="hidden md:flex flex-[0_0_54%] min-w-0 transition-all duration-300">
          <CanvasPanel open={canvasOpen} versions={canvasVersions} onClose={() => setCanvasOpen(false)} />
        </div>
      )}

      {/* ═══ ARTIFACT WORKSPACE ═══ */}
      {activeArtifactId && (
        <PremiumArtifactWorkspace messages={messages} onQuote={t => setInput(p => `${p}${p ? "\n\n" : ""}${t}`)} onRegenerate={id => handleRegenerate(id)} />
      )}

      <BuyCreditsModal open={buyOpen} onOpenChange={setBuyOpen} />
    </div>
  );
};

export default ChatPage;

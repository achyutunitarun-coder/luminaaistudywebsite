/**
 * Lumina AI Chat — persisted conversations + queued artifact generation.
 * Chat feature stays isolated inside /src/features/chat/ plus credits UI.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Clock3,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";
import { detectIntent, type Intent } from "./utils/intentDetector";
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
import {
  useCreditsStore,
  creditsActions,
} from "@/features/credits/useCreditsStore";
import {
  CREDIT_COSTS,
  hasEnoughCredits,
  type CreditAction,
} from "@/features/credits/creditsSystem";
import { isGmailRequest, loadRecentGmailContext } from "@/lib/connectors/gmailContext";
import { planAction, planToAction, executeAgentAction, actionRequiresConfirmation, type AgentAction } from "@/lib/agent/actions";
import { useNavigate } from "react-router-dom";

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
  requiredCredits?: number;
  currentBalance?: number;
  isStreaming?: boolean;
  pendingAction?: AgentAction;
  actionSummary?: string;
  actionResolved?: boolean;
  timestamp: number;
}

type ChatSummary = {
  id: string;
  title: string;
  updated_at: string;
  created_at: string;
};

type SavedMessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  message_type?: Message["type"];
  artifact_type?: Message["artifactType"] | null;
  artifact_html?: string | null;
  topic?: string | null;
  credits_used?: number | string | null;
  new_balance?: number | string | null;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const SUGGESTIONS = [
  "Explain quantum entanglement in simple terms",
  "Create notes on photosynthesis",
  "Make an exam paper on thermodynamics",
  "Build me a Snake game",
  "Slides on Newton's laws of motion",
  "Quick study on cell division",
];

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

const titleFrom = (text: string) => {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 48
    ? `${clean.slice(0, 48).trim()}…`
    : clean || "New chat";
};

const toNumber = (value: number | string | null | undefined) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};

const rowToMessage = (row: SavedMessageRow): Message => ({
  id: row.id,
  role: row.role,
  content: row.content ?? "",
  type: (row.message_type || "text") as Message["type"],
  artifactType: row.artifact_type ?? undefined,
  artifactHtml: row.artifact_html ?? undefined,
  topic: row.topic ?? undefined,
  creditsUsed: toNumber(row.credits_used),
  newBalance: toNumber(row.new_balance),
  timestamp: new Date(row.created_at).getTime(),
});

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
  const [historyOpen, setHistoryOpen] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth >= 768,
  );
  const [chatSessions, setChatSessions] = useState<ChatSummary[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [artifactSplit, setArtifactSplit] = useState(40);
  const abortRef = useRef<AbortController | null>(null);
  const lastUserMsgRef = useRef<string>("");
  const currentChatIdRef = useRef<string | null>(null);
  const upsertArtifact = useArtifactStore((s) => s.upsertArtifact);
  const openArtifact = useArtifactStore((s) => s.openArtifact);
  const activeArtifactId = useArtifactStore((s) => s.activeArtifactId);

  // ── Canvas Mode ──────────────────────────────────────────────────
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [canvasVersions, setCanvasVersions] = useState<Array<{ code: string; html: string; ts: number }>>([]);

  useEffect(() => {
    try {
      const imported = localStorage.getItem("lumina_canvas_import");
      if (imported) {
        const html = wrapAsHtmlDoc(imported, /<!doctype html|<html/i.test(imported) ? "html" : "html");
        setCanvasVersions([{ code: imported, html, ts: Date.now() }]);
        setCanvasOpen(true);
        localStorage.removeItem("lumina_canvas_import");
      }
    } catch {}
  }, []);

  const pushCanvasFromMessage = useCallback((text: string) => {
    const found = detectCanvas(text);
    if (!found) return;
    const html = wrapAsHtmlDoc(found.code, found.lang);
    setCanvasVersions((prev) => [...prev, { code: found.code, html, ts: Date.now() }].slice(-20));
    setCanvasOpen(true);
  }, []);

  useEffect(() => {
    currentChatIdRef.current = currentChatId;
  }, [currentChatId]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<number>).detail;
      if (typeof detail === "number") setArtifactSplit(detail);
    };
    window.addEventListener("lumina-artifact-split", handler);
    return () => window.removeEventListener("lumina-artifact-split", handler);
  }, []);

  useEffect(() => {
    messages.forEach((m, index) => {
      if (m.type !== "artifact" || !m.artifactHtml || !m.artifactType) return;
      upsertArtifact({
        id: m.id,
        type: m.artifactType,
        title: m.topic || "Untitled artifact",
        html: m.artifactHtml,
        createdAt: m.timestamp,
        sourceMessageId: m.id,
        contextMessageIds: messages.slice(Math.max(0, index - 6), index + 1).map((msg) => msg.id),
        summary: "Restored from chat history",
      });
    });
  }, [messages, upsertArtifact]);

  const refreshChats = useCallback(async () => {
    if (!user) {
      setChatSessions([]);
      setCurrentChatId(null);
      currentChatIdRef.current = null;
      return;
    }
    const { data, error } = await supabase
      .from("chats")
      .select("id,title,created_at,updated_at")
      .eq("user_id", user.id)
      .eq("chat_type", "general")
      .order("updated_at", { ascending: false })
      .limit(40);
    if (error) {
      console.warn("Failed to load chat history:", error);
      return;
    }
    setChatSessions((data ?? []) as ChatSummary[]);
  }, [user]);

  useEffect(() => {
    refreshChats();
  }, [refreshChats]);

  const ensureChat = useCallback(
    async (firstText: string): Promise<string | null> => {
      if (!user) return null;
      if (currentChatIdRef.current) return currentChatIdRef.current;

      const title = titleFrom(firstText);
      const { data, error } = await supabase
        .from("chats")
        .insert({ user_id: user.id, title, chat_type: "general" })
        .select("id,title,created_at,updated_at")
        .single();

      if (error || !data) {
        console.warn("Failed to create chat:", error);
        return null;
      }

      const chat = data as ChatSummary;
      setCurrentChatId(chat.id);
      currentChatIdRef.current = chat.id;
      setChatSessions((prev) => [
        chat,
        ...prev.filter((c) => c.id !== chat.id),
      ]);
      return chat.id;
    },
    [user],
  );

  const touchChat = useCallback(async (chatId: string) => {
    const updated_at = new Date().toISOString();
    setChatSessions((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, updated_at } : c)),
    );
    await supabase.from("chats").update({ updated_at }).eq("id", chatId);
  }, []);

  const persistMessage = useCallback(
    async (chatId: string | null, message: Message) => {
      if (!chatId || !user) return;
      if (message.type === "loading" || message.role === "system") return;
      if (message.role !== "user" && message.role !== "assistant") return;

      try {
        await (supabase as any).from("chat_messages").upsert(
          {
            id: message.id,
            chat_id: chatId,
            role: message.role,
            content: message.content || "",
            message_type: message.type,
            artifact_type: message.artifactType ?? null,
            artifact_html: message.artifactHtml ?? null,
            topic: message.topic ?? null,
            credits_used: message.creditsUsed ?? null,
            new_balance: message.newBalance ?? null,
          },
          { onConflict: "id" },
        );
        await touchChat(chatId);
      } catch (error) {
        console.warn("Message persistence failed:", error);
      }
    },
    [touchChat, user],
  );

  const removePersistedFrom = useCallback(
    async (startIndex: number) => {
      const chatId = currentChatIdRef.current;
      if (!chatId || startIndex < 0) return;
      const ids = messages
        .slice(startIndex)
        .filter((m) => m.type !== "loading" && m.role !== "system")
        .map((m) => m.id);
      if (ids.length === 0) return;
      try {
        await (supabase as any)
          .from("chat_messages")
          .delete()
          .eq("chat_id", chatId)
          .in("id", ids);
        await touchChat(chatId);
      } catch (error) {
        console.warn("Failed to prune chat branch:", error);
      }
    },
    [messages, touchChat],
  );

  const loadChat = useCallback(async (chat: ChatSummary) => {
    setHistoryLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("chat_messages")
        .select(
          "id,role,content,created_at,message_type,artifact_type,artifact_html,topic,credits_used,new_balance",
        )
        .eq("chat_id", chat.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setCurrentChatId(chat.id);
      currentChatIdRef.current = chat.id;
      setMessages(((data ?? []) as SavedMessageRow[]).map(rowToMessage));
      setHistoryOpen(false);
    } catch (error: any) {
      toast.error(error?.message ?? "Could not open chat history.");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const startNewChat = useCallback(() => {
    abortRef.current?.abort();
    setCurrentChatId(null);
    currentChatIdRef.current = null;
    setMessages([]);
    setInput("");
    setLoading(false);
    setLoadingStage("");
  }, []);

  const deleteChat = useCallback(
    async (chatId: string) => {
      if (!user) return;
      const { error } = await supabase
        .from("chats")
        .delete()
        .eq("id", chatId)
        .eq("user_id", user.id);
      if (error) {
        toast.error("Could not delete chat.");
        return;
      }
      setChatSessions((prev) => prev.filter((c) => c.id !== chatId));
      if (currentChatIdRef.current === chatId) startNewChat();
    },
    [startNewChat, user],
  );

  const streamChat = useCallback(
    async (history: Message[], chatId: string | null) => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const aiMessages = history
        .filter((m) => m.type === "text")
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content }));

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Please sign in to use Lumina Chat.");

      const wireMode = model === "deepDive" ? "long_context" : model;
      const res = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ messages: aiMessages, mode: wireMode }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${txt.slice(0, 120)}`);
      }

      const aId = uid();
      setMessages((prev) => [
        ...prev,
        {
          id: aId,
          role: "assistant",
          content: "",
          type: "text",
          isStreaming: true,
          timestamp: Date.now(),
        },
      ]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) !== -1) {
            let line = buf.slice(0, nl);
            buf = buf.slice(nl + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (json === "[DONE]") continue;
            try {
              const parsed = JSON.parse(json);
              const delta = parsed?.choices?.[0]?.delta?.content;
              if (typeof delta === "string" && delta.length > 0) {
                acc += delta;
                setMessages((prev) =>
                  prev.map((m) => (m.id === aId ? { ...m, content: acc } : m)),
                );
              }
            } catch {
              buf = line + "\n" + buf;
              break;
            }
          }
        }
      } finally {
        setMessages((prev) =>
          prev.map((m) => (m.id === aId ? { ...m, isStreaming: false } : m)),
        );
      }

      const finalMessage: Message =
        acc.trim().length === 0
          ? {
              id: aId,
              role: "assistant",
              type: "error",
              content: "No response received. Please try again.",
              timestamp: Date.now(),
            }
          : {
              id: aId,
              role: "assistant",
              type: "text",
              content: acc,
              timestamp: Date.now(),
            };

      setMessages((prev) => prev.map((m) => (m.id === aId ? finalMessage : m)));
      await persistMessage(chatId, finalMessage);
      if (finalMessage.type === "text") pushCanvasFromMessage(finalMessage.content);
    },
    [model, persistMessage, pushCanvasFromMessage],
  );

  const runQuickStudy = useCallback(
    async (topic: string, history: Message[], chatId: string | null) => {
      const synthesizedPrompt = `Create a 10-minute revision guide for: ${topic}.

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
[2–3 sentences]`;

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const aiMessages = history
        .filter((m) => m.type === "text")
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));
      aiMessages.push({ role: "user", content: synthesizedPrompt });

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Please sign in to use Quick Study.");
      const res = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ messages: aiMessages, mode: "study" }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error("HTTP " + res.status);

      const aId = uid();
      setMessages((prev) => [
        ...prev,
        {
          id: aId,
          role: "assistant",
          content: "",
          type: "text",
          isStreaming: true,
          timestamp: Date.now(),
        },
      ]);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "",
        acc = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) !== -1) {
            let line = buf.slice(0, nl);
            buf = buf.slice(nl + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (json === "[DONE]") continue;
            try {
              const parsed = JSON.parse(json);
              const delta = parsed?.choices?.[0]?.delta?.content;
              if (typeof delta === "string") {
                acc += delta;
                setMessages((prev) =>
                  prev.map((m) => (m.id === aId ? { ...m, content: acc } : m)),
                );
              }
            } catch {
              buf = line + "\n" + buf;
              break;
            }
          }
        }
      } finally {
        setMessages((prev) =>
          prev.map((m) => (m.id === aId ? { ...m, isStreaming: false } : m)),
        );
      }

      const finalMessage: Message = {
        id: aId,
        role: "assistant",
        content: acc,
        type: "text",
        timestamp: Date.now(),
      };
      setMessages((prev) => prev.map((m) => (m.id === aId ? finalMessage : m)));
      await persistMessage(chatId, finalMessage);
    },
    [persistMessage],
  );

  const runArtifact = useCallback(
    async (
      type: "notes" | "exam" | "slides" | "code",
      topic: string,
      originalPrompt: string,
      chatId: string | null,
      contextMessageIds: string[] = [],
    ) => {
      const action = `${type}_artifact` as CreditAction;
      const cost = CREDIT_COSTS[action];

      if (!isPro && !hasEnoughCredits(action, credits.balance)) {
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "system",
            type: "insufficient_credits",
            content: `You need ⚡ ${cost} credits to generate this ${type}.`,
            requiredCredits: cost,
            currentBalance: credits.balance,
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      const loadingId = uid();
      setMessages((prev) => [
        ...prev,
        {
          id: loadingId,
          role: "assistant",
          content: `Queued your ${type}…`,
          type: "loading",
          timestamp: Date.now(),
        },
      ]);

      const result = await attemptGeneration({
        type,
        topic,
        prompt: originalPrompt,
        chatId: chatId ?? undefined,
        timeoutMs: 540_000,
        maxRetries: 1,
        onStage: (s) => setLoadingStage(s),
      });

      if (result.success) {
        let newBalance = credits.balance;
        if (!isPro) {
          try {
            const { data } = await (supabase as any).rpc("spend_user_credits", {
              _amount: cost,
              _action: action.replace(/_/g, " "),
            });
            const row = Array.isArray(data) ? data[0] : data;
            if (row?.success && typeof row.balance !== "undefined") {
              newBalance = Number(row.balance);
              credits.setBalance(newBalance);
            } else {
              creditsActions.deduct(action);
              newBalance = Math.max(0, +(credits.balance - cost).toFixed(2));
            }
          } catch (e) {
            console.warn("Persistent credit spend failed, using local fallback:", e);
            creditsActions.deduct(action);
            newBalance = Math.max(0, +(credits.balance - cost).toFixed(2));
          }
          if (user) {
            try {
              await supabase.rpc("increment_usage", {
                p_user_id: user.id,
                p_feature: "chat_messages",
                p_period_type: "daily",
              });
            } catch (e) {
              console.warn("Usage counter (non-blocking):", e);
            }
          }
        }
        const noteLabel = ({
          notes: "Study notes",
          exam: "Exam paper",
          slides: "Slide deck",
          code: "Interactive build",
        } as const)[type];
        const artifactNote = [
          `**${noteLabel} ready — ${topic}**`,
          "",
          `- **What it is:** a self-contained, fully interactive ${type === "code" ? "build" : noteLabel.toLowerCase()} you can open, study, and share.`,
          `- **How to use:** click **Open** to view full-screen, or drag the divider to study it alongside chat.`,
          `- **Tip:** ask follow-ups like "make it harder", "add a worked example", or "swap the aesthetic" and I'll regenerate.`,
        ].join("\n");
        const finalMessage: Message = {
          id: uid(),
          role: "assistant",
          content: artifactNote,
          type: "artifact",
          artifactHtml: result.content,
          artifactType: type,
          topic,
          creditsUsed: isPro ? 0 : cost,
          newBalance,
          timestamp: Date.now(),
        };
        upsertArtifact({
          id: finalMessage.id,
          type,
          title: topic,
          html: result.content,
          createdAt: finalMessage.timestamp,
          sourceMessageId: finalMessage.id,
          contextMessageIds,
          summary: `Created ${type} from chat prompt`,
        });
        openArtifact(finalMessage.id);
        setMessages((prev) =>
          prev.filter((m) => m.id !== loadingId).concat(finalMessage),
        );
        await persistMessage(chatId, finalMessage);
      } else {
        const finalMessage: Message = {
          id: uid(),
          role: "assistant",
          content: `Generation failed (${result.error ?? "unknown"}) — no credits were charged. Please try again.`,
          type: "error",
          timestamp: Date.now(),
        };
        setMessages((prev) =>
          prev.filter((m) => m.id !== loadingId).concat(finalMessage),
        );
        await persistMessage(chatId, finalMessage);
      }
    },
    [credits.balance, isPro, openArtifact, persistMessage, upsertArtifact, user],
  );

  const handleSend = useCallback(
    async (
      overrideText?: string,
      forcedType?: "notes" | "exam" | "slides" | "code",
    ) => {
      const text = (overrideText ?? input).trim();
      if (!text || loading) return;

      lastUserMsgRef.current = text;
      const chatId = await ensureChat(text);
      const userMsg: Message = {
        id: uid(),
        role: "user",
        content: text,
        type: "text",
        timestamp: Date.now(),
      };
      const history = [...messages, userMsg];
      setMessages((prev) => [...prev, userMsg]);
      await persistMessage(chatId, userMsg);
      setInput("");
      setLoading(true);
      setLoadingStage("Detecting intent…");

      try {
        // ── LLM-powered agent planner: 360° intent detection w/ chat history context ──
        if (!forcedType) {
          setLoadingStage("Routing…");
          const history10 = history
            .filter((m) => m.type === "text" || m.type === "artifact")
            .slice(-10)
            .map((m) => ({ role: m.role as "user" | "assistant", content: m.content || "" }));
          const plan = await planAction(text, history10);
          const action = plan.kind === "chat" ? null : planToAction(plan);

          if (plan.kind === "chat" && /connect|permission|reconnect|required/i.test(plan.summary || "")) {
            const finalMessage: Message = {
              id: uid(),
              role: "assistant",
              content: plan.summary,
              type: "error",
              timestamp: Date.now(),
            };
            setMessages((prev) => [...prev, finalMessage]);
            await persistMessage(chatId, finalMessage);
            return;
          }

          if (action && action.kind === "artifact") {
            setLoadingStage(`Queueing your ${action.type}…`);
            await runArtifact(action.type, action.topic, text, chatId, history.slice(-6).map((m) => m.id));
            return;
          }

          if (action && action.kind === "navigate") {
            const result = await executeAgentAction(action, (p) => navigate(p));
            const finalMessage: Message = {
              id: uid(), role: "assistant",
              content: result.message,
              type: result.ok ? "text" : "error",
              timestamp: Date.now(),
            };
            setMessages((prev) => [...prev, finalMessage]);
            await persistMessage(chatId, finalMessage);
            return;
          }

          if (action) {
            // Confirmation-required actions get a card; read-only ones execute immediately.
            if (actionRequiresConfirmation(action)) {
              const confirmMsg: Message = {
                id: uid(),
                role: "assistant",
                type: "action_confirm",
                content: plan.summary || "I'd like to run this — confirm?",
                pendingAction: action,
                actionSummary: plan.summary,
                timestamp: Date.now(),
              };
              setMessages((prev) => [...prev, confirmMsg]);
              await persistMessage(chatId, confirmMsg);
              return;
            }
            // Read-only: execute now.
            setLoadingStage("Working…");
            const result = await executeAgentAction(action, (p) => navigate(p));
            const finalMessage: Message = {
              id: uid(), role: "assistant",
              content: result.message,
              type: result.ok ? "text" : "error",
              timestamp: Date.now(),
            };
            setMessages((prev) => [...prev, finalMessage]);
            await persistMessage(chatId, finalMessage);
            return;
          }
        }

        let intent: Intent;
        let topic = text;
        if (forcedType) {
          intent = (forcedType.toUpperCase() + "_ARTIFACT") as Intent;
          topic = text;
        } else {
          // Planner returned chat — also fall back to deterministic detector as safety net
          const r = detectIntent(text);
          intent = r.confidence < 0.85 ? "CHAT" : r.intent;
          topic = r.topic || text;
        }

        let effectiveText = text;
        let effectiveHistory = history;
        if (intent === "CHAT" && isGmailRequest(text)) {
          setLoadingStage("Reading Gmail…");
          try {
            const gmailContext = await loadRecentGmailContext(5);
            effectiveText = `${text}\n\n${gmailContext}\n\nUse the live Gmail context above directly. Do not claim you cannot access email; if the context is sparse, say exactly what was available.`;
            effectiveHistory = history.map((m) =>
              m.id === userMsg.id ? { ...m, content: effectiveText } : m,
            );
          } catch (connectorError) {
            const msg = connectorError instanceof Error ? connectorError.message : String(connectorError);
            const finalMessage: Message = {
              id: uid(),
              role: "assistant",
              content: `I tried to read Gmail, but the connector failed: ${msg}\n\nReconnect Gmail from Connectors, then ask me again.`,
              type: "error",
              timestamp: Date.now(),
            };
            setMessages((prev) => [...prev, finalMessage]);
            await persistMessage(chatId, finalMessage);
            return;
          }
        }

        if (intent === "CHAT") {
          setLoadingStage("Thinking…");
          await streamChat(effectiveHistory, chatId);
        } else if (intent === "QUICK_STUDY") {
          setLoadingStage("Building 10-minute revision guide…");
          await runQuickStudy(topic, history, chatId);
        } else {
          const type =
            intent === "NOTES_ARTIFACT"
              ? "notes"
              : intent === "EXAM_ARTIFACT"
                ? "exam"
                : intent === "SLIDES_ARTIFACT"
                  ? "slides"
                  : "code";
          setLoadingStage(`Queueing your ${type}…`);
          await runArtifact(type, topic, text, chatId, history.slice(-6).map((m) => m.id));
        }
      } catch (e: any) {
        const isAbort = e?.name === "AbortError";
        if (!isAbort) {
          const finalMessage: Message = {
            id: uid(),
            role: "assistant",
            content: e?.message?.includes("429")
              ? "Too many requests. Please wait 30 seconds."
              : (e?.message ?? "Something went wrong. Please try again."),
            type: "error",
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, finalMessage]);
          await persistMessage(chatId, finalMessage);
        }
      } finally {
        setLoading(false);
        setLoadingStage("");
        abortRef.current = null;
      }
    },
    [
      ensureChat,
      input,
      loading,
      messages,
      navigate,
      persistMessage,
      runArtifact,
      runQuickStudy,
      streamChat,
    ],
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
    setLoadingStage("");
    toast.info("Stopped.");
  }, []);

  const handleRegenerate = useCallback(
    async (assistantId?: string) => {
      if (assistantId) {
        const idx = messages.findIndex((m) => m.id === assistantId);
        if (idx > 0) {
          for (let i = idx - 1; i >= 0; i--) {
            if (messages[i].role === "user" && messages[i].type === "text") {
              const userText = messages[i].content;
              await removePersistedFrom(i);
              setMessages((prev) => prev.slice(0, i));
              handleSend(userText);
              return;
            }
          }
        }
      }
      if (!lastUserMsgRef.current) return;
      handleSend(lastUserMsgRef.current);
    },
    [handleSend, messages, removePersistedFrom],
  );

  const handleRetry = useCallback(
    (assistantId?: string) => handleRegenerate(assistantId),
    [handleRegenerate],
  );

  const handleEdit = useCallback(
    async (userMsgId: string, newText: string) => {
      const idx = messages.findIndex((m) => m.id === userMsgId);
      if (idx < 0) return;
      await removePersistedFrom(idx);
      setMessages((prev) => prev.slice(0, idx));
      handleSend(newText);
    },
    [handleSend, messages, removePersistedFrom],
  );

  const handleConfirmAction = useCallback(
    async (msgId: string) => {
      const msg = messages.find((m) => m.id === msgId);
      if (!msg?.pendingAction) return;
      // Mark this confirm card as resolved
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, actionResolved: true } : m)));
      const chatId = currentChatIdRef.current;
      try {
        const result = await executeAgentAction(msg.pendingAction, (p) => navigate(p));
        const finalMessage: Message = {
          id: uid(),
          role: "assistant",
          content: result.message,
          type: result.ok ? "text" : "error",
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, finalMessage]);
        await persistMessage(chatId, finalMessage);
      } catch (e: any) {
        const finalMessage: Message = {
          id: uid(), role: "assistant",
          content: `Action failed: ${e?.message || e}`,
          type: "error",
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, finalMessage]);
        await persistMessage(chatId, finalMessage);
      }
    },
    [messages, navigate, persistMessage],
  );

  const handleCancelAction = useCallback((msgId: string) => {
    setMessages((prev) => prev.map((m) =>
      m.id === msgId ? { ...m, actionResolved: true, content: "Cancelled." } : m
    ));
  }, []);


  const empty = messages.length === 0;

  return (
    <div className="flex h-[calc(100vh-4rem)] md:h-[calc(100vh-2rem)] min-h-0">
      <aside
        className={`${historyOpen ? "w-72" : "w-0"} hidden md:block shrink-0 overflow-hidden border-r border-border/60 transition-all duration-200`}
      >
        <div className="h-full flex flex-col bg-card/20">
          <div className="p-3 border-b border-border/60 flex items-center justify-between gap-2">
            <div className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Clock3 className="w-3.5 h-3.5" /> History
            </div>
            <button
              type="button"
              onClick={startNewChat}
              className="w-8 h-8 grid place-items-center rounded-lg hover:bg-accent transition-colors"
              title="New chat"
            >
              <MessageSquarePlus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {!user ? (
              <div className="text-xs text-muted-foreground p-3">
                Sign in to keep chat memory across devices.
              </div>
            ) : historyLoading ? (
              <div className="text-xs text-muted-foreground p-3">
                Loading history…
              </div>
            ) : chatSessions.length === 0 ? (
              <div className="text-xs text-muted-foreground p-3">
                Your saved chats will appear here.
              </div>
            ) : (
              chatSessions.map((chat) => (
                <div
                  key={chat.id}
                  className={`group flex items-center gap-1 rounded-lg ${currentChatId === chat.id ? "bg-primary/10" : "hover:bg-accent/60"}`}
                >
                  <button
                    type="button"
                    onClick={() => loadChat(chat)}
                    className="flex-1 min-w-0 text-left px-2.5 py-2"
                  >
                    <div className="text-sm truncate text-foreground">
                      {chat.title}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(chat.updated_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteChat(chat.id)}
                    className="w-7 h-7 mr-1 grid place-items-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                    title="Delete chat"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      {historyOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
          onClick={() => setHistoryOpen(false)}
        >
          <div
            className="w-[82vw] max-w-80 h-full bg-card border-r border-border shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b border-border/60 flex items-center justify-between gap-2">
              <div className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                <Clock3 className="w-3.5 h-3.5" /> History
              </div>
              <button
                type="button"
                onClick={startNewChat}
                className="w-8 h-8 grid place-items-center rounded-lg hover:bg-accent transition-colors"
                title="New chat"
              >
                <MessageSquarePlus className="w-4 h-4" />
              </button>
            </div>
            <div className="h-[calc(100%-57px)] overflow-y-auto p-2 space-y-1">
              {chatSessions.map((chat) => (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => loadChat(chat)}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="text-sm truncate text-foreground">
                    {chat.title}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(chat.updated_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </button>
              ))}
              {chatSessions.length === 0 && (
                <div className="text-xs text-muted-foreground p-3">
                  Your saved chats will appear here.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div
        className="min-w-0 flex flex-1 flex-col transition-[flex-basis] duration-200 lg:flex-none lg:basis-[var(--chat-basis)]"
        style={{ "--chat-basis": activeArtifactId ? `${artifactSplit}%` : "100%" } as React.CSSProperties}
      >
        <div className="shrink-0 max-w-4xl w-full mx-auto px-3 md:px-4 pt-2 flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              className="w-8 h-8 grid place-items-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title={historyOpen ? "Hide history" : "Show history"}
            >
              {historyOpen ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeftOpen className="w-4 h-4" />
              )}
            </button>
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="font-medium">Lumina Chat</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={startNewChat}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" /> New
            </button>
            <CreditsDisplay onClick={() => setBuyOpen(true)} />
            <ManualRestoreButton className="hidden md:inline-flex" />
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 max-w-4xl w-full mx-auto px-2 md:px-4">
          {empty ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 grid place-items-center mb-4">
                <Sparkles className="w-7 h-7 text-primary" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold mb-2">
                How can I help you study?
              </h1>
              <p className="text-sm text-muted-foreground mb-8 max-w-md">
                Chat is free. Generated notes, exam papers, slides and code each
                cost{" "}
                <span className="inline-flex items-center gap-0.5 text-primary">
                  <Zap className="w-3 h-3" fill="currentColor" />
                  1.5 credits
                </span>{" "}
                — only when generation succeeds.
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
              onEdit={handleEdit}
              onTopUp={() => setBuyOpen(true)}
              onConfirmAction={handleConfirmAction}
              onCancelAction={handleCancelAction}
            />
          )}

          <div className="shrink-0 pb-3 pt-2 space-y-2 sticky bottom-0 bg-gradient-to-t from-background via-background to-transparent">
            <ModelSelector value={model} onChange={setModel} />
            <InputBar
              value={input}
              onChange={setInput}
              onSend={(text) => handleSend(text)}
              onStop={handleStop}
              isLoading={loading}
              onPickArtifact={(t) => {
                if (!input.trim()) {
                  toast.info("Type a topic first, then pick an artifact type.");
                  return;
                }
                handleSend(input, t);
              }}
            />
            <p className="text-[10px] text-center text-muted-foreground/60">
              Lumina can make mistakes. Verify important info. Artifacts run as
              background jobs, and credits are only charged after success.
            </p>
          </div>
        </div>

        <BuyCreditsModal open={buyOpen} onOpenChange={setBuyOpen} />
      </div>
      {canvasOpen && (
        <div className="hidden md:flex flex-[0_0_54%] min-w-0 transition-all duration-300">
          <CanvasPanel
            open={canvasOpen}
            versions={canvasVersions}
            onClose={() => setCanvasOpen(false)}
          />
        </div>
      )}
      {activeArtifactId && (
        <PremiumArtifactWorkspace
          messages={messages}
          onQuote={(text) => setInput((prev) => `${prev}${prev ? "\n\n" : ""}${text}`)}
          onRegenerate={(messageId) => handleRegenerate(messageId)}
        />
      )}
    </div>
  );
};

export default ChatPage;

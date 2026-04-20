import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Download, MessageSquare, Database, Search, RefreshCw, FileJson } from "lucide-react";
import { toast } from "sonner";

interface Interaction {
  id: string;
  user_id: string | null;
  user_input: string;
  ai_response: string;
  subject: string | null;
  topic: string | null;
  source: string | null;
  model_used: string | null;
  quality_score: number | null;
  feedback: string | null;
  created_at: string;
  pii_scrubbed: boolean;
}

interface ChatRow {
  id: string;
  user_id: string;
  title: string;
  chat_type: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

interface ChatMsg {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

export default function TrainingData() {
  const [tab, setTab] = useState<"interactions" | "chats">("interactions");
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatRow | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalChats: 0, totalMsgs: 0, totalInteractions: 0, users: 0 });

  const loadAll = async () => {
    setLoading(true);
    const [iRes, cRes, statsChats, statsMsgs, statsInter] = await Promise.all([
      supabase.from("learning_interactions").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("chats").select("*").order("updated_at", { ascending: false }).limit(200),
      supabase.from("chats").select("user_id", { count: "exact", head: false }),
      supabase.from("chat_messages").select("id", { count: "exact", head: true }),
      supabase.from("learning_interactions").select("id", { count: "exact", head: true }),
    ]);
    if (iRes.data) setInteractions(iRes.data as any);
    if (cRes.data) setChats(cRes.data as any);
    const uniqueUsers = new Set((statsChats.data || []).map((r: any) => r.user_id)).size;
    setStats({
      totalChats: statsChats.count ?? 0,
      totalMsgs: statsMsgs.count ?? 0,
      totalInteractions: statsInter.count ?? 0,
      users: uniqueUsers,
    });
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const openChat = async (c: ChatRow) => {
    setSelectedChat(c);
    const { data } = await supabase.from("chat_messages").select("*").eq("chat_id", c.id).order("created_at", { ascending: true });
    setChatMessages((data as any) || []);
  };

  const exportInteractionsJsonl = () => {
    const pairs = interactions
      .filter((i) => i.user_input && i.ai_response)
      .map((i) => JSON.stringify({ instruction: i.user_input, output: i.ai_response, subject: i.subject, topic: i.topic, source: i.source }));
    const blob = new Blob([pairs.join("\n")], { type: "application/jsonl" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `lumina-training-${Date.now()}.jsonl`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${pairs.length} pairs`);
  };

  const exportChatsJsonl = async () => {
    toast.info("Loading all chat messages...");
    const { data: allMsgs } = await supabase.from("chat_messages").select("*").order("chat_id").order("created_at");
    if (!allMsgs) { toast.error("Failed to load"); return; }
    const byChat: Record<string, ChatMsg[]> = {};
    (allMsgs as any[]).forEach((m) => { (byChat[m.chat_id] ||= []).push(m); });
    const pairs: string[] = [];
    Object.values(byChat).forEach((msgs) => {
      for (let i = 0; i < msgs.length - 1; i++) {
        if (msgs[i].role === "user" && msgs[i + 1].role === "assistant") {
          pairs.push(JSON.stringify({ instruction: msgs[i].content, output: msgs[i + 1].content }));
        }
      }
    });
    const blob = new Blob([pairs.join("\n")], { type: "application/jsonl" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `lumina-chats-${Date.now()}.jsonl`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${pairs.length} pairs from ${Object.keys(byChat).length} chats`);
  };

  const filteredInteractions = interactions.filter((i) =>
    !search || i.user_input.toLowerCase().includes(search.toLowerCase()) || (i.topic || "").toLowerCase().includes(search.toLowerCase())
  );
  const filteredChats = chats.filter((c) => !search || c.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Database className="w-7 h-7 text-primary" /> Training Data
            </h1>
            <p className="text-sm text-muted-foreground mt-1">All user ↔ AI conversations available for fine-tuning Lumina.</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadAll}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4"><div className="text-xs text-muted-foreground">Chats</div><div className="text-2xl font-bold">{stats.totalChats}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Messages</div><div className="text-2xl font-bold">{stats.totalMsgs}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Logged interactions</div><div className="text-2xl font-bold">{stats.totalInteractions}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Unique users</div><div className="text-2xl font-bold">{stats.users}</div></Card>
        </div>

        {/* Tabs + actions */}
        <div className="flex flex-wrap gap-2 items-center">
          <Button variant={tab === "interactions" ? "default" : "outline"} size="sm" onClick={() => setTab("interactions")}>Pipeline ({stats.totalInteractions})</Button>
          <Button variant={tab === "chats" ? "default" : "outline"} size="sm" onClick={() => setTab("chats")}>Chats ({stats.totalChats})</Button>
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search topics, titles..." className="pl-9 h-9" />
          </div>
          <Button size="sm" onClick={tab === "interactions" ? exportInteractionsJsonl : exportChatsJsonl}>
            <Download className="w-4 h-4 mr-2" /> Export JSONL
          </Button>
        </div>

        {/* Interactions tab */}
        {tab === "interactions" && (
          <div className="space-y-2">
            {loading && <div className="text-center text-muted-foreground py-8">Loading…</div>}
            {!loading && filteredInteractions.length === 0 && <div className="text-center text-muted-foreground py-8">No interactions yet.</div>}
            {filteredInteractions.map((i) => (
              <Card key={i.id} className="p-4">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {i.source && <Badge variant="outline" className="text-xs">{i.source}</Badge>}
                  {i.subject && <Badge variant="secondary" className="text-xs">{i.subject}</Badge>}
                  {i.topic && <Badge variant="secondary" className="text-xs">{i.topic}</Badge>}
                  {i.model_used && <span className="text-[10px] text-muted-foreground">{i.model_used}</span>}
                  {i.quality_score !== null && <span className="text-[10px] text-muted-foreground ml-auto">Q: {i.quality_score}</span>}
                  <span className="text-[10px] text-muted-foreground">{new Date(i.created_at).toLocaleString()}</span>
                </div>
                <div className="text-xs space-y-2">
                  <div><span className="font-semibold text-primary">User:</span> <span className="text-foreground/90">{i.user_input.slice(0, 400)}{i.user_input.length > 400 ? "…" : ""}</span></div>
                  <div><span className="font-semibold text-primary">AI:</span> <span className="text-foreground/80">{i.ai_response.slice(0, 500)}{i.ai_response.length > 500 ? "…" : ""}</span></div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Chats tab */}
        {tab === "chats" && (
          <div className="grid md:grid-cols-[320px_1fr] gap-3">
            <div className="space-y-1.5 max-h-[70vh] overflow-y-auto">
              {filteredChats.map((c) => (
                <button key={c.id} onClick={() => openChat(c)} className={`w-full text-left p-3 rounded-lg border transition ${selectedChat?.id === c.id ? "border-primary bg-primary/5" : "border-border/30 hover:border-border/60"}`}>
                  <div className="text-sm font-medium truncate">{c.title}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                    <MessageSquare className="w-3 h-3" />{new Date(c.updated_at).toLocaleDateString()}
                    <span className="ml-auto truncate">{c.user_id.slice(0, 8)}</span>
                  </div>
                </button>
              ))}
            </div>
            <Card className="p-4 max-h-[70vh] overflow-y-auto">
              {!selectedChat && <div className="text-sm text-muted-foreground text-center py-8">Select a chat to view messages.</div>}
              {selectedChat && (
                <>
                  <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/30">
                    <FileJson className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-sm flex-1 truncate">{selectedChat.title}</h3>
                    <Badge variant="outline" className="text-[10px]">{chatMessages.length} msgs</Badge>
                  </div>
                  <div className="space-y-3">
                    {chatMessages.map((m) => (
                      <div key={m.id} className={`text-xs p-2.5 rounded-md ${m.role === "user" ? "bg-primary/10 border border-primary/20" : "bg-muted/30"}`}>
                        <div className="font-semibold text-[10px] uppercase mb-1 opacity-70">{m.role}</div>
                        <div className="whitespace-pre-wrap">{m.content}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

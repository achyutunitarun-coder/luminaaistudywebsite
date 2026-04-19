import { useEffect, useState } from "react";
import { Shield, Download, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const PROVIDERS = [
  { name: "GPT-OSS / GPT-5", provider: "OpenAI", url: "https://openai.com/policies/privacy-policy" },
  { name: "Nemotron 120B", provider: "NVIDIA", url: "https://www.nvidia.com/en-us/about-nvidia/privacy-policy/" },
  { name: "Llama 3.3 70B", provider: "Meta", url: "https://www.meta.com/legal/privacy-policy/" },
  { name: "Gemma / Gemini", provider: "Google", url: "https://policies.google.com/privacy" },
  { name: "Qwen 3", provider: "Alibaba", url: "https://www.alibabacloud.com/en/privacy" },
  { name: "All others", provider: "OpenRouter / Lovable", url: "https://openrouter.ai/privacy" },
];

export default function PrivacySettings() {
  const { user } = useAuth();
  const [optIn, setOptIn] = useState(true);
  const [counts, setCounts] = useState<{ chats: number; artifacts: number; interactions: number } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: c }, ck, ak, ik] = await Promise.all([
        supabase.from("data_consent").select("training_data_opt_in").eq("user_id", user.id).maybeSingle(),
        supabase.from("chats").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("chat_artifacts").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("learning_interactions").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      if (c) setOptIn(!!c.training_data_opt_in);
      setCounts({ chats: ck.count || 0, artifacts: ak.count || 0, interactions: ik.count || 0 });
    })();
  }, [user]);

  const toggleOptIn = async (v: boolean) => {
    if (!user) return;
    setOptIn(v);
    const { error } = await supabase.from("data_consent").upsert({ user_id: user.id, training_data_opt_in: v }, { onConflict: "user_id" });
    if (error) { toast.error("Could not update"); return; }
    toast.success(v ? "Opted in to training data" : "Opted out");
  };

  const exportData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [chats, msgs, arts] = await Promise.all([
        supabase.from("chats").select("*").eq("user_id", user.id),
        supabase.from("chat_messages").select("*, chats!inner(user_id)").eq("chats.user_id", user.id),
        supabase.from("chat_artifacts").select("*").eq("user_id", user.id),
      ]);
      const blob = new Blob([JSON.stringify({ chats: chats.data, messages: msgs.data, artifacts: arts.data }, null, 2)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `lumina-export-${Date.now()}.json`; a.click();
      toast.success("Exported!");
    } catch { toast.error("Export failed"); }
    setLoading(false);
  };

  const deleteAll = async (confirm: string) => {
    if (!user) return;
    if (confirm !== "DELETE") { toast.error('Type "DELETE" to confirm'); return; }
    setLoading(true);
    const { error } = await supabase.functions.invoke("learning-pipeline", { body: { action: "delete_me" } });
    if (error) { toast.error("Delete failed"); setLoading(false); return; }
    await supabase.from("chats").delete().eq("user_id", user.id);
    await supabase.from("chat_artifacts").delete().eq("user_id", user.id);
    toast.success("All your data was deleted");
    setLoading(false);
    setTimeout(() => window.location.reload(), 1500);
  };

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Privacy & Data</h1>
          <p className="text-sm text-muted-foreground">Control how your data is used.</p>
        </div>
      </div>

      {/* Storage usage */}
      {counts && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Conversations", v: counts.chats },
            { label: "Generated files", v: counts.artifacts },
            { label: "Anon. interactions", v: counts.interactions },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-border/15 bg-muted/8 p-3">
              <div className="text-2xl font-bold">{s.v}</div>
              <div className="text-[11px] text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Training opt-in */}
      <div className="rounded-xl border border-border/15 bg-muted/5 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-semibold mb-1">Help improve Lumina</div>
            <p className="text-xs text-muted-foreground">
              Allow your anonymized (PII-scrubbed) interactions to be used for training a future Lumina model.
              You can opt out anytime.
            </p>
          </div>
          <Switch checked={optIn} onCheckedChange={toggleOptIn} />
        </div>
      </div>

      {/* AI Provider disclosure */}
      <div className="rounded-xl border border-border/15 bg-muted/5 p-4">
        <div className="font-semibold mb-2">AI providers used</div>
        <p className="text-xs text-muted-foreground mb-3">
          When you generate content, prompts may be processed by these providers. Each has their own policy.
        </p>
        <div className="space-y-1.5">
          {PROVIDERS.map(p => (
            <div key={p.name} className="flex items-center justify-between text-xs py-1 border-b border-border/8 last:border-0">
              <div><strong>{p.name}</strong> <span className="text-muted-foreground">· {p.provider}</span></div>
              <a href={p.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">Privacy policy →</a>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="rounded-xl border border-border/15 bg-muted/5 p-4 space-y-2">
        <div className="font-semibold mb-2">Your data</div>
        <Button onClick={exportData} disabled={loading} variant="outline" className="w-full justify-start">
          <Download className="w-4 h-4 mr-2" /> Export all my data (JSON)
        </Button>
        <Button
          onClick={() => {
            const c = window.prompt('Type "DELETE" to permanently delete all your conversations, files, and interactions:');
            if (c !== null) deleteAll(c);
          }}
          disabled={loading}
          variant="outline"
          className="w-full justify-start text-destructive hover:bg-destructive/10 border-destructive/30"
        >
          <Trash2 className="w-4 h-4 mr-2" /> Delete everything
        </Button>
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground rounded-lg bg-amber-500/5 border border-amber-500/15 p-3">
        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          Lumina itself does not train on your conversations. However, free-tier providers (OpenRouter) may log prompts.
          Avoid putting private personal info in messages.
        </div>
      </div>
    </div>
  );
}

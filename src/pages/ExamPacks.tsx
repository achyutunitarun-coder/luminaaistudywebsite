import { useState, useEffect, useRef } from "react";
import { Lock, Check, Sparkles, X, Loader2, Download, Printer, Brain, Wand2, FileText, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { THEMES, type ThemeId } from "@/lib/luminaThemes";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { HtmlArtifactFrame } from "@/components/HtmlArtifactFrame";

interface Pack {
  id: string;
  product_id: string;
  title: string;
  description: string;
  subject: string;
  level: string;
  emoji: string;
  price_cents: number;
  original_price_cents: number;
  whats_inside: string[];
}

const LEVEL_COLORS: Record<string, string> = {
  Foundation: "from-emerald-500 to-teal-500",
  Intermediate: "from-blue-500 to-cyan-500",
  Advanced: "from-violet-500 to-purple-500",
  Mastery: "from-amber-500 to-orange-500",
};

export default function ExamPacks() {
  const { user } = useAuth();
  const [theme, setTheme] = useState<ThemeId>("cosmos");
  const [packs, setPacks] = useState<Pack[]>([]);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [loadingPacks, setLoadingPacks] = useState(true);
  const [filter, setFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string>("ALL");
  const [openPack, setOpenPack] = useState<Pack | null>(null);
  const [packHtml, setPackHtml] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => { loadPacks(); }, [user]);

  async function loadPacks() {
    setLoadingPacks(true);
    const { data } = await supabase.from("exam_packs").select("*").eq("active", true).order("sort_order");
    if (data) setPacks(data as unknown as Pack[]);
    if (user) {
      const { data: ul } = await supabase.from("user_unlocked_packs").select("pack_id, payment_status").eq("user_id", user.id).eq("payment_status", "paid");
      setUnlocked(new Set((ul || []).map((u: { pack_id: string }) => u.pack_id)));
    }
    setLoadingPacks(false);
  }

  async function handleUnlock(pack: Pack) {
    if (!user) { toast.error("Sign in first"); return; }
    setUnlocking(pack.id);
    try {
      const { data, error } = await supabase.functions.invoke("dodo-checkout", {
        body: { product_id: pack.product_id, pack_id: pack.id, return_url: window.location.href },
      });
      if (error) throw error;
      if (data?.checkout_url) {
        window.open(data.checkout_url, "_blank");
        toast.success("Complete payment in the new tab. Your pack will unlock automatically once paid.");
        // Keep `unlocking` set so the polling effect runs until webhook flips status to "paid"
      } else {
        throw new Error("No checkout URL");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Checkout failed");
      setUnlocking(null);
    }
  }

  // Poll for payment completion when user returns from Dodo checkout
  const pollRef = useRef<number | null>(null);
  useEffect(() => {
    if (!user || !unlocking) return;
    pollRef.current = window.setInterval(async () => {
      const { data } = await supabase
        .from("user_unlocked_packs")
        .select("pack_id, payment_status")
        .eq("user_id", user.id)
        .eq("payment_status", "paid");
      const paidIds = new Set((data || []).map((u: { pack_id: string }) => u.pack_id));
      if (paidIds.has(unlocking)) {
        setUnlocked(paidIds);
        const justPaid = packs.find((p) => p.id === unlocking);
        setUnlocking(null);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 2500);
        toast.success("Payment confirmed! Generating your pack…");
        if (justPaid) openPackHtml(justPaid);
      }
    }, 4000);
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
  }, [user, unlocking, packs]);

  async function openPackHtml(pack: Pack) {
    if (!user) return;
    setOpenPack(pack);
    setPackHtml(null);
    setGenerating(true);

    // Try cached HTML first
    const path = `${user.id}/${pack.id}.html`;
    const { data: file } = await supabase.storage.from("exam-pack-html").download(path);
    if (file) {
      const text = await file.text();
      setPackHtml(text);
      setGenerating(false);
      return;
    }

    // Generate fresh
    const t = THEMES[theme];
    const { data, error } = await supabase.functions.invoke("generate-content", {
      body: { mode: "exam-pack", packTitle: pack.title, subject: pack.subject, packLevel: pack.level, theme: { bg: t.bg, primary: t.primary, accent: t.accent, fontHead: t.fontHead, fontBody: t.fontBody, googleFonts: t.googleFonts } },
    });
    if (error || !data?.html) {
      toast.error("Generation failed — please retry");
      setGenerating(false);
      return;
    }
    if (Array.isArray(data.fallbacks) && data.fallbacks.length > 0) toast.message("Switching to backup model…");
    setPackHtml(data.html);

    // Cache to storage
    await supabase.storage.from("exam-pack-html").upload(path, new Blob([data.html], { type: "text/html" }), { upsert: true, contentType: "text/html" });
    await supabase.from("user_unlocked_packs").update({ html_storage_path: path, generated_at: new Date().toISOString() }).eq("user_id", user.id).eq("pack_id", pack.id);
    setGenerating(false);
  }

  const subjects = ["ALL", ...Array.from(new Set(packs.map((p) => p.subject)))];
  const filtered = packs.filter((p) =>
    (subjectFilter === "ALL" || p.subject === subjectFilter) &&
    (!filter || p.title.toLowerCase().includes(filter.toLowerCase()) || p.description.toLowerCase().includes(filter.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 relative">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold">Exam Packs</h1>
          <p className="text-sm text-muted-foreground">One-time purchase. Lifetime access.</p>
        </div>
        <ThemeSwitcher value={theme} onChange={setTheme} />
      </div>

      <div className="flex gap-2 flex-wrap">
        <Input placeholder="Search packs…" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-xs h-10 rounded-xl" />
        <div className="flex gap-1.5 flex-wrap">
          {subjects.map((s) => (
            <button key={s} onClick={() => setSubjectFilter(s)} className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${subjectFilter === s ? "bg-primary text-primary-foreground border-primary" : "border-border/40 hover:border-primary/40"}`}>{s}</button>
          ))}
        </div>
      </div>

      {loadingPacks ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((pack) => {
            const isUnlocked = unlocked.has(pack.id);
            const levelGrad = LEVEL_COLORS[pack.level] || "from-primary to-accent";
            return (
              <div key={pack.id} className="group relative rounded-2xl liquid-glass-intense p-5 overflow-hidden transition-all duration-300 hover:-translate-y-2.5 hover:shadow-2xl">
                {/* shimmer sweep */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                  <div className="absolute -inset-y-1 -left-1/3 w-1/3 rotate-12 bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:translate-x-[400%] transition-transform duration-1000" />
                </div>

                <div className="flex items-start justify-between mb-3">
                  <div className="text-3xl">{pack.emoji}</div>
                  {isUnlocked && <span className="text-[10px] px-2 py-1 rounded-full bg-green-500/15 text-green-500 font-bold flex items-center gap-1"><Check className="w-3 h-3" />UNLOCKED</span>}
                </div>

                <span className="text-[10px] font-bold tracking-wider text-muted-foreground">{pack.subject}</span>
                <h3 className="font-display font-bold text-base mt-1 leading-tight line-clamp-2">{pack.title}</h3>
                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{pack.description}</p>

                <div className="mt-3 space-y-1">
                  {(pack.whats_inside || []).slice(0, 4).map((b, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground"><Check className="w-3 h-3 text-primary mt-0.5 shrink-0" />{b}</div>
                  ))}
                </div>

                <div className="flex items-center justify-between mt-4">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-md bg-gradient-to-r ${levelGrad} text-white`}>{pack.level}</span>
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground line-through mr-1">₹{pack.original_price_cents / 100}</span>
                    <span className="font-bold text-lg">₹{pack.price_cents / 100}</span>
                  </div>
                </div>

                {isUnlocked ? (
                  <Button onClick={() => openPackHtml(pack)} className="w-full mt-3 rounded-xl h-10" variant="outline">View Pack →</Button>
                ) : (
                  <Button onClick={() => handleUnlock(pack)} disabled={unlocking === pack.id} className="w-full mt-3 rounded-xl h-10 font-semibold" style={{ background: THEMES[theme].swatch, color: "#fff" }}>
                    {unlocking === pack.id ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Awaiting payment…</> : <><Lock className="w-3.5 h-3.5 mr-1.5" />Unlock for ₹{pack.price_cents / 100}</>}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Fullscreen pack modal */}
      <Dialog open={!!openPack} onOpenChange={(o) => { if (!o) { setOpenPack(null); setPackHtml(null); } }}>
        <DialogContent className="max-w-6xl h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b border-border/30 flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2"><span className="text-2xl">{openPack?.emoji}</span>{openPack?.title}</DialogTitle>
            <div className="flex gap-2">
              {packHtml && (
                <>
                  <Button size="sm" variant="outline" onClick={() => { const b = new Blob([packHtml], { type: "text/html" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = `${openPack?.title}.html`; a.click(); URL.revokeObjectURL(u); }}><Download className="w-4 h-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => { const w = window.open(""); if (!w) return; w.document.write(packHtml); w.document.close(); setTimeout(() => w.print(), 500); }}><Printer className="w-4 h-4" /></Button>
                </>
              )}
            </div>
          </DialogHeader>
          <div className="overflow-auto h-full">
            {generating ? (
              <PackGeneratingLoader title={openPack?.title || ""} />
            ) : packHtml ? (
              <div className="px-6 py-4"><HtmlArtifactFrame html={packHtml} title={openPack?.title} /></div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confetti */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-[300]">
          {Array.from({ length: 60 }).map((_, i) => (
            <div key={i} className="absolute w-2 h-2 rounded-sm" style={{
              left: `${Math.random() * 100}%`,
              top: "-10px",
              background: ["#7B61FF","#00F5C4","#FF006E","#C9973F","#FBBF24"][i % 5],
              animation: `confetti-fall ${1.5 + Math.random() * 1.5}s linear forwards`,
              animationDelay: `${Math.random() * 0.4}s`,
              transform: `rotate(${Math.random() * 360}deg)`,
            }} />
          ))}
        </div>
      )}
      <style>{`@keyframes confetti-fall { to { transform: translateY(110vh) rotate(720deg); opacity: 0 } }`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Cinematic loader — multi-stage progress while the AI builds the pack
// ─────────────────────────────────────────────────────────────────
function PackGeneratingLoader({ title }: { title: string }) {
  const stages = [
    { icon: Brain, label: "Analyzing syllabus", detail: "Mapping every concept and sub-topic" },
    { icon: FileText, label: "Drafting Master Notes", detail: "2500+ words of exam-ready prose" },
    { icon: Wand2, label: "Generating MCQs & flashcards", detail: "25 questions · 20 flashcards · 5 essays" },
    { icon: Sparkles, label: "Polishing visuals", detail: "Animations, gradients, particle field" },
    { icon: Zap, label: "Final assembly", detail: "Stitching all 21 sections together" },
  ];
  const [stage, setStage] = useState(0);
  const [pct, setPct] = useState(4);

  useEffect(() => {
    const stageMs = [9000, 22000, 30000, 25000, 999999];
    const t = window.setTimeout(() => {
      setStage((s) => (s < stages.length - 1 ? s + 1 : s));
    }, stageMs[stage] || 20000);
    return () => clearTimeout(t);
  }, [stage]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPct((p) => (p < 96 ? p + (p < 60 ? 0.6 : 0.18) : p));
    }, 220);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden flex items-center justify-center">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[10%] left-[15%] w-72 h-72 rounded-full bg-primary/20 blur-[80px] animate-pulse" />
        <div className="absolute bottom-[10%] right-[12%] w-80 h-80 rounded-full bg-accent/20 blur-[90px] animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-[40%] right-[30%] w-56 h-56 rounded-full bg-primary/10 blur-[70px] animate-pulse" style={{ animationDelay: "2s" }} />
      </div>

      <div className="relative z-10 max-w-lg w-full px-8 text-center space-y-8">
        <div className="relative w-28 h-28 mx-auto">
          <div className="absolute inset-0 rounded-full border-2 border-primary/15" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary border-r-accent animate-spin" style={{ animationDuration: "1.6s" }} />
          <div className="absolute inset-2 rounded-full border border-transparent border-b-primary/60 animate-spin" style={{ animationDuration: "2.4s", animationDirection: "reverse" }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-9 h-9 text-primary animate-pulse" />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Lumina AI</p>
          <h2 className="text-2xl font-display font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent bg-[length:200%_auto] animate-[shimmer_4s_linear_infinite]">
            Crafting {title}
          </h2>
          <p className="text-sm text-muted-foreground">This pack is being built from scratch — usually 30–90 seconds.</p>
        </div>

        <div className="space-y-2">
          <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-primary transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground tracking-wider">
            <span>STEP {stage + 1} / {stages.length}</span>
            <span>{Math.round(pct)}%</span>
          </div>
        </div>

        <div className="space-y-2 text-left">
          {stages.map((s, i) => {
            const Icon = s.icon;
            const isDone = i < stage;
            const isActive = i === stage;
            return (
              <div
                key={i}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all duration-500 ${
                  isActive
                    ? "border-primary/40 bg-primary/5 shadow-[0_0_24px_rgba(123,97,255,0.15)]"
                    : isDone
                    ? "border-border/30 opacity-50"
                    : "border-border/20 opacity-30"
                }`}
              >
                <div className={`mt-0.5 ${isActive ? "text-primary animate-pulse" : isDone ? "text-accent" : "text-muted-foreground"}`}>
                  {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</p>
                  <p className="text-[11px] text-muted-foreground/70">{s.detail}</p>
                </div>
                {isActive && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary mt-1" />}
              </div>
            );
          })}
        </div>
      </div>
      <style>{`@keyframes shimmer { to { background-position: 200% center } }`}</style>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { Sparkles, Copy, Download, Printer, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { THEMES, THEME_LIST, type ThemeId } from "@/lib/luminaThemes";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { HtmlArtifactFrame } from "@/components/HtmlArtifactFrame";
import { supabase } from "@/integrations/supabase/client";

const SUBJECTS = ["Mathematics","Physics","Chemistry","Biology","History","Geography","Economics","English Literature","Computer Science","General Studies"];
const LOADING_MESSAGES = [
  "Structuring your concepts…",
  "Building your timeline…",
  "Crafting your flashcards…",
  "Weaving your case study…",
];

export default function StudyNotesGenerator() {
  const [theme, setTheme] = useState<ThemeId>("cosmos");
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("Mathematics");
  const [loading, setLoading] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [loadingIdx, setLoadingIdx] = useState(0);
  const progressTimer = useRef<number | null>(null);
  const cycleTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (progressTimer.current) clearInterval(progressTimer.current);
    if (cycleTimer.current) clearInterval(cycleTimer.current);
  }, []);

  const generate = async () => {
    if (!topic.trim()) { toast.error("Enter a topic"); return; }
    setLoading(true);
    setHtml(null);
    setProgress(5);
    setLoadingIdx(0);
    progressTimer.current = window.setInterval(() => setProgress((p) => Math.min(p + Math.random() * 8, 92)), 800);
    cycleTimer.current = window.setInterval(() => setLoadingIdx((i) => (i + 1) % LOADING_MESSAGES.length), 4000);

    try {
      const t = THEMES[theme];
      const { data, error } = await supabase.functions.invoke("generate-content", {
        body: { mode: "notes", topic, subject, theme: { bg: t.bg, primary: t.primary, accent: t.accent, fontHead: t.fontHead, fontBody: t.fontBody, googleFonts: t.googleFonts } },
      });
      if (error) throw error;
      if (!data?.html) throw new Error("No HTML returned");

      // toast on every fallback model used
      if (Array.isArray(data.fallbacks) && data.fallbacks.length > 0) {
        toast.message("Switching to backup model…", { description: `Used: ${data.model}` });
      } else {
        toast.success(`Generated with ${data.model}`);
      }
      setProgress(100);
      setHtml(data.html);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      if (progressTimer.current) clearInterval(progressTimer.current);
      if (cycleTimer.current) clearInterval(cycleTimer.current);
      setTimeout(() => setLoading(false), 400);
    }
  };

  const copy = () => { if (html) { navigator.clipboard.writeText(html); toast.success("HTML copied"); } };
  const download = () => {
    if (!html) return;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${topic || "notes"}.html`; a.click();
    URL.revokeObjectURL(url);
  };
  const print = () => {
    if (!html) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html); w.document.close();
    setTimeout(() => w.print(), 600);
  };

  const t = THEMES[theme];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Study Notes Generator</h1>
          <p className="text-sm text-muted-foreground">One topic in. One gorgeous, fully-structured study artifact out.</p>
        </div>
        <ThemeSwitcher value={theme} onChange={setTheme} />
      </div>

      <div className="rounded-3xl liquid-glass-intense p-6 space-y-4">
        <div className="grid md:grid-cols-[1fr_220px_auto] gap-3 items-end">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Topic</label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Photosynthesis, Newton's Laws, French Revolution" className="h-12 rounded-xl" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Subject</label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={generate} disabled={loading} className="h-12 px-6 rounded-xl text-base font-semibold" style={{ background: t.swatch, color: theme === "aurora" || theme === "editorial" ? "#fff" : "#fff" }}>
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Generate Notes <Sparkles className="w-4 h-4 ml-1.5" /></>}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          {THEME_LIST.map((th) => (
            <span key={th.id} className="px-2 py-0.5 rounded-full border border-border/30">{th.label}</span>
          ))}
          <span className="ml-auto opacity-70">12-model waterfall · 8s timeout each</span>
        </div>
      </div>

      {html && (
        <>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={copy} className="rounded-xl"><Copy className="w-4 h-4 mr-1.5" />Copy HTML</Button>
            <Button size="sm" variant="outline" onClick={download} className="rounded-xl"><Download className="w-4 h-4 mr-1.5" />Download</Button>
            <Button size="sm" variant="outline" onClick={print} className="rounded-xl"><Printer className="w-4 h-4 mr-1.5" />Print</Button>
            <Button size="sm" variant="outline" onClick={generate} className="rounded-xl"><RefreshCw className="w-4 h-4 mr-1.5" />Regenerate</Button>
          </div>
          <HtmlArtifactFrame html={html} title={topic} />
        </>
      )}

      {/* Cinematic loading overlay */}
      {loading && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center" style={{ background: "rgba(4,4,14,0.92)", backdropFilter: "blur(20px)" }}>
          <div className="relative">
            <div className="w-28 h-28 rounded-full animate-pulse" style={{ background: t.swatch, boxShadow: `0 0 80px ${t.primary}` }} />
            <div className="absolute inset-0 flex items-center justify-center text-white text-3xl font-bold">✦</div>
          </div>
          <p className="mt-8 text-white/90 text-lg font-medium animate-fade-in" key={loadingIdx}>{LOADING_MESSAGES[loadingIdx]}</p>
          <div className="mt-6 w-72 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full transition-all duration-700" style={{ width: `${progress}%`, background: t.swatch }} />
          </div>
          {/* floating particles */}
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="absolute w-1 h-1 rounded-full opacity-50" style={{
              background: t.accent,
              left: `${(i * 53) % 100}%`,
              top: `${(i * 71) % 100}%`,
              animation: `float-particle ${4 + (i % 5)}s ease-in-out infinite`,
              animationDelay: `${i * 0.2}s`,
            }} />
          ))}
        </div>
      )}

      <style>{`@keyframes float-particle { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-30px) } }`}</style>
    </div>
  );
}

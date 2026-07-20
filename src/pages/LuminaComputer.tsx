import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Loader2, RefreshCw, Trash2, Download, FileText, LayoutGrid,
  Table as TableIcon, Globe, Bot, CheckCircle2, XCircle, Clock, ArrowUp,
  CornerDownLeft, Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  planBlocks, streamRoute, createProject, listProjects, getProject,
  insertBlocks, listBlocks, updateBlock, updateProject, deleteProject,
  type LcBlock, type LcProject, type OutputType,
} from "@/features/luminaComputer/api";
import { WebsitePreview } from "@/features/luminaComputer/WebsitePreview";
import { SYSTEM_PROMPTS, buildGeneratePrompt, ANTI_ECHO_GUARD, styleDirective } from "@/features/luminaComputer/config";

const MODES: Array<{ key: OutputType; label: string; icon: any; role: string; sub: string }> = [
  { key: "doc",     label: "Docs",     icon: FileText,   role: "content", sub: "Long-form structured writing" },
  { key: "slides",  label: "Slides",   icon: LayoutGrid, role: "content", sub: "Deck, one slide per block" },
  { key: "sheet",   label: "Sheets",   icon: TableIcon,  role: "content", sub: "Tabs with live formulas" },
  { key: "website", label: "Websites", icon: Globe,      role: "code",    sub: "Single-page site sections" },
  { key: "agent",   label: "Agent",    icon: Bot,        role: "content", sub: "Mixed artifact — planner decides" },
];

const DESIGN_STYLES = [
  { id: "auto",       label: "Auto",       desc: "Let the AI choose" },
  { id: "editorial",  label: "Editorial",  desc: "Stripe Press, New Yorker — authoritative" },
  { id: "minimal",    label: "Minimal",    desc: "Clean, sparse, high whitespace" },
  { id: "bold",       label: "Bold",       desc: "Big type, high contrast, saturated accents" },
  { id: "technical",  label: "Technical",  desc: "Structured, code-friendly, precise" },
  { id: "warm",       label: "Warm",       desc: "Earthy tones, approachable, organic" },
  { id: "dark",       label: "Dark",       desc: "Deep backgrounds, neon accents, cyber" },
];

interface LogEntry { id: string; ts: number; text: string; tone: "info" | "ok" | "warn" | "err" }

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  goal?: string;
  project?: LcProject;
  blocks: LcBlock[];
  timestamp: number;
}

function nowStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

export default function LuminaComputer() {
  const [mode, setMode] = useState<OutputType>("doc");
  const [goal, setGoal] = useState("");
  const [projects, setProjects] = useState<LcProject[]>([]);
  const [active, setActive] = useState<LcProject | null>(null);
  const [blocks, setBlocks] = useState<LcBlock[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [designStyle, setDesignStyle] = useState("auto");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const streamingRef = useRef<Record<string, string>>({});
  const [, force] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => { listProjects().then(setProjects).catch(() => {}); }, []);
  const refreshList = () => listProjects().then(setProjects).catch(() => {});

  function pushLog(text: string, tone: LogEntry["tone"] = "info") {
    setLog((l) => [...l.slice(-200), { id: crypto.randomUUID(), ts: Date.now(), text, tone }]);
  }

  async function openProject(p: LcProject) {
    setActive(p);
    setLog([]);
    const bs = await listBlocks(p.id);
    setBlocks(bs);
    streamingRef.current = {};
  }

  async function handleBuild() {
    const g = goal.trim();
    if (!g) { toast.error("Type what you want to build"); return; }
    if (busy) return;
    setBusy(true);
    setLog([]);
    setGoal("");
    const chosenStyle = designStyle === "auto" ? null : designStyle;
    const screenshotUrl = (g.match(/https?:\/\/[^\s]+\.(?:png|jpe?g|gif|webp)/i) ?? [])[0];

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", goal: g, blocks: [], timestamp: Date.now() };
    setMessages((m) => [...m, userMsg]);

    try {
      pushLog(`Creating project…`, "info");
      const project = await createProject(g.slice(0, 80), mode);
      setActive(project);
      setBlocks([]);
      refreshList();

      pushLog(`Planning ${mode} blocks with orchestrator…`, "info");
      const plan = await planBlocks(g, mode);
      if (plan.is_fallback) {
        pushLog("Model failed to plan; using a structured fallback.", "warn");
        toast.info("Using a fallback plan due to model unavailability");
      }
      pushLog(`Plan ready — ${plan.blocks.length} blocks (via ${plan.model_used ?? "orchestrator"})`, "ok");

      const inserted = await insertBlocks(project.id, plan.blocks);
      setBlocks(inserted);

      await updateProject(project.id, { status: "generating" });

      const CONCURRENCY = 3;
      pushLog(`Generating ${inserted.length} blocks (max ${CONCURRENCY} in parallel)…`, "info");
      let cursor = 0;
      const total = inserted.length;
      let completed = 0;
      const runNext = async (): Promise<void> => {
        while (true) {
          const idx = cursor++;
          if (idx >= total) return;
          const block = inserted[idx];
          pushLog(`↑ start ${idx + 1}/${total}: ${block.title}`, "info");
          await generateBlock(project, block, g, chosenStyle, undefined, screenshotUrl);
          completed++;
          pushLog(`✓ done ${completed}/${total}: ${block.title}`, "ok");
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, total) }, () => runNext())
      );

      await updateProject(project.id, { status: "ready" });
      pushLog(`All blocks ready.`, "ok");
      refreshList();

      // Re-fetch to capture final content_json from generation — local `blocks` state is stale in this closure.
      const finalBlocks = await listBlocks(project.id).catch(() => [] as LcBlock[]);
      if (finalBlocks.length) setBlocks(finalBlocks);
      const assistantMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", goal: g, project, blocks: finalBlocks, timestamp: Date.now() };
      setMessages((m) => [...m, assistantMsg]);
    } catch (e: any) {
      pushLog(`Failed: ${e.message ?? e}`, "err");
      toast.error("Build failed");
    } finally {
      setBusy(false);
    }
  }

  function systemFor(mode: OutputType, blockType: string, overrideStyle?: string | null): string {
    const styleId = overrideStyle ?? designStyle;
    const styleDir = styleId !== "auto" ? `\n${styleDirective(styleId)}` : "";

    if (mode === "website" || blockType === "site_section")
      return `${SYSTEM_PROMPTS.code}${styleDir}${ANTI_ECHO_GUARD}`;

    return `${SYSTEM_PROMPTS.content}${styleDir}${ANTI_ECHO_GUARD}`;
  }

  async function generateBlock(project: LcProject, block: LcBlock, overallGoal: string, overrideStyle?: string | null, extraInstruction?: string, screenshotUrl?: string) {
    const t0 = Date.now();
    await updateBlock(block.id, { status: "generating" });
    setBlocks((bs) => bs.map((b) => b.id === block.id ? { ...b, status: "generating" } : b));
    streamingRef.current[block.id] = "";

    const role = block.block_type === "site_section" ? "code" : "content";
    const system = systemFor(project.output_type, block.block_type, overrideStyle);
    const prompt = buildGeneratePrompt(
      overallGoal,
      block.title ?? "",
      block.prompt_seed ?? "",
      block.content_json?.layout_hint,
      block.content_json?.narrative_beat,
      screenshotUrl,
      overrideStyle ?? undefined,
      extraInstruction?.trim() || undefined,
    );

    try {
      const { text, model } = await streamRoute({
        role, system, prompt,
        project_id: project.id, block_id: block.id,
        max_tokens: role === "code" ? 5200 : 2800,
        temperature: 0.82,
        onMeta: (m) => {
          pushLog(`↪ streaming from ${m.model}${m.fallback ? " (fallback)" : ""}`, m.fallback ? "warn" : "info");
          setBlocks((bs) => bs.map((b) => b.id === block.id ? { ...b, model_used: m.model } : b));
        },
        onToken: (tk) => {
          streamingRef.current[block.id] = (streamingRef.current[block.id] ?? "") + tk;
          force((n) => n + 1);
        },
        onError: (msg) => pushLog(`stream warning: ${msg}`, "warn"),
      });

      const parsed = parseContent(project.output_type, block.block_type, text);
      await updateBlock(block.id, {
        status: parsed ? "ready" : "error",
        content_json: parsed ?? null,
        rendered_html: null,
        model_used: model,
        error_text: parsed ? null : "parse_failed",
      });
      setBlocks((bs) => bs.map((b) => b.id === block.id ? {
        ...b, status: parsed ? "ready" : "error",
        content_json: parsed ?? null, model_used: model,
        error_text: parsed ? null : "parse_failed",
      } : b));
      pushLog(`Block ready: ${block.title} (${Date.now() - t0}ms)`, parsed ? "ok" : "warn");
    } catch (e: any) {
      await updateBlock(block.id, { status: "error", error_text: String(e.message ?? e).slice(0, 300) });
      setBlocks((bs) => bs.map((b) => b.id === block.id ? { ...b, status: "error", error_text: String(e) } : b));
      pushLog(`Block failed: ${block.title} — ${e.message ?? e}`, "err");
    } finally {
      delete streamingRef.current[block.id];
      force((n) => n + 1);
    }
  }

  function parseContent(mode: OutputType, blockType: string, text: string): any {
    const clean = text.trim();
    if (mode === "doc" || blockType === "doc_section") {
      return clean.length > 20 ? { markdown: clean } : null;
    }
    try { return JSON.parse(clean); } catch { /* */ }
    const m = clean.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch { /* */ } }
    return null;
  }

  async function regenerate(block: LcBlock, refinement?: string) {
    if (!active) return;
    pushLog(`Regenerating: ${block.title}${refinement ? ` — "${refinement.slice(0, 60)}"` : ""}`, "info");
    await generateBlock(active, block, active.title, designStyle === "auto" ? null : designStyle, refinement);
  }

  async function removeProject(p: LcProject) {
    if (!confirm(`Delete "${p.title}"?`)) return;
    await deleteProject(p.id);
    if (active?.id === p.id) { setActive(null); setBlocks([]); }
    refreshList();
    toast.success("Deleted");
  }

  async function exportProject(overrideProject?: LcProject, overrideBlocks?: LcBlock[]) {
    const p = overrideProject ?? active;
    const bs = overrideBlocks ?? blocks;
    if (!p) return;
    const mode = p.output_type;
    try {
      if (mode === "slides") {
        const { exportSlidesToPptx } = await import("@/features/luminaComputer/exportSlides");
        await exportSlidesToPptx(p.title, bs, p.title + (designStyle !== "auto" ? designStyle : ""));
        toast.success("Exported .pptx");
        return;
      }
      if (mode === "sheet") {
        const { exportSheetsToXlsx } = await import("@/features/luminaComputer/exportSheets");
        await exportSheetsToXlsx(p.title, bs);
        toast.success("Exported .xlsx");
        return;
      }
      if (mode === "doc" || mode === "agent") {
        const readyBlocks = bs.filter((b) => b.content_json);
        if (readyBlocks.length === 0) {
          toast.error("No blocks to export");
          return;
        }
        const docBlocks = readyBlocks.filter((b) => b.block_type === "doc_section" && b.content_json?.markdown);
        if (docBlocks.length > 0) {
          const { exportDocToDocx } = await import("@/features/luminaComputer/exportDoc");
          await exportDocToDocx(p.title, readyBlocks, p.title + (designStyle !== "auto" ? designStyle : ""));
          toast.success("Exported .docx");
          return;
        }
        const md = readyBlocks.map((b) => {
          if (b.block_type === "doc_section") return b.content_json?.markdown ?? "";
          if (b.block_type === "slide") {
            const c = b.content_json;
            let body = "";
            if (c?.bullets?.length) body = `\n${c.bullets.map((x: string) => `- ${x}`).join("\n")}`;
            if (c?.stat) body = `\n**${c.stat.value}** — ${c.stat.label}`;
            if (c?.quote) body = `\n> "${c.quote.text}" — ${c.quote.attribution}`;
            return `## ${c?.title ?? b.title}\n${body}`;
          }
          if (b.block_type === "site_section") return `### ${b.title}\n\n\`\`\`html\n${b.content_json?.html ?? ""}\n\`\`\`\n`;
          if (b.block_type === "sheet_tab") {
            const c = b.content_json;
            if (!c?.columns?.length) return "";
            const header = `| ${c.columns.join(" | ")} |`;
            const sep = `| ${c.columns.map(() => "---").join(" | ")} |`;
            const rows = (c.rows ?? []).map((r: any[]) => `| ${r.join(" | ")} |`).join("\n");
            return `### ${c.tab_name ?? b.title}\n${header}\n${sep}\n${rows}`;
          }
          return "";
        }).filter(Boolean).join("\n\n---\n\n");
        downloadFile(`${p.title}.md`, md || "# Empty document", "text/markdown");
        toast.success("Exported .md");
        return;
      }
      if (mode === "website") {
        const fontLink = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">`;
        const baseCss = `*,*::before,*::after{box-sizing:border-box}html,body{margin:0}body{background:#0a0a0d;color:#f5f5f4;font-family:'Inter',ui-sans-serif,system-ui;-webkit-font-smoothing:antialiased;font-feature-settings:"ss01","cv11"}h1,h2,h3,h4{font-family:'Fraunces',ui-serif,Georgia,serif;font-weight:500;letter-spacing:-0.02em;margin:0;color:#f5f5f4}p{color:#a1a1aa;line-height:1.65;margin:0}a{color:inherit}img{max-width:100%;display:block}`;
        const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(p.title)}</title>${fontLink}<script src="https://cdn.tailwindcss.com"></script><style>${baseCss}\n${bs.map((b) => b.content_json?.css ?? "").join("\n")}</style></head><body>${bs.map((b) => b.content_json?.html ?? "").join("\n")}<script>${bs.map((b) => b.content_json?.js ?? "").filter(Boolean).join("\n")}</script></body></html>`;
        downloadFile(`${p.title}.html`, html, "text/html");
        toast.success("Exported .html");
        return;
      }
      downloadFile(`${p.title}.json`, JSON.stringify(bs.map((b) => b.content_json), null, 2), "application/json");
      toast.success("Exported");
    } catch (e: any) {
      toast.error(`Export failed: ${e.message ?? e}`);
    }
  }

  useEffect(() => {
    const id = "lc-font-space-grotesk";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap";
    document.head.appendChild(link);
  }, []);

  const activeMode = MODES.find((m) => m.key === mode)!;
  const heading = { fontFamily: "'Space Grotesk', ui-sans-serif, system-ui" } as const;
  const mono = { fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace" } as const;

  return (
    <div className="min-h-screen w-full bg-[#08080c] text-zinc-300">
      <div className="mx-auto max-w-[1400px] px-4 py-6 md:py-8">
        <div className="rounded-xl border border-zinc-800/80 bg-[#0d0d10] shadow-2xl shadow-black/60 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 4rem)' }}>
          {/* Header bar */}
          <header className="h-14 border-b border-zinc-800/80 flex items-center justify-between px-4 md:px-6 bg-[#111114] shrink-0">
            <div className="flex items-center gap-4 min-w-0">
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="w-2.5 h-2.5 rounded-full bg-[#9d5cff] shadow-[0_0_10px_rgba(157,92,255,0.6)]" aria-hidden />
                <span style={heading} className="text-[13px] font-semibold tracking-[0.18em] text-zinc-300 uppercase">Lumina Computer</span>
              </div>
              <div className="h-4 w-px bg-zinc-800" />
              <span style={mono} className="text-[10px] text-zinc-600 tracking-wider uppercase hidden sm:inline">Workstation · v5</span>
            </div>

            <div className="flex items-center gap-3">
              <div role="tablist" aria-label="Output mode" className="flex bg-black/50 p-0.5 rounded-md border border-zinc-800">
                {MODES.map((m) => {
                  const on = mode === m.key;
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.key}
                      role="tab"
                      aria-selected={on}
                      onClick={() => setMode(m.key)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] uppercase tracking-wider rounded-[3px] transition-all
                        ${on
                          ? "text-zinc-100 bg-zinc-900 border border-zinc-700/60 shadow-sm"
                          : "text-zinc-600 hover:text-zinc-300 border border-transparent"}`}
                    >
                      <Icon className="h-3 w-3" aria-hidden />
                      <span className="hidden md:inline">{m.label}</span>
                    </button>
                  );
                })}
              </div>
              <a
                href="/lumina-computer/admin"
                style={mono}
                className="text-[10px] uppercase tracking-wider text-zinc-500 hover:text-zinc-200 px-2.5 py-1 rounded border border-zinc-800 hover:border-zinc-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9d5cff]/60"
                aria-label="Open routing and cooldowns dashboard"
              >
                Routing
              </a>
            </div>
          </header>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
            <div className="max-w-3xl mx-auto space-y-8">
              {messages.length === 0 ? (
                <div className="text-center py-20">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/50 mb-6" style={mono}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
                    <span className="text-[9px] uppercase tracking-widest text-zinc-500">System Ready</span>
                  </div>
                  <div style={heading} className="text-2xl text-zinc-200 mb-3">What are you building today?</div>
                  <p className="text-sm text-zinc-500 max-w-md mx-auto leading-relaxed">
                    Describe your project and I&apos;ll generate structured content, slides, sheets, or websites.
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-6">
                    {MODES.map((m) => {
                      const Icon = m.icon;
                      return (
                        <button key={m.key} onClick={() => setMode(m.key)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded-md border transition ${
                            mode === m.key
                              ? "border-zinc-600 bg-zinc-800 text-zinc-200"
                              : "border-zinc-800 text-zinc-500 hover:text-zinc-300"
                          }`}>
                          <Icon className="h-3 w-3" />
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                  {projects.length > 0 && (
                    <div className="mt-8 pt-8 border-t border-zinc-800/60">
                      <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-4 font-mono">Previous projects</div>
                      <ProjectList projects={projects} onOpen={openProject} onDelete={removeProject} />
                    </div>
                  )}
                </div>
              ) : (
                messages.map((msg, mi) => (
                  <div key={msg.id}>
                    {msg.role === "user" ? (
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-xs font-semibold text-zinc-400">U</span>
                        </div>
                        <div className="flex-1 min-w-0 pt-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span style={mono} className="text-[10px] uppercase tracking-widest text-zinc-500">You</span>
                            <span className="text-[9px] text-zinc-700 font-mono">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <div className="text-zinc-100 text-[15px] leading-relaxed whitespace-pre-wrap">{msg.goal}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#9d5cff]/15 flex items-center justify-center shrink-0 mt-0.5">
                          <Bot className="h-4 w-4 text-[#9d5cff]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-3">
                            <span style={mono} className="text-[10px] uppercase tracking-widest text-zinc-500">Lumina</span>
                            <span className="text-[9px] text-zinc-700 font-mono">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                            {msg.project && (
                              <span className="text-[9px] text-zinc-700 font-mono">· {msg.project.output_type}</span>
                            )}
                          </div>

                          {msg.project?.output_type === "website" ? (
                            <WebsitePreview blocks={msg.blocks} streamingText={streamingRef.current} onRegen={(b, r) => regenerate(b, r)} />
                          ) : (
                            <div className="space-y-4">
                              {msg.blocks.map((b) => (
                                <BlockPreview key={b.id} block={b} streaming={streamingRef.current[b.id]} onRegen={() => regenerate(b)} />
                              ))}
                            </div>
                          )}

                          {msg.project && (
                            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-zinc-800/50">
                              <button onClick={() => exportProject(msg.project, msg.blocks)}
                                className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md border border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 transition"
                              >
                                <Download className="h-3 w-3" />
                                Export
                              </button>
                              <button onClick={() => removeProject(msg.project!)}
                                className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md border border-zinc-800 text-zinc-500 hover:bg-zinc-900 hover:text-red-300 transition"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                              <button onClick={() => { setActive(msg.project!); setBlocks(msg.blocks); }}
                                className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md border border-zinc-800 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-100 transition"
                              >
                                <RefreshCw className="h-3 w-3" />
                                Open
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}

              {busy && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#9d5cff]/15 flex items-center justify-center shrink-0 mt-0.5">
                    <Loader2 className="h-4 w-4 text-[#9d5cff] animate-spin" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-3">
                      <span style={mono} className="text-[10px] uppercase tracking-widest text-zinc-500">Lumina</span>
                      <span className="text-[9px] text-zinc-700 font-mono">building…</span>
                    </div>
                    <BuildProgress blocks={blocks} />
                    <div className="mt-3 rounded-lg border border-zinc-800 bg-[#0c0c10] p-3">
                      <div style={mono} className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2 px-1">Build trace</div>
                      <div className="space-y-0.5 max-h-[30vh] overflow-y-auto">
                        {blocks.map((b, i) => <TraceRow key={b.id} idx={i} block={b} onRegen={() => regenerate(b)} reduce={!!reduce} />)}
                        {blocks.length === 0 && <div style={mono} className="text-[10px] text-zinc-600 px-2 py-4">Planning…</div>}
                      </div>
                    </div>
                    <LogPanel entries={log} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Input bar */}
          <div className="shrink-0 px-4 md:px-8 pb-4 pt-3 border-t border-zinc-800/60 bg-[#0a0a0d]/80">
            <div className="max-w-3xl mx-auto">
              <div className="relative group">
                <div className="absolute -inset-px bg-gradient-to-b from-zinc-700/40 to-zinc-900/0 rounded-xl opacity-40 group-focus-within:opacity-80 blur-[2px] transition duration-500 pointer-events-none" />
                <div className="relative bg-[#0f0f13] border border-zinc-800 rounded-xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]">
                  <textarea
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder={`Describe what to build (e.g. "Investor pitch for our Series A")`}
                    rows={3}
                    disabled={busy}
                    style={heading}
                    className="w-full bg-transparent border-none text-zinc-100 placeholder-zinc-600 text-[15px] leading-relaxed focus:ring-0 focus:outline-none resize-none px-5 pt-4 pb-3"
                    onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleBuild(); }}
                  />
                  <div className="flex items-center justify-between border-t border-zinc-800/70 px-4 py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex flex-wrap gap-1.5">
                        {DESIGN_STYLES.filter((s) => s.id !== "auto").slice(0, 4).map((s) => (
                          <button key={s.id} onClick={() => setDesignStyle(s.id)}
                            title={s.desc}
                            className={`text-[9px] px-1.5 py-0.5 rounded transition ${
                              designStyle === s.id
                                ? "bg-zinc-800 text-zinc-300 border border-zinc-600"
                                : "bg-zinc-900/50 text-zinc-600 hover:text-zinc-400 border border-transparent"
                            }`}
                          >{s.label}</button>
                        ))}
                        {designStyle !== "auto" && (
                          <button onClick={() => setDesignStyle("auto")}
                            className="text-[9px] px-1.5 py-0.5 rounded text-zinc-600 hover:text-zinc-400 border border-transparent"
                          ><span aria-hidden>x</span></button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span style={mono} className="hidden md:inline text-[10px] text-zinc-600 tracking-wider">
                        <span className="inline-flex items-center gap-1"><CornerDownLeft className="h-3 w-3" aria-hidden /> Cmd+Enter</span>
                      </span>
                      <button
                        onClick={handleBuild}
                        disabled={busy || !goal.trim()}
                        className="inline-flex items-center gap-2 bg-zinc-100 hover:bg-white disabled:bg-zinc-800 disabled:text-zinc-600 text-black text-sm font-medium px-4 py-1.5 rounded-md transition-all shadow-[0_0_20px_rgba(255,255,255,0.06)]"
                      >
                        {busy ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Building</>
                        ) : (
                          <>Build <ArrowUp className="h-3.5 w-3.5" /></>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="h-8 border-t border-zinc-800 bg-[#08080b] flex items-center justify-between px-4 shrink-0" style={mono}>
            <div className="flex items-center gap-4 text-[9px] uppercase tracking-wider text-zinc-600">
              <span className="flex items-center gap-1.5">
                <span className={`w-1 h-1 rounded-full ${busy ? "bg-[#9d5cff]" : "bg-emerald-500"}`} />
                Engine · {busy ? "Streaming" : "Idle"}
              </span>
              <span className="hidden sm:inline">Mode · {activeMode.label}</span>
              {designStyle !== "auto" && <span className="hidden sm:inline">Mood · {DESIGN_STYLES.find((s) => s.id === designStyle)?.label}</span>}
            </div>
            <div className="flex items-center gap-4 text-[9px] uppercase tracking-wider text-zinc-600">
              <span>Messages · {messages.length}</span>
              <span className="text-zinc-500">v1.0 · Stable</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

function ProjectList({ projects, onOpen, onDelete }: { projects: LcProject[]; onOpen: (p: LcProject) => void; onDelete: (p: LcProject) => void }) {
  if (projects.length === 0) return (
    <div className="rounded-lg border border-zinc-800 bg-[#0c0c10] p-10 text-center">
      <div className="text-[10px] uppercase tracking-widest text-zinc-600 font-mono">Awaiting artifact</div>
      <div className="text-lg text-zinc-400 mt-2" style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}>Nothing built yet.</div>
      <p className="text-sm text-zinc-600 mt-1">Type what you want above and hit Build.</p>
    </div>
  );
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {projects.map((p) => (
        <div key={p.id} className="group rounded-lg border border-zinc-800 bg-[#0c0c10] p-4 hover:border-zinc-700 hover:bg-[#101015] transition cursor-pointer"
          onClick={() => onOpen(p)}>
          <div className="flex items-start justify-between mb-2">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">{p.output_type}</div>
            <button onClick={(e) => { e.stopPropagation(); onDelete(p); }} className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
          <div className="font-medium text-zinc-200 mb-1 line-clamp-2" style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}>{p.title}</div>
          <div className="text-[11px] text-zinc-600 font-mono">{new Date(p.created_at).toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}

function BuildProgress({ blocks }: { blocks: LcBlock[] }) {
  if (blocks.length === 0) return null;
  const total = blocks.length;
  const done = blocks.filter((b) => b.status === "ready").length;
  const err = blocks.filter((b) => b.status === "error").length;
  const inFlight = blocks.filter((b) => b.status === "generating").length;
  const pct = Math.round((done / total) * 100);
  return (
    <div className="px-1">
      <div className="flex items-center justify-between text-[10px] text-zinc-600 mb-1 font-mono uppercase tracking-wider">
        <span>{done}/{total} complete{err > 0 ? ` · ${err} failed` : ""}</span>
        <span>{inFlight > 0 ? `${inFlight} in flight` : pct === 100 ? "ready" : ""}</span>
      </div>
      <div className="h-1 rounded-full bg-zinc-900 overflow-hidden">
        <div
          className="h-full bg-[#9d5cff] shadow-[0_0_10px_rgba(157,92,255,0.5)] transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function TraceRow({ idx, block, onRegen, reduce }: { idx: number; block: LcBlock; onRegen: () => void; reduce: boolean }) {
  const StatusIcon = block.status === "ready" ? CheckCircle2
    : block.status === "error" ? XCircle
    : block.status === "generating" ? Loader2
    : Clock;
  const iconClass = block.status === "ready" ? "text-emerald-400"
    : block.status === "error" ? "text-red-400"
    : block.status === "generating" ? "text-[#c39aff]"
    : "text-zinc-600";

  return (
    <motion.div layout={!reduce}
      className="group flex items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-900/60 transition">
      <StatusIcon className={`h-3.5 w-3.5 shrink-0 ${iconClass} ${block.status === "generating" && !reduce ? "animate-spin" : ""}`} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-zinc-300 truncate">{idx + 1}. {block.title}</div>
        <div className="text-[10px] text-zinc-600 truncate font-mono uppercase tracking-wider">
          {block.model_used ?? "queued"} · {block.status}
        </div>
      </div>
      {(block.status === "ready" || block.status === "error") && (
        <button onClick={onRegen} className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-zinc-200 transition" title="Regenerate this block">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      )}
    </motion.div>
  );
}

function LogPanel({ entries }: { entries: LogEntry[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollTo({ top: 9e9 }); }, [entries]);
  return (
    <div className="rounded-lg border border-zinc-800 bg-black/60 p-3 font-mono text-[11px]">
      <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5 px-1">Progress log</div>
      <div ref={ref} className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
        {entries.map((e) => (
          <div key={e.id} className={
            e.tone === "ok" ? "text-emerald-400" :
            e.tone === "warn" ? "text-amber-300" :
            e.tone === "err" ? "text-red-400" : "text-zinc-500"
          }>
            <span className="opacity-50">{new Date(e.ts).toLocaleTimeString()}</span>  {e.text}
          </div>
        ))}
        {entries.length === 0 && <div className="text-zinc-700 px-1">idle</div>}
      </div>
    </div>
  );
}

function BlockPreview({ block, streaming, onRegen }: { block: LcBlock; streaming?: string; onRegen: () => void }) {
  const content = block.content_json;
  const isStreaming = block.status === "generating";

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="group relative rounded-lg border border-zinc-800 bg-[#0a0a0d] hover:border-zinc-700/80 p-4 transition">
      <div className="flex items-center justify-between mb-3 gap-2 pb-2 border-b border-zinc-800/60">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">{block.block_type}</div>
          <div className="text-sm text-zinc-200 truncate" style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}>{block.title}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {block.model_used && (
            <span title={`Generated by ${block.model_used}`} className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-500 font-mono">
              {block.model_used.split("/")[1]?.split(":")[0] ?? block.model_used}
            </span>
          )}
          <button onClick={onRegen} className="opacity-0 group-hover:opacity-100 text-[11px] text-zinc-500 hover:text-zinc-100 flex items-center gap-1 transition">
            <RefreshCw className="h-3 w-3" /> Regenerate
          </button>
        </div>
      </div>

      {block.status === "error" && (
        <div className="text-xs text-red-300 bg-red-500/5 border border-red-500/20 rounded-md p-3 mb-2">
          Failed to build this block. {block.error_text ? <span className="opacity-70">— {block.error_text}</span> : null}
          <button onClick={onRegen} className="underline ml-1">Retry</button>
        </div>
      )}

      {isStreaming && streaming ? (
        <pre className="whitespace-pre-wrap text-sm text-zinc-400 font-sans leading-relaxed">{streaming}<span className="inline-block w-1.5 h-4 bg-[#9d5cff] ml-0.5 animate-pulse align-middle" /></pre>
      ) : (
        <RenderedBlock type={block.block_type} content={content} />
      )}
    </motion.div>
  );
}

function RenderedBlock({ type, content }: { type: string; content: any }) {
  if (!content) return <div className="text-xs text-zinc-600">Empty.</div>;

  if (type === "doc_section") {
    return (
      <article
        className="lc-doc max-w-[68ch] mx-auto"
        style={{ fontFamily: "'Inter', ui-sans-serif, system-ui" }}
      >
        <style>{`
          .lc-doc h2 { font-family: 'Fraunces', ui-serif, Georgia, serif; font-weight: 500; font-size: 30px; line-height: 1.15; letter-spacing: -0.02em; color: #f5f5f4; margin: 0 0 0.5rem; }
          .lc-doc h3 { font-family: 'Fraunces', ui-serif, Georgia, serif; font-weight: 500; font-size: 22px; line-height: 1.25; color: #e5e5e4; margin: 2rem 0 0.5rem; }
          .lc-doc p { font-size: 16px; line-height: 1.75; color: #b8b8b3; margin: 0 0 1.1rem; }
          .lc-doc p > em:first-child:last-child, .lc-doc p:first-of-type > em { color: #a1a1aa; font-style: italic; font-size: 17px; }
          .lc-doc strong { color: #f5f5f4; font-weight: 600; }
          .lc-doc em { color: #d4d4d0; }
          .lc-doc blockquote { border-left: 2px solid #9d5cff; margin: 1.5rem 0; padding: 0.25rem 0 0.25rem 1.25rem; font-family: 'Fraunces', ui-serif, serif; font-style: italic; font-size: 20px; line-height: 1.5; color: #e5e5e4; }
          .lc-doc ul { list-style: none; padding: 0; margin: 1rem 0 1.4rem; }
          .lc-doc ul li { position: relative; padding-left: 1.25rem; margin: 0.4rem 0; font-size: 16px; line-height: 1.65; color: #b8b8b3; }
          .lc-doc ul li::before { content: ""; position: absolute; left: 0; top: 0.7rem; width: 0.5rem; height: 1px; background: #9d5cff; }
          .lc-doc a { color: #c39aff; text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1px; }
          .lc-doc code { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 13px; background: rgba(255,255,255,0.05); padding: 1px 5px; border-radius: 3px; color: #e5e5e4; }
        `}</style>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content.markdown ?? ""}</ReactMarkdown>
      </article>
    );
  }

  if (type === "slide") return <SlideCanvas c={content} />;

  if (type === "sheet_tab") {
    const cols: string[] = content.columns ?? [];
    const rows: any[][] = content.rows ?? [];
    const formulas: Record<string, string> = content.formulas ?? {};
    const totals = !!content.totals_row;
    return (
      <div className="rounded-xl border border-zinc-800 bg-[#0a0a0d] overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-800/80 bg-[#0d0d10]">
          <div style={{ fontFamily: "'Fraunces', serif" }} className="text-lg font-medium text-zinc-100 tracking-tight">{content.tab_name}</div>
          {content.description && <div className="text-[12px] text-zinc-500 mt-0.5 italic">{content.description}</div>}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[13px]" style={{ fontFamily: "'Inter', ui-sans-serif" }}>
            <thead>
              <tr className="bg-zinc-900/40">
                {cols.map((c, i) => (
                  <th key={i} className="text-left px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest text-zinc-500 border-b border-zinc-800">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => {
                const isLast = totals && ri === rows.length - 1;
                return (
                  <tr key={ri} className={`${isLast ? "bg-[#100c18] border-t border-[#9d5cff]/30 font-medium text-zinc-100" : "border-t border-zinc-900 text-zinc-300"} hover:bg-zinc-900/30 transition-colors`}>
                    {r.map((cell, ci) => {
                      const ref = String.fromCharCode(65 + ci) + (ri + 2);
                      const isFormula = formulas[ref];
                      const isNum = typeof cell === "number";
                      return (
                        <td
                          key={ci}
                          className={`px-4 py-2 ${isNum ? "text-right tabular-nums" : ""} ${isFormula ? "text-[#c39aff]" : ""}`}
                          title={isFormula ? `${ref}: ${isFormula}` : undefined}
                        >
                          {isNum ? formatNum(cell) : String(cell)}
                          {isFormula && <sup className="ml-1 text-[#9d5cff] font-mono text-[9px]">fx</sup>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (type === "site_section") {
    const fontLink = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">`;
    const baseCss = `*,*::before,*::after{box-sizing:border-box}body{margin:0;background:#0a0a0d;color:#f5f5f4;font-family:'Inter',ui-sans-serif,system-ui;-webkit-font-smoothing:antialiased;font-feature-settings:"ss01","cv11"}h1,h2,h3,h4{font-family:'Fraunces',ui-serif,Georgia,serif;font-weight:500;letter-spacing:-0.02em;margin:0;color:#f5f5f4}p{color:#a1a1aa;line-height:1.65;margin:0}a{color:inherit}img{max-width:100%;display:block}`;
    const src = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${fontLink}<script src="https://cdn.tailwindcss.com"></script><style>${baseCss}${content.css ?? ""}</style></head><body>${content.html ?? ""}${content.js ? `<script>${content.js}</script>` : ""}</body></html>`;
    return (
      <div className="rounded-xl border border-zinc-800 overflow-hidden bg-[#0a0a0d]">
        <iframe srcDoc={src} sandbox="allow-scripts" className="w-full h-[520px] bg-[#0a0a0d]" title="preview" />
      </div>
    );
  }
  return <pre className="text-xs text-zinc-600 overflow-x-auto">{JSON.stringify(content, null, 2)}</pre>;
}

function formatNum(n: number): string {
  if (!isFinite(n)) return String(n);
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (Number.isInteger(n)) return String(n);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function SlideCanvas({ c }: { c: any }) {
  const layout = c?.layout ?? (
    c?.kpis?.length ? "kpi_grid" :
    c?.comparison ? "comparison" :
    c?.timeline?.length ? "timeline" :
    c?.agenda?.length ? "agenda" :
    c?.closing ? "closing" :
    c?.stat ? "stat" :
    c?.quote ? "quote" :
    c?.columns ? "two_column" :
    c?.bullets?.length ? "bullets" :
    "statement"
  );
  const heading = { fontFamily: "'Fraunces', ui-serif, Georgia, serif", letterSpacing: "-0.03em" } as const;
  const body = { fontFamily: "'Inter', ui-sans-serif" } as const;
  const mono = { fontFamily: "'JetBrains Mono', ui-monospace, monospace" } as const;
  const isCover = layout === "cover" || layout === "section_divider";

  return (
    <div className="relative aspect-video rounded-xl overflow-hidden border border-zinc-800 bg-[#0d0d10]"
         style={{
           background: isCover
             ? "radial-gradient(ellipse at 30% 20%, #1e1533 0%, #0a0a0d 65%), linear-gradient(180deg, #0d0a14 0%, #08080b 100%)"
             : "radial-gradient(ellipse at 20% 0%, #14111c 0%, #0a0a0d 55%)"
         }}>
      <div className="absolute inset-3 rounded-lg border border-white/[0.04] pointer-events-none" />

      <div className="absolute top-5 left-6 flex items-center gap-2" style={mono}>
        <span className="w-1.5 h-1.5 rounded-full bg-[#9d5cff]" />
        <span className="text-[9px] uppercase tracking-[0.22em] text-zinc-500">Lumina</span>
      </div>
      <div className="absolute top-5 right-6 text-[9px] uppercase tracking-[0.22em] text-zinc-600" style={mono}>
        {layout.replace("_", " ")}
      </div>

      <div className="absolute inset-0 flex flex-col justify-center px-10 md:px-16 py-16">
        {c.eyebrow && layout !== "section_divider" && (
          <div style={mono} className="text-[11px] uppercase tracking-[0.22em] text-[#9d5cff] mb-5">{c.eyebrow}</div>
        )}

        {layout === "cover" ? (
          <div className="max-w-[26ch]">
            <h1 style={heading} className="text-[64px] md:text-[92px] font-medium leading-[0.98] text-zinc-50">{c.title}</h1>
            {c.subtitle && <p style={body} className="mt-8 text-[19px] text-zinc-400 max-w-[48ch] leading-relaxed">{c.subtitle}</p>}
            <div className="mt-12 h-px w-24 bg-[#9d5cff]" />
          </div>
        ) : layout === "section_divider" ? (
          <div>
            {c.eyebrow && <div style={mono} className="text-[64px] md:text-[80px] font-normal leading-none text-[#9d5cff]/70 mb-4">{c.eyebrow}</div>}
            <h2 style={heading} className="text-[56px] md:text-[80px] font-medium leading-[1.02] text-zinc-50 max-w-[18ch]">{c.title}</h2>
            {c.subtitle && <p style={body} className="mt-6 text-[18px] text-zinc-500 max-w-[52ch]">{c.subtitle}</p>}
          </div>
        ) : layout === "agenda" && c.agenda?.length ? (
          <>
            <h2 style={heading} className="text-[40px] md:text-[54px] font-medium leading-[1.05] text-zinc-50 mb-10 max-w-[22ch]">{c.title ?? "Agenda"}</h2>
            <ol className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4">
              {c.agenda.map((a: any, i: number) => (
                <li key={i} className="flex gap-4 items-baseline border-t border-zinc-800/70 pt-3">
                  <span style={mono} className="text-[11px] text-[#9d5cff] tabular-nums pt-0.5">{a.n ?? String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <div style={heading} className="text-[20px] text-zinc-100 leading-tight">{a.title}</div>
                    {a.note && <div style={body} className="text-[13px] text-zinc-500 mt-0.5">{a.note}</div>}
                  </div>
                </li>
              ))}
            </ol>
          </>
        ) : layout === "kpi_grid" && c.kpis?.length ? (
          <>
            {c.title && <h2 style={heading} className="text-[34px] md:text-[44px] font-medium leading-[1.05] text-zinc-50 mb-8 max-w-[24ch]">{c.title}</h2>}
            <div className={`grid gap-4 ${c.kpis.length >= 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-3"}`}>
              {c.kpis.map((k: any, i: number) => (
                <div key={i} className="border-t border-zinc-800 pt-4">
                  <div style={heading} className="text-[44px] md:text-[56px] font-medium leading-none text-zinc-50">{k.value}</div>
                  <div style={body} className="mt-3 text-[13px] text-zinc-400 leading-snug">{k.label}</div>
                  {k.delta && <div style={mono} className="mt-1.5 text-[10px] uppercase tracking-widest text-[#9d5cff]">{k.delta}</div>}
                </div>
              ))}
            </div>
          </>
        ) : layout === "comparison" && c.comparison ? (
          <>
            <h2 style={heading} className="text-[36px] md:text-[48px] font-medium leading-[1.05] text-zinc-50 mb-8 max-w-[24ch]">{c.title}</h2>
            <div className="grid grid-cols-2 gap-6">
              {(["left", "right"] as const).map((side, i) => {
                const col = c.comparison[side];
                if (!col) return null;
                const accent = i === 1;
                return (
                  <div key={side} className={`rounded-lg border p-5 ${accent ? "border-[#9d5cff]/30 bg-[#12101a]" : "border-zinc-800 bg-black/30"}`}>
                    <div style={mono} className={`text-[10px] uppercase tracking-[0.22em] mb-3 ${accent ? "text-[#9d5cff]" : "text-zinc-500"}`}>
                      {accent ? "After" : "Before"} · {col.heading}
                    </div>
                    <ul className="space-y-2">
                      {(col.points ?? []).map((p: string, j: number) => (
                        <li key={j} style={body} className="flex gap-2 text-[14px] text-zinc-300 leading-snug">
                          <span className={`mt-1.5 w-3 h-px shrink-0 ${accent ? "bg-[#9d5cff]" : "bg-zinc-600"}`} />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </>
        ) : layout === "timeline" && c.timeline?.length ? (
          <>
            <h2 style={heading} className="text-[36px] md:text-[48px] font-medium leading-[1.05] text-zinc-50 mb-10 max-w-[24ch]">{c.title}</h2>
            <div className="relative">
              <div className="absolute left-0 right-0 top-2 h-px bg-zinc-800" />
              <div className="grid" style={{ gridTemplateColumns: `repeat(${c.timeline.length}, minmax(0,1fr))` }}>
                {c.timeline.map((t: any, i: number) => (
                  <div key={i} className="relative pt-6 pr-4">
                    <span className="absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full bg-[#9d5cff]" />
                    <div style={mono} className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">{t.when}</div>
                    <div style={body} className="text-[14px] text-zinc-200 leading-snug">{t.what}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : layout === "closing" && c.closing ? (
          <div className="max-w-[28ch]">
            <div style={mono} className="text-[11px] uppercase tracking-[0.22em] text-[#9d5cff] mb-6">Closing</div>
            <h2 style={heading} className="text-[52px] md:text-[68px] font-medium leading-[1.02] text-zinc-50">{c.closing.message}</h2>
            {c.closing.cta && (
              <div className="mt-10 inline-flex items-center gap-3 border border-zinc-700 rounded-full px-5 py-2" style={body}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#9d5cff]" />
                <span className="text-[14px] text-zinc-200">{c.closing.cta}</span>
              </div>
            )}
          </div>
        ) : layout === "stat" && c.stat ? (
          <div className="flex flex-col">
            <div style={heading} className="text-[104px] md:text-[152px] font-medium leading-none text-zinc-50 tracking-[-0.04em]">{c.stat.value}</div>
            <div style={body} className="mt-5 text-[19px] text-zinc-400 max-w-[46ch] leading-relaxed">{c.stat.label}</div>
            {c.stat.source && <div style={mono} className="mt-4 text-[10px] uppercase tracking-widest text-zinc-600">Source · {c.stat.source}</div>}
            {c.title && <div style={heading} className="mt-8 text-2xl text-zinc-300 max-w-[24ch]">{c.title}</div>}
          </div>
        ) : layout === "quote" && c.quote ? (
          <div className="max-w-[48ch]">
            <div style={heading} className="text-[36px] md:text-[48px] italic font-normal leading-[1.15] text-zinc-100">
              <span className="text-[#9d5cff] mr-1">“</span>{c.quote.text}<span className="text-[#9d5cff] ml-0.5">”</span>
            </div>
            <div style={mono} className="mt-8 text-[11px] uppercase tracking-[0.2em] text-zinc-500">— {c.quote.attribution}</div>
          </div>
        ) : layout === "two_column" && c.columns?.length ? (
          <>
            <h2 style={heading} className="text-[40px] md:text-[54px] font-medium leading-[1.05] text-zinc-50 mb-8 max-w-[22ch]">{c.title}</h2>
            <div className="grid grid-cols-2 gap-10">
              {c.columns.map((col: any, i: number) => (
                <div key={i} className="border-l border-zinc-800 pl-5">
                  <div style={heading} className="text-[19px] font-medium text-zinc-100 mb-2">{col.heading}</div>
                  <div style={body} className="text-[14px] text-zinc-400 leading-relaxed">{col.body}</div>
                </div>
              ))}
            </div>
          </>
        ) : layout === "bullets" && c.bullets?.length ? (
          <>
            <h2 style={heading} className="text-[40px] md:text-[54px] font-medium leading-[1.05] text-zinc-50 mb-2 max-w-[24ch]">{c.title}</h2>
            {c.subtitle && <p style={body} className="text-[16px] text-zinc-400 mb-8 max-w-[52ch]">{c.subtitle}</p>}
            <ul className="space-y-3 mt-4">
              {c.bullets.map((b: string, i: number) => (
                <li key={i} className="flex gap-4 items-baseline">
                  <span style={mono} className="text-[10px] text-[#9d5cff] tabular-nums pt-1">{String(i + 1).padStart(2, "0")}</span>
                  <span style={body} className="text-[17px] text-zinc-200 leading-snug">{b}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <h2 style={heading} className="text-[56px] md:text-[76px] font-medium leading-[1.02] text-zinc-50 max-w-[20ch]">{c.title}</h2>
            {c.subtitle && <p style={body} className="mt-6 text-[19px] text-zinc-400 max-w-[54ch] leading-relaxed">{c.subtitle}</p>}
          </>
        )}
      </div>

      {c.footnote && (
        <div className="absolute bottom-4 left-10 right-10 text-[10px] uppercase tracking-widest text-zinc-600" style={mono}>
          {c.footnote}
        </div>
      )}
      {!c.footnote && c.speaker_notes && (
        <div className="absolute bottom-4 left-10 right-10 text-[11px] text-zinc-600 italic border-t border-zinc-800/60 pt-2" style={body}>
          <span style={mono} className="uppercase tracking-widest not-italic mr-2 text-zinc-700">Notes</span>{c.speaker_notes}
        </div>
      )}
    </div>
  );
}

function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
function escapeHtml(s: string) { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)); }

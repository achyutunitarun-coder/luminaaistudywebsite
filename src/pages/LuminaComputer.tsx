// Lumina Computer — streaming, block-based, multi-mode generation.
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Loader2, RefreshCw, Trash2, Download, FileText, LayoutGrid,
  Table as TableIcon, Globe, Bot, CheckCircle2, XCircle, Clock, ArrowUp,
  CornerDownLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  planBlocks, streamRoute, createProject, listProjects, getProject,
  insertBlocks, listBlocks, updateBlock, updateProject, deleteProject,
  type LcBlock, type LcProject, type OutputType,
} from "@/features/luminaComputer/api";
import { WebsitePreview } from "@/features/luminaComputer/WebsitePreview";

const MODES: Array<{ key: OutputType; label: string; icon: any; role: string; sub: string }> = [
  { key: "doc",     label: "Docs",     icon: FileText,   role: "content", sub: "Long-form structured writing" },
  { key: "slides",  label: "Slides",   icon: LayoutGrid, role: "content", sub: "Deck, one slide per block" },
  { key: "sheet",   label: "Sheets",   icon: TableIcon,  role: "content", sub: "Tabs with live formulas" },
  { key: "website", label: "Websites", icon: Globe,      role: "code",    sub: "Single-page site sections" },
  { key: "agent",   label: "Agent",    icon: Bot,        role: "content", sub: "Mixed artifact — planner decides" },
];

interface LogEntry { id: string; ts: number; text: string; tone: "info" | "ok" | "warn" | "err" }

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
    try {
      pushLog(`Creating project…`, "info");
      const project = await createProject(g.slice(0, 80), mode);
      setActive(project);
      setBlocks([]);
      refreshList();

      pushLog(`Planning ${mode} blocks with orchestrator…`, "info");
      const plan = await planBlocks(g, mode);
      pushLog(`Plan ready — ${plan.blocks.length} blocks (via ${plan.model_used ?? "orchestrator"})`, "ok");

      const inserted = await insertBlocks(project.id, plan.blocks);
      setBlocks(inserted);

      await updateProject(project.id, { status: "generating" });

      // Concurrency-limited generation: max 3 blocks in flight.
      // Agent mode benefits most (mixed block types run in parallel),
      // but every mode gets faster builds.
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
          await generateBlock(project, block, g);
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
    } catch (e: any) {
      pushLog(`Failed: ${e.message ?? e}`, "err");
      toast.error("Build failed");
    } finally {
      setBusy(false);
    }
  }

  function systemFor(mode: OutputType, blockType: string): string {
    if (mode === "doc" || blockType === "doc_section")
      return "You write one section of a document. Output MARKDOWN only, starting with a ## heading. 150–350 words. Clear, active voice, no filler. No preamble.";
    if (mode === "slides" || blockType === "slide")
      return "You write one slide. Output ONLY valid JSON: {\"title\":\"punchy title\",\"bullets\":[\"3–5 tight bullets, max 12 words each\"],\"speaker_notes\":\"1–2 sentence talking point\"}. No prose outside JSON.";
    if (mode === "sheet" || blockType === "sheet_tab")
      return "You design one spreadsheet tab. Output ONLY valid JSON: {\"tab_name\":\"...\",\"columns\":[\"col1\",\"col2\"],\"rows\":[[...],[...]],\"formulas\":{\"C2\":\"=B2*1.1\"}}. 3–8 columns, 4–12 rows. Use realistic sample data. No prose outside JSON.";
    if (mode === "website" || blockType === "site_section")
      return "You write one <section> of a single-page website. Output ONLY valid JSON: {\"section_name\":\"...\",\"html\":\"<section>...</section>\",\"css\":\".class{...}\",\"js\":null}. Use semantic HTML5, Tailwind-compatible utility classes are fine. Self-contained. No prose outside JSON.";
    return "Write focused, useful content for the given block. Markdown output.";
  }

  async function generateBlock(project: LcProject, block: LcBlock, overallGoal: string, extraInstruction?: string) {
    const t0 = Date.now();
    await updateBlock(block.id, { status: "generating" });
    setBlocks((bs) => bs.map((b) => b.id === block.id ? { ...b, status: "generating" } : b));
    streamingRef.current[block.id] = "";

    const role = block.block_type === "site_section" ? "code" : "content";
    const system = systemFor(project.output_type, block.block_type);
    const refineLine = extraInstruction?.trim()
      ? `\nUser refinement for this block: ${extraInstruction.trim()}\nApply this refinement while keeping the same block type and JSON shape.`
      : "";
    const prompt = `Overall goal: ${overallGoal}\nBlock title: ${block.title}\nIntent: ${block.prompt_seed ?? ""}${refineLine}\nProduce the block now.`;

    try {
      const { text, model } = await streamRoute({
        role, system, prompt,
        project_id: project.id, block_id: block.id,
        max_tokens: role === "code" ? 3500 : 2000,
        temperature: 0.7,
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

      // Parse per mode
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
    // JSON modes
    try { return JSON.parse(clean); } catch { /* */ }
    const m = clean.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch { /* */ } }
    return null;
  }

  async function regenerate(block: LcBlock, refinement?: string) {
    if (!active) return;
    pushLog(`Regenerating: ${block.title}${refinement ? ` — "${refinement.slice(0, 60)}"` : ""}`, "info");
    await generateBlock(active, block, active.title, refinement);
  }


  async function removeProject(p: LcProject) {
    if (!confirm(`Delete "${p.title}"?`)) return;
    await deleteProject(p.id);
    if (active?.id === p.id) { setActive(null); setBlocks([]); }
    refreshList();
    toast.success("Deleted");
  }

  async function exportProject() {
    if (!active) return;
    const mode = active.output_type;
    try {
      if (mode === "slides") {
        const { exportSlidesToPptx } = await import("@/features/luminaComputer/exportSlides");
        await exportSlidesToPptx(active.title, blocks);
        toast.success("Exported .pptx");
        return;
      }
      if (mode === "sheet") {
        const { exportSheetsToXlsx } = await import("@/features/luminaComputer/exportSheets");
        await exportSheetsToXlsx(active.title, blocks);
        toast.success("Exported .xlsx");
        return;
      }
      if (mode === "doc" || mode === "agent") {
        const md = blocks.map((b) => {
          if (b.block_type === "doc_section") return b.content_json?.markdown ?? "";
          if (b.block_type === "slide") return `## ${b.content_json?.title ?? b.title}\n\n${(b.content_json?.bullets ?? []).map((x: string) => `- ${x}`).join("\n")}`;
          if (b.block_type === "site_section") return `\n\`\`\`html\n${b.content_json?.html ?? ""}\n\`\`\`\n`;
          if (b.block_type === "sheet_tab") return `### ${b.content_json?.tab_name ?? b.title}\n\n${((b.content_json?.rows) ?? []).map((r: any[]) => `| ${r.join(" | ")} |`).join("\n")}`;
          return "";
        }).join("\n\n---\n\n");
        downloadFile(`${active.title}.md`, md, "text/markdown");
      } else if (mode === "website") {
        const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(active.title)}</title><script src="https://cdn.tailwindcss.com"></script><style>${blocks.map((b) => b.content_json?.css ?? "").join("\n")}</style></head><body>${blocks.map((b) => b.content_json?.html ?? "").join("\n")}<script>${blocks.map((b) => b.content_json?.js ?? "").filter(Boolean).join("\n")}</script></body></html>`;
        downloadFile(`${active.title}.html`, html, "text/html");
      } else {
        downloadFile(`${active.title}.json`, JSON.stringify(blocks.map((b) => b.content_json), null, 2), "application/json");
      }
      toast.success("Exported");
    } catch (e: any) {
      toast.error(`Export failed: ${e.message ?? e}`);
    }
  }

  // Load Space Grotesk once — locked heading typography for this workstation.
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
        <div className="rounded-xl border border-zinc-800/80 bg-[#0d0d10] shadow-2xl shadow-black/60 overflow-hidden">
          {/* Workstation header bar */}
          <header className="h-14 border-b border-zinc-800/80 flex items-center justify-between px-4 md:px-6 bg-[#111114]">
            <div className="flex items-center gap-4 min-w-0">
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="w-2.5 h-2.5 rounded-full bg-[#9d5cff] shadow-[0_0_10px_rgba(157,92,255,0.6)]" aria-hidden />
                <span style={heading} className="text-[13px] font-semibold tracking-[0.18em] text-zinc-300 uppercase">Lumina Computer</span>
              </div>
              <div className="h-4 w-px bg-zinc-800" />
              <span style={mono} className="text-[10px] text-zinc-600 tracking-wider uppercase hidden sm:inline">Workstation · v4</span>
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

          {/* Main workbench area */}
          <main
            className="relative"
            style={{ background: "radial-gradient(ellipse at 50% 0%, #14141a 0%, #0a0a0d 60%)" }}
          >
            {/* Band 1: prompt console */}
            <section className="px-4 md:px-8 pt-8 md:pt-10 pb-6">
              <div className="max-w-3xl mx-auto">
                <div className="flex items-center gap-2 mb-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-zinc-800 bg-zinc-900/50" style={mono}>
                    <span className={`w-1.5 h-1.5 rounded-full ${busy ? "bg-[#9d5cff] animate-pulse" : "bg-emerald-500/80"}`} aria-hidden />
                    <span className="text-[9px] uppercase tracking-widest text-zinc-500">
                      {busy ? "Building" : "System Ready"}
                    </span>
                  </span>
                  <span style={mono} className="text-[9px] uppercase tracking-widest text-zinc-600">
                    Mode · {activeMode.label} — {activeMode.sub}
                  </span>
                </div>

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
                        <span style={mono} className="text-[10px] uppercase tracking-widest text-zinc-600 truncate">
                          {goal.trim().length} chars · block-streamed
                        </span>
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
            </section>

            {/* Band 2: workspace body */}
            <section className="px-4 md:px-8 pb-8 border-t border-zinc-800/60 bg-[#09090c]/60">
              <div className="pt-6">
                {!active ? (
                  <ProjectList projects={projects} onOpen={openProject} onDelete={removeProject} />
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
                    {/* Left: build-trace rail + log */}
                    <div className="flex flex-col gap-3 min-h-0">
                      <div className="rounded-lg border border-zinc-800 bg-[#0c0c10] p-3">
                        <div className="flex items-center justify-between mb-2 px-1">
                          <div style={mono} className="text-[10px] uppercase tracking-widest text-zinc-500">Build trace</div>
                          <button onClick={() => { setActive(null); setBlocks([]); }} className="text-[10px] text-zinc-500 hover:text-zinc-200 transition">← Projects</button>
                        </div>
                        <BuildProgress blocks={blocks} />
                        <div className="space-y-0.5 max-h-[42vh] overflow-y-auto pr-1 mt-2">
                          {blocks.map((b, i) => <TraceRow key={b.id} idx={i} block={b} onRegen={() => regenerate(b)} reduce={!!reduce} />)}
                          {blocks.length === 0 && <div style={mono} className="text-[10px] uppercase tracking-wider text-zinc-600 px-2 py-4">Waiting for planner…</div>}
                        </div>
                      </div>
                      <LogPanel entries={log} />
                      <div className="flex gap-2">
                        <Button onClick={exportProject} variant="outline" size="sm" className="flex-1 bg-transparent border-zinc-800 text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100">
                          <Download className="h-3.5 w-3.5 mr-1.5" /> Export
                        </Button>
                        <Button onClick={() => removeProject(active)} variant="outline" size="sm" className="bg-transparent border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-red-300">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Right: preview */}
                    <div className="rounded-lg border border-zinc-800 bg-[#0c0c10] p-4 md:p-6 min-h-[60vh]">
                      <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800/70">
                        <div className="min-w-0">
                          <div style={heading} className="text-lg font-semibold text-zinc-100 truncate">{active.title}</div>
                          <div style={mono} className="text-[10px] uppercase tracking-widest text-zinc-500 mt-0.5">{active.output_type}</div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        {active.output_type === "website" ? (
                          <WebsitePreview
                            blocks={blocks}
                            streamingText={streamingRef.current}
                            onRegen={(b, r) => regenerate(b, r)}
                          />
                        ) : (
                          <>
                            {blocks.map((b) => (
                              <BlockPreview key={b.id} block={b} streaming={streamingRef.current[b.id]} onRegen={() => regenerate(b)} />
                            ))}
                            {blocks.length === 0 && (
                              <div className="text-center py-16">
                                <div style={mono} className="text-[10px] uppercase tracking-widest text-zinc-600">Awaiting artifact</div>
                                <div style={heading} className="text-lg text-zinc-400 mt-2">Nothing built yet.</div>
                                <p className="text-sm text-zinc-600 mt-1">Type what you want above and hit Build.</p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </main>

          {/* Status footer */}
          <footer className="h-8 border-t border-zinc-800 bg-[#08080b] flex items-center justify-between px-4" style={mono}>
            <div className="flex items-center gap-4 text-[9px] uppercase tracking-wider text-zinc-600">
              <span className="flex items-center gap-1.5">
                <span className={`w-1 h-1 rounded-full ${busy ? "bg-[#9d5cff]" : "bg-emerald-500"}`} />
                Engine · {busy ? "Streaming" : "Idle"}
              </span>
              <span className="hidden sm:inline">Mode · {activeMode.label}</span>
            </div>
            <div className="flex items-center gap-4 text-[9px] uppercase tracking-wider text-zinc-600">
              <span>Blocks · {blocks.length}</span>
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
  if (!content) return <div className="text-xs text-muted-foreground">Empty.</div>;

  if (type === "doc_section") {
    return (
      <div className="prose prose-invert prose-sm max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content.markdown ?? ""}</ReactMarkdown>
      </div>
    );
  }
  if (type === "slide") {
    return (
      <div className="aspect-video rounded-lg bg-gradient-to-br from-slate-900 to-slate-950 border border-white/10 p-6 flex flex-col">
        <div className="text-xl font-semibold text-white mb-3">{content.title}</div>
        <ul className="space-y-1.5 flex-1">
          {(content.bullets ?? []).map((b: string, i: number) => (
            <li key={i} className="text-sm text-slate-200 flex gap-2"><span className="text-teal-400">▸</span>{b}</li>
          ))}
        </ul>
        {content.speaker_notes && <div className="text-[11px] text-muted-foreground italic border-t border-white/10 pt-2 mt-2">Notes: {content.speaker_notes}</div>}
      </div>
    );
  }
  if (type === "sheet_tab") {
    const cols = content.columns ?? [];
    const rows = content.rows ?? [];
    const formulas = content.formulas ?? {};
    return (
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <div className="text-xs text-muted-foreground px-3 py-1.5 bg-white/5 border-b border-white/10 font-medium">{content.tab_name}</div>
        <table className="min-w-full text-xs">
          <thead className="bg-white/5"><tr>{cols.map((c: string, i: number) => <th key={i} className="text-left px-3 py-1.5 font-medium text-muted-foreground">{c}</th>)}</tr></thead>
          <tbody>
            {rows.map((r: any[], ri: number) => (
              <tr key={ri} className="border-t border-white/5">
                {r.map((cell, ci) => {
                  const ref = String.fromCharCode(65 + ci) + (ri + 2);
                  const isFormula = formulas[ref];
                  return <td key={ci} className="px-3 py-1.5">{cell}{isFormula && <sup className="ml-1 text-teal-400 font-mono text-[9px]">fx</sup>}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (type === "site_section") {
    const src = `<!doctype html><html><head><script src="https://cdn.tailwindcss.com"></script><style>${content.css ?? ""}</style></head><body>${content.html ?? ""}</body></html>`;
    return <iframe srcDoc={src} sandbox="allow-scripts" className="w-full h-80 rounded-lg bg-white" title="preview" />;
  }
  return <pre className="text-xs text-muted-foreground overflow-x-auto">{JSON.stringify(content, null, 2)}</pre>;
}

function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
function escapeHtml(s: string) { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)); }

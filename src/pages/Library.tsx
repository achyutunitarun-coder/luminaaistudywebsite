import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Monitor, MessageSquare, FileText, LayoutGrid, Table as TableIcon,
  Globe, Bot, Sparkles, Trash2, Download, Eye, ExternalLink,
  ArrowUpRight, Clock, Loader2, Cpu, Library,
} from "lucide-react";
import { toast } from "sonner";
import { listProjects, deleteProject, type LcProject, type LcBlock, listBlocks } from "@/features/luminaComputer/api";
import { useArtifactStore, type ArtifactRecord } from "@/features/artifacts/artifactStore";

type Tab = "all" | "computer" | "artifacts";

export default function LibraryPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<LcProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [selectedProject, setSelectedProject] = useState<LcProject | null>(null);
  const [projectBlocks, setProjectBlocks] = useState<LcBlock[]>([]);
  const [blocksLoading, setBlocksLoading] = useState(false);

  const artifacts = useArtifactStore((s) => s.artifacts);
  const order = useArtifactStore((s) => s.order);

  const artifactList = useMemo(() => order.map((id) => artifacts[id]).filter(Boolean), [order, artifacts]);

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function openProject(p: LcProject) {
    setSelectedProject(p);
    setBlocksLoading(true);
    try {
      const bs = await listBlocks(p.id);
      setProjectBlocks(bs);
    } catch {
      setProjectBlocks([]);
    } finally {
      setBlocksLoading(false);
    }
  }

  async function handleDelete(p: LcProject) {
    await deleteProject(p.id);
    setProjects((prev) => prev.filter((x) => x.id !== p.id));
    if (selectedProject?.id === p.id) {
      setSelectedProject(null);
      setProjectBlocks([]);
    }
    toast.success("Deleted");
  }

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 },
    },
  };

  const itemAnim = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] } },
  };

  return (
    <div className="min-h-screen w-full text-zinc-300 relative overflow-hidden" style={{background:'radial-gradient(ellipse at 50% 0%, #0f0d18 0%, #08080c 50%, #06060a 100%)'}}>
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{backgroundImage:'radial-gradient(circle at 1px 1px, #9d5cff 1px, transparent 0)', backgroundSize:'40px 40px'}} />

      <div className="mx-auto max-w-[1400px] px-4 py-6 md:py-10 relative z-10">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-800/60 bg-zinc-900/50 mb-4 font-mono">
            <Library className="w-3 h-3 text-[#c39aff]" />
            <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-400">Library</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-100 mb-2" style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}>
            Your creations
          </h1>
          <p className="text-sm text-zinc-500 max-w-xl leading-relaxed">
            Every document, website, slide deck, and AI artifact you&apos;ve ever built with Lumina.
          </p>
        </motion.div>

        {/* Tabs */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="flex items-center gap-1.5 mb-8 p-1 rounded-xl bg-black/40 border border-zinc-800/60 w-fit">
          {[
            { id: "all" as Tab, label: "All", icon: Sparkles },
            { id: "computer" as Tab, label: "Lumina Computer", icon: Cpu },
            { id: "artifacts" as Tab, label: "Chat Artifacts", icon: MessageSquare },
          ].map((t) => {
            const on = tab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] rounded-lg font-medium transition-all duration-200 ${
                  on
                    ? "bg-gradient-to-b from-zinc-800 to-zinc-900 text-zinc-100 border border-zinc-700/60 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300 border border-transparent hover:bg-zinc-900/40"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${on ? 'text-[#c39aff]' : ''}`} />
                {t.label}
              </button>
            );
          })}
        </motion.div>

        {/* Content */}
        {(tab === "all" || tab === "computer") && (
          <div>
            {loading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
              </div>
            ) : projects.length === 0 && (tab === "all" ? artifactList.length === 0 : true) ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/50 mb-5">
                  <span className="w-2 h-2 rounded-full bg-zinc-600" />
                  <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-mono">Empty library</span>
                </div>
                <div className="text-2xl text-zinc-400 mb-2" style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}>Nothing here yet</div>
                <p className="text-sm text-zinc-600 max-w-sm mx-auto mb-6">Generate something in Lumina Computer or AI Chat, and it will appear here.</p>
                <button onClick={() => navigate("/lumina-computer")}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-zinc-100 to-zinc-50 text-black text-sm font-medium hover:from-white hover:to-white transition-all duration-200 shadow-[0_0_20px_rgba(255,255,255,0.06)] hover:shadow-[0_0_25px_rgba(157,92,255,0.15)] active:scale-[0.97]">
                  <Cpu className="h-4 w-4" />
                  Open Lumina Computer
                </button>
              </motion.div>
            ) : (
              <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {projects.map((p) => {
                  const modeIcon = p.output_type === "doc" ? FileText : p.output_type === "slides" ? LayoutGrid : p.output_type === "sheet" ? TableIcon : p.output_type === "website" ? Globe : Bot;
                  return (
                    <motion.div key={p.id} variants={itemAnim} layout
                      className="group relative rounded-xl border border-zinc-800/80 bg-gradient-to-b from-[#0c0c10]/90 to-[#0a0a0d]/80 p-4 hover:border-zinc-700/80 hover:shadow-[0_0_20px_rgba(157,92,255,0.04)] transition-all duration-200 cursor-pointer overflow-hidden"
                      onClick={() => openProject(p)}
                    >
                      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-700/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="flex items-start justify-between mb-2">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-900/80 border border-zinc-800/60">
                          <modeIcon className="w-3 h-3 text-[#9d5cff]" />
                          <span className="text-[9px] uppercase tracking-widest text-zinc-400 font-mono">{p.output_type === "doc" ? "Document" : p.output_type === "slides" ? "Slides" : p.output_type === "sheet" ? "Sheet" : p.output_type === "website" ? "Website" : "Agent"}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(p); }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200">
                            <Trash2 className="h-3 w-3" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); navigate(`/lumina-computer?project=${p.id}`); }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-all duration-200">
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      <div className="font-medium text-zinc-200 mb-1.5 line-clamp-2 leading-snug" style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}>{p.title}</div>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-600 font-mono">
                        <span>{new Date(p.created_at).toLocaleDateString()}</span>
                        <span className="w-1 h-1 rounded-full bg-zinc-700" />
                        <span>{new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowUpRight className="h-3.5 w-3.5 text-zinc-600" />
                      </div>
                    </motion.div>
                  );
                })}
                {tab === "all" && artifactList.map((a) => (
                  <motion.div key={a.id} variants={itemAnim} layout
                    className="group relative rounded-xl border border-zinc-800/80 bg-gradient-to-b from-[#0c0c10]/90 to-[#0a0a0d]/80 p-4 hover:border-emerald-700/60 hover:shadow-[0_0_20px_rgba(16,185,129,0.04)] transition-all duration-200 cursor-pointer overflow-hidden"
                    onClick={() => navigate("/chat")}
                  >
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-700/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-start justify-between mb-2">
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-900/80 border border-zinc-800/60">
                        <MessageSquare className="w-3 h-3 text-emerald-400" />
                        <span className="text-[9px] uppercase tracking-widest text-zinc-400 font-mono">Artifact</span>
                      </div>
                    </div>
                    <div className="font-medium text-zinc-200 mb-1.5 line-clamp-2 leading-snug" style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}>{a.title}</div>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-600 font-mono">
                      <span>{new Date(a.createdAt).toLocaleDateString()}</span>
                      <span className="w-1 h-1 rounded-full bg-zinc-700" />
                      <span>{new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="w-1 h-1 rounded-full bg-zinc-700" />
                      <span className="text-emerald-600">{a.type}</span>
                    </div>
                    <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowUpRight className="h-3.5 w-3.5 text-zinc-600" />
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        )}

        {tab === "artifacts" && (
          <div>
            {artifactList.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/50 mb-5">
                  <span className="w-2 h-2 rounded-full bg-zinc-600" />
                  <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-mono">No artifacts</span>
                </div>
                <div className="text-2xl text-zinc-400 mb-2" style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}>No chat artifacts yet</div>
                <p className="text-sm text-zinc-600 max-w-sm mx-auto mb-6">Ask AI Chat to create notes, slides, or code artifacts — they will appear here.</p>
                <button onClick={() => navigate("/chat")}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-zinc-100 to-zinc-50 text-black text-sm font-medium hover:from-white hover:to-white transition-all duration-200 shadow-[0_0_20px_rgba(255,255,255,0.06)] hover:shadow-[0_0_25px_rgba(157,92,255,0.15)] active:scale-[0.97]">
                  <MessageSquare className="h-4 w-4" />
                  Open AI Chat
                </button>
              </motion.div>
            ) : (
              <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {artifactList.map((a) => (
                  <motion.div key={a.id} variants={itemAnim} layout
                    className="group relative rounded-xl border border-zinc-800/80 bg-gradient-to-b from-[#0c0c10]/90 to-[#0a0a0d]/80 p-4 hover:border-emerald-700/60 hover:shadow-[0_0_20px_rgba(16,185,129,0.04)] transition-all duration-200 cursor-pointer overflow-hidden"
                    onClick={() => navigate("/chat")}
                  >
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-700/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-start justify-between mb-2">
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-900/80 border border-zinc-800/60">
                        <MessageSquare className="w-3 h-3 text-emerald-400" />
                        <span className="text-[9px] uppercase tracking-widest text-zinc-400 font-mono">{a.type}</span>
                      </div>
                    </div>
                    <div className="font-medium text-zinc-200 mb-1.5 line-clamp-2 leading-snug" style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}>{a.title}</div>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-600 font-mono">
                      <span>{new Date(a.createdAt).toLocaleDateString()}</span>
                      <span className="w-1 h-1 rounded-full bg-zinc-700" />
                      <span>{new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowUpRight className="h-3.5 w-3.5 text-zinc-600" />
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Project detail panel */}
      <AnimatePresence>
        {selectedProject && (
          <motion.div
            initial={{ opacity: 0, x: 320 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 320 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-[#0a0a0d]/98 backdrop-blur-xl border-l border-zinc-800/80 z-50 flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between p-4 border-b border-zinc-800/60">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono mb-1">{selectedProject.output_type}</div>
                <h2 className="text-lg font-medium text-zinc-100 truncate" style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}>{selectedProject.title}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => navigate(`/lumina-computer?project=${selectedProject.id}`)}
                  className="text-[11px] px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition flex items-center gap-1.5">
                  <Eye className="h-3 w-3" /> Open
                </button>
                <button onClick={() => { setSelectedProject(null); setProjectBlocks([]); }}
                  className="text-[11px] px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition">
                  Close
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {blocksLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
                </div>
              ) : projectBlocks.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-sm text-zinc-600">No blocks found</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {projectBlocks.map((b, i) => (
                    <motion.div
                      key={b.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-3 hover:bg-zinc-900/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] font-mono text-zinc-600">{String(i + 1).padStart(2, "0")}</span>
                        <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">{b.block_type}</div>
                        {b.model_used && (
                          <span className="text-[9px] text-zinc-600 font-mono ml-auto">{b.model_used.split("/")[1]?.split(":")[0] ?? b.model_used}</span>
                        )}
                      </div>
                      <div className="text-sm text-zinc-300 font-medium truncate" style={{ fontFamily: "'Space Grotesk', ui-sans-serif" }}>{b.title}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                          b.status === "ready" ? "bg-emerald-500" :
                          b.status === "error" ? "bg-red-500" :
                          b.status === "generating" ? "bg-[#c39aff] animate-pulse" : "bg-zinc-600"
                        }`} />
                        <span className="text-[10px] text-zinc-600 font-mono">{b.status}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-zinc-800/60">
              <div className="flex items-center gap-2 text-[10px] text-zinc-600 font-mono">
                <Clock className="h-3 w-3" />
                <span>{new Date(selectedProject.created_at).toLocaleString()}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedProject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setSelectedProject(null); setProjectBlocks([]); }}
            className="fixed inset-0 bg-black/40 z-40"
          />
        )}
      </AnimatePresence>
    </div>
  );
}

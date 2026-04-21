import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Maximize2, Download, X, Presentation, Sparkles } from "lucide-react";

export interface SlideArtifactPayload {
  id?: string;
  title: string;
  html: string;
  model_used?: string;
  line_count?: number;
  generation_time_ms?: number;
  topic?: string;
}

function downloadHTML(html: string, filename: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const SlideArtifactCard = ({
  artifact,
  onRegenerate,
}: {
  artifact: SlideArtifactPayload;
  onRegenerate?: () => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const filename = `${(artifact.topic || artifact.title).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-slides.html`;
  const slideCount = 13;

  return (
    <>
      <div className="rounded-2xl overflow-hidden border border-primary/20 bg-gradient-to-br from-primary/5 via-background/50 to-accent/5 shadow-lg">
        {/* Header badge */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/15 bg-background/40">
          <Presentation className="w-4 h-4 text-primary" />
          <span className="text-[12px] font-semibold">🎞️ AI Slides</span>
          <span className="text-[10px] text-muted-foreground">·</span>
          <span className="text-[10px] text-muted-foreground">{slideCount} slides</span>
          <span className="text-[10px] text-muted-foreground">·</span>
          <span className="text-[11px] font-medium truncate flex-1 text-foreground/80">
            {artifact.topic || artifact.title}
          </span>
        </div>

        {/* 16:9 inline preview — fully interactive */}
        <div className="relative bg-black" style={{ aspectRatio: "16 / 9" }}>
          <iframe
            srcDoc={artifact.html}
            sandbox="allow-scripts allow-same-origin"
            title={artifact.title}
            className="absolute inset-0 w-full h-full border-0"
          />
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-t border-border/15 bg-background/40">
          <button
            onClick={() => setExpanded(true)}
            className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition font-medium"
          >
            <Maximize2 className="w-3 h-3" /> Fullscreen
          </button>
          <button
            onClick={() => downloadHTML(artifact.html, filename)}
            className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg bg-muted/40 hover:bg-muted/60 transition font-medium"
          >
            <Download className="w-3 h-3" /> Download HTML
          </button>
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg bg-muted/40 hover:bg-muted/60 transition font-medium ml-auto"
            >
              <Sparkles className="w-3 h-3" /> Regenerate
            </button>
          )}
          <span className="text-[9px] text-muted-foreground/60 ml-auto">
            {artifact.model_used && `via ${artifact.model_used.split("/").pop()?.replace(":free", "")}`}
          </span>
        </div>
      </div>

      {/* Fullscreen */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black flex flex-col"
          >
            <div className="flex items-center px-4 h-12 border-b border-white/10 bg-black/80 backdrop-blur">
              <Presentation className="w-4 h-4 text-primary mr-2" />
              <span className="text-sm font-medium truncate flex-1 text-white">{artifact.title}</span>
              <button
                onClick={() => downloadHTML(artifact.html, filename)}
                className="px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 text-xs flex items-center gap-1.5 mr-2"
              >
                <Download className="w-3.5 h-3.5" /> Download
              </button>
              <button
                onClick={() => setExpanded(false)}
                className="p-2 rounded-lg hover:bg-white/10 text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <iframe
              srcDoc={artifact.html}
              sandbox="allow-scripts allow-same-origin"
              title={artifact.title}
              className="w-full flex-1 border-0 bg-black"
              allow="fullscreen"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

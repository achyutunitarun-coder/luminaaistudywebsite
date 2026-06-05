import { useEffect, useRef, useState } from "react";
import { X, Code as CodeIcon, Eye, FileDown, Copy as CopyIcon, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Version {
  code: string;
  html: string;
  ts: number;
}

export interface CanvasPanelProps {
  open: boolean;
  versions: Version[];
  onClose: () => void;
  defaultName?: string;
}

export function CanvasPanel({ open, versions, onClose, defaultName = "Untitled Canvas" }: CanvasPanelProps) {
  const navigate = useNavigate();
  const [name, setName] = useState(defaultName);
  const [activeIdx, setActiveIdx] = useState(versions.length - 1);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setActiveIdx(versions.length - 1);
  }, [versions.length]);

  if (!open || versions.length === 0) return null;
  const v = versions[Math.min(activeIdx, versions.length - 1)];

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(v.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const exportToDocs = () => {
    try {
      localStorage.setItem("lumina_canvas_export", v.html);
      localStorage.setItem("lumina_canvas_export_title", name);
      navigate("/documents");
    } catch (e) {
      toast.error("Could not hand off to Documents.");
    }
  };

  return (
    <div
      className="flex flex-col h-full bg-[#0a0a0f] border-l border-white/[0.07]"
      style={{ animation: "slide-in-right 300ms cubic-bezier(0.4,0,0.2,1) 40ms both" }}
    >
      <div className="flex items-center gap-3 h-12 px-4 border-b border-[rgba(20,184,166,0.12)] flex-shrink-0">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Untitled Canvas"
          className="flex-1 bg-transparent text-[13px] font-medium text-white/90 outline-none focus:border-b focus:border-[rgba(20,184,166,0.4)]"
          style={{ fontFamily: "'Instrument Sans', system-ui, sans-serif" }}
        />
        <span
          className="inline-flex items-center gap-1.5 px-2 h-5 rounded-full text-[10px] font-medium"
          style={{
            background: "rgba(20,184,166,0.1)",
            border: "1px solid rgba(20,184,166,0.25)",
            color: "#14b8a6",
          }}
        >
          <span className="w-[5px] h-[5px] rounded-full bg-[#14b8a6] animate-pulse" />
          Live
        </span>
        <button
          onClick={() => setShowCode((s) => !s)}
          className="px-2 h-7 rounded-md text-[11px] text-white/70 hover:bg-white/[0.06] flex items-center gap-1"
        >
          {showCode ? <Eye className="w-3 h-3" /> : <CodeIcon className="w-3 h-3" />}
          {showCode ? "Preview" : "View Code"}
        </button>
        <button
          onClick={exportToDocs}
          className="px-3 h-7 rounded-md text-[11px] font-semibold flex items-center gap-1.5"
          style={{ background: "#14b8a6", color: "#050508" }}
        >
          <FileDown className="w-3 h-3" /> Export → Docs
        </button>
        <button onClick={onClose} className="p-1.5 rounded-md text-white/60 hover:bg-white/[0.06]">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 relative bg-white overflow-hidden">
        {!showCode ? (
          <iframe
            ref={iframeRef}
            key={`${activeIdx}-${v.ts}`}
            title="Lumina Canvas"
            srcDoc={v.html}
            sandbox="allow-scripts allow-forms allow-pointer-lock allow-modals allow-popups"
            className="w-full h-full border-0"
          />
        ) : (
          <div className="absolute inset-0 bg-[#0d0d14] overflow-auto">
            <div className="sticky top-0 flex justify-end p-2 bg-[#0d0d14] border-b border-white/[0.05]">
              <button
                onClick={copyCode}
                className="px-2 h-7 rounded-md text-[11px] text-white/70 hover:bg-white/[0.06] flex items-center gap-1"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <CopyIcon className="w-3 h-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <pre
              className="p-4 text-[12.5px] leading-[1.65] text-white/85 whitespace-pre-wrap break-words"
              style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
            >
              {v.code}
            </pre>
          </div>
        )}
      </div>

      {versions.length > 1 && (
        <div className="flex items-center gap-3 h-7 px-3 border-t border-white/[0.07] flex-shrink-0 bg-[#0a0a0f]">
          <input
            type="range"
            min={0}
            max={versions.length - 1}
            value={activeIdx}
            onChange={(e) => setActiveIdx(Number(e.target.value))}
            className="flex-1 accent-[#14b8a6]"
          />
          <span className="text-[10px] text-white/26 tabular-nums">
            v{activeIdx + 1} of {versions.length}
          </span>
        </div>
      )}
    </div>
  );
}

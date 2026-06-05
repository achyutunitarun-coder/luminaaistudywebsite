import { useNavigate } from "react-router-dom";
import { ExternalLink, FileDown, FileCode2, FileText, Database, Braces } from "lucide-react";
import { toast } from "sonner";
import { useComputerFiles, type ComputerFile } from "./filesStore";

function iconFor(type: ComputerFile["type"]) {
  if (type === "html") return <FileCode2 className="w-3.5 h-3.5 text-emerald-400" />;
  if (type === "data") return <Database className="w-3.5 h-3.5 text-sky-400" />;
  if (type === "md") return <FileText className="w-3.5 h-3.5 text-violet-400" />;
  if (type === "js") return <Braces className="w-3.5 h-3.5 text-amber-400" />;
  return <FileText className="w-3.5 h-3.5 text-white/40" />;
}

export function FilesPanel() {
  const navigate = useNavigate();
  const files = useComputerFiles((s) => s.files);

  const openInCanvas = (f: ComputerFile) => {
    try {
      localStorage.setItem("lumina_canvas_import", f.content);
      localStorage.setItem("lumina_canvas_export_title", f.name);
      navigate("/chat");
      toast.success(`Opening ${f.name} in Canvas`);
    } catch {}
  };
  const sendToDocs = (f: ComputerFile) => {
    try {
      const html =
        f.type === "html"
          ? f.content
          : `<pre><code>${f.content.replace(/[<&>]/g, (c) => ({ "<": "&lt;", "&": "&amp;", ">": "&gt;" }[c]!))}</code></pre>`;
      localStorage.setItem("lumina_doc_import", html);
      localStorage.setItem("lumina_canvas_export_title", f.name);
      navigate("/documents");
    } catch {}
  };

  if (files.length === 0) {
    return (
      <div className="text-[11px] text-white/30 italic px-3 py-4">No files yet — start a task.</div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      {files.map((f) => (
        <div
          key={f.name}
          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/[0.04] group"
        >
          {iconFor(f.type)}
          <span className="text-[12px] text-white/85 truncate flex-1">{f.name}</span>
          <span className="text-[10px] text-white/30 tabular-nums">{f.sizeKB.toFixed(1)}KB</span>
          {f.type === "html" && (
            <button
              onClick={() => openInCanvas(f)}
              title="Open in Canvas"
              className="opacity-0 group-hover:opacity-100 p-1 rounded text-white/60 hover:text-emerald-400"
            >
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={() => sendToDocs(f)}
            title="→ Docs"
            className="opacity-0 group-hover:opacity-100 p-1 rounded text-white/60 hover:text-violet-400"
          >
            <FileDown className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

import { useMemo, useState } from "react";
import { ChevronRight, ChevronDown, FileCode, FileText, Folder, FolderOpen } from "lucide-react";
import type { LuminaFile } from "@/features/computer/parser";

type Node = {
  name: string;
  path: string;
  file?: LuminaFile;
  children: Map<string, Node>;
};

function buildTree(files: LuminaFile[]): Node {
  const root: Node = { name: "", path: "", children: new Map() };
  for (const f of files) {
    const parts = f.path.split("/").filter(Boolean);
    let cur = root;
    parts.forEach((seg, i) => {
      const isLast = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join("/");
      if (!cur.children.has(seg)) {
        cur.children.set(seg, { name: seg, path, children: new Map() });
      }
      cur = cur.children.get(seg)!;
      if (isLast) cur.file = f;
    });
  }
  return root;
}

function FileIcon({ file }: { file: LuminaFile }) {
  if (file.lang === "md") return <FileText className="w-3.5 h-3.5 flex-shrink-0 text-white/50" />;
  return <FileCode className="w-3.5 h-3.5 flex-shrink-0 text-white/50" />;
}

function NodeRow({
  node,
  depth,
  activePath,
  onPick,
  openMap,
  setOpenMap,
}: {
  node: Node;
  depth: number;
  activePath: string;
  onPick: (p: string) => void;
  openMap: Record<string, boolean>;
  setOpenMap: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  const entries = Array.from(node.children.values()).sort((a, b) => {
    const af = !!a.file, bf = !!b.file;
    if (af !== bf) return af ? 1 : -1; // folders first
    return a.name.localeCompare(b.name);
  });
  return (
    <>
      {entries.map((child) => {
        if (child.file) {
          const active = child.file.path === activePath;
          return (
            <button
              key={child.path}
              onClick={() => onPick(child.file!.path)}
              style={{ paddingLeft: 12 + depth * 14 }}
              className={`w-full flex items-center gap-2 py-1.5 pr-3 rounded-lg text-left transition ${
                active ? "bg-white/[0.08] text-white" : "text-white/65 hover:bg-white/[0.04]"
              }`}
            >
              <FileIcon file={child.file} />
              <span className="text-[13px] truncate flex-1">{child.name}</span>
              {!child.file.done ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  generating
                </span>
              ) : null}
            </button>
          );
        }
        const open = openMap[child.path] ?? true;
        return (
          <div key={child.path}>
            <button
              onClick={() => setOpenMap((m) => ({ ...m, [child.path]: !open }))}
              style={{ paddingLeft: 12 + depth * 14 }}
              className="w-full flex items-center gap-1.5 py-1.5 pr-3 rounded-lg text-left text-white/70 hover:bg-white/[0.04]"
            >
              {open ? (
                <ChevronDown className="w-3 h-3 text-white/40" />
              ) : (
                <ChevronRight className="w-3 h-3 text-white/40" />
              )}
              {open ? (
                <FolderOpen className="w-3.5 h-3.5 text-amber-300/70" />
              ) : (
                <Folder className="w-3.5 h-3.5 text-amber-300/70" />
              )}
              <span className="text-[13px] truncate">{child.name}</span>
            </button>
            {open && (
              <NodeRow
                node={child}
                depth={depth + 1}
                activePath={activePath}
                onPick={onPick}
                openMap={openMap}
                setOpenMap={setOpenMap}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

export function FileTree({
  files,
  activePath,
  onPick,
}: {
  files: LuminaFile[];
  activePath: string;
  onPick: (p: string) => void;
}) {
  const root = useMemo(() => buildTree(files), [files]);
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  return (
    <div className="space-y-0.5">
      <NodeRow
        node={root}
        depth={0}
        activePath={activePath}
        onPick={onPick}
        openMap={openMap}
        setOpenMap={setOpenMap}
      />
    </div>
  );
}

export async function downloadFilesAsZip(files: LuminaFile[], zipName = "lumina-project.zip") {
  if (!files.length) return;
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const f of files) zip.file(f.path, f.content);
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

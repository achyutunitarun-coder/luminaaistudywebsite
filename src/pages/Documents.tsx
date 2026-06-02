import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bold, Italic, Underline as UIcon, Heading1, Heading2, Heading3,
  List, ListOrdered, Code2, Table as TableIcon, LayoutTemplate, Sparkles,
  X, FileText, ChevronDown, Send,
} from "lucide-react";
import { toast } from "sonner";
import { exportMarkdown, exportHTML, exportPDF } from "@/features/documents/exports";
import { streamOpenRouter, pickModel } from "@/lib/openrouterRouting";
import { useAuth } from "@/hooks/useAuth";

const DOC_KEY = "lumina_doc_content";
const TITLE_KEY = "lumina_doc_title";

export default function Documents() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const editorRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState("Untitled Document");
  const [savedFlash, setSavedFlash] = useState(false);
  const [counts, setCounts] = useState({ w: 0, c: 0, l: 0 });
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsgs, setAiMsgs] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [ribbonOpen, setRibbonOpen] = useState(false);

  // Auth gate
  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  // Boot — hydrate from canvas export, doc import, or saved content
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    try {
      const canvasExport = localStorage.getItem("lumina_canvas_export");
      const docImport = localStorage.getItem("lumina_doc_import");
      const canvasTitle = localStorage.getItem("lumina_canvas_export_title");
      if (canvasExport) {
        editor.innerHTML = canvasExport;
        localStorage.removeItem("lumina_canvas_export");
        if (canvasTitle) { setTitle(canvasTitle); localStorage.removeItem("lumina_canvas_export_title"); }
      } else if (docImport) {
        editor.innerHTML = docImport;
        localStorage.removeItem("lumina_doc_import");
      } else {
        const saved = localStorage.getItem(DOC_KEY);
        if (saved) editor.innerHTML = saved;
        const savedTitle = localStorage.getItem(TITLE_KEY);
        if (savedTitle) setTitle(savedTitle);
      }
      updateCounts();
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateCounts = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const t = el.innerText || "";
    setCounts({
      w: t.trim() ? t.trim().split(/\s+/).filter(Boolean).length : 0,
      c: t.length,
      l: t.split("\n").length,
    });
  }, []);

  // Autosave (debounced 300ms) + counts (debounced 80ms)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEditorInput = () => {
    if (countTimer.current) clearTimeout(countTimer.current);
    countTimer.current = setTimeout(updateCounts, 80);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(DOC_KEY, editorRef.current?.innerHTML ?? "");
        localStorage.setItem(TITLE_KEY, title);
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1500);
      } catch {}
    }, 300);
  };

  // Format commands
  const exec = (cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    onEditorInput();
  };
  const insertHTML = (html: string) => {
    editorRef.current?.focus();
    document.execCommand("insertHTML", false, html);
    onEditorInput();
  };

  const insertTable = () =>
    insertHTML(
      `<table style="border-collapse:collapse;width:100%;margin:12px 0"><tbody>${
        Array.from({ length: 3 })
          .map(
            () =>
              `<tr>${Array.from({ length: 3 })
                .map(
                  () =>
                    `<td style="border:1px solid rgba(255,255,255,0.10);padding:8px 12px">&nbsp;</td>`,
                )
                .join("")}</tr>`,
          )
          .join("")
      }</tbody></table><p></p>`,
    );
  const insertSlide = () =>
    insertHTML(
      `<div style="background:#0f0f17;border:1px solid rgba(20,184,166,0.20);border-radius:10px;min-height:220px;padding:24px;margin:16px 0"><h2 style="font-family:'Instrument Serif',serif;font-size:24px;margin:0 0 12px 0">Slide title</h2><p>Slide content…</p></div><p></p>`,
    );
  const insertCode = () => insertHTML(`<pre><code>// code…</code></pre><p></p>`);

  // Ref to the currently-streaming inline node inside the editor
  const streamNodeRef = useRef<HTMLSpanElement | null>(null);

  // AI Assistant — streams tokens directly into the editor at the caret
  const runAI = useCallback(async (prompt: string) => {
    if (!prompt.trim() || aiBusy) return;
    setAiBusy(true);
    setAiMsgs((m) => [...m, { role: "user", content: prompt }, { role: "assistant", content: "" }]);

    const editor = editorRef.current;
    if (!editor) { setAiBusy(false); return; }

    // Capture selection inside the editor (if any)
    const sel = window.getSelection();
    let range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
    const inEditor = range && editor.contains(range.commonAncestorContainer);
    const selectedText = inEditor ? sel?.toString() ?? "" : "";

    // Focus editor; if cursor isn't inside, place it at the end
    editor.focus();
    if (!inEditor) {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    } else if (selectedText && range) {
      // Replace selection
      range.deleteContents();
    }

    // Insert a dedicated streaming span at the caret
    const streamSpan = document.createElement("span");
    streamSpan.setAttribute("data-lumina-stream", "true");
    streamSpan.className = "lumina-stream";
    range = sel?.getRangeAt(0) ?? null;
    if (range) {
      range.insertNode(streamSpan);
      // Move caret inside the span
      const r2 = document.createRange();
      r2.selectNodeContents(streamSpan);
      r2.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(r2);
    }
    streamNodeRef.current = streamSpan;

    const model = pickModel({ type: "creative", complexity: "medium" });
    let assistantAcc = "";
    try {
      await streamOpenRouter({
        model,
        systemPrompt:
          "You are Lumina — a brilliant older-sibling writing assistant inside a document editor. Write the requested content in clean, beautiful prose. Return only the text to insert. No preamble, no 'here is…', no headers unless asked. Match the user's tone. Use real paragraph breaks (\\n\\n) where natural.",
        messages: [
          ...(selectedText
            ? [{ role: "user", content: `Rewrite or transform this passage:\n\n${selectedText}\n\nRequest: ${prompt}` }]
            : [{ role: "user", content: prompt }]),
        ],
        maxTokens: 2000,
        onToken: (tok) => {
          assistantAcc += tok;
          setAiMsgs((m) => {
            const next = [...m];
            next[next.length - 1] = { role: "assistant", content: assistantAcc };
            return next;
          });
          const node = streamNodeRef.current;
          if (node) {
            // Append text, converting paragraph breaks into real <br><br>
            const parts = tok.split(/\n\n+/);
            parts.forEach((part, idx) => {
              if (idx > 0) {
                node.appendChild(document.createElement("br"));
                node.appendChild(document.createElement("br"));
              }
              if (part) node.appendChild(document.createTextNode(part.replace(/\n/g, " ")));
            });
            // Keep editor scrolled to caret
            node.scrollIntoView({ block: "nearest", behavior: "smooth" });
          }
        },
      });
      // Unwrap the streaming span so the content becomes regular editor content
      const node = streamNodeRef.current;
      if (node && node.parentNode) {
        const parent = node.parentNode;
        while (node.firstChild) parent.insertBefore(node.firstChild, node);
        parent.removeChild(node);
      }
      onEditorInput();
    } catch (e: any) {
      toast.error(e?.message ?? "AI failed");
    } finally {
      streamNodeRef.current = null;
      setAiBusy(false);
    }
  }, [aiBusy, onEditorInput]);

  const handleAISend = () => {
    const p = aiInput.trim();
    if (!p) return;
    setAiInput("");
    runAI(p);
  };

  if (loading || !user) {
    return <div className="min-h-screen bg-[#0a0a0f]" />;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0a0a0f] text-white/[0.92]" style={{ fontFamily: "var(--font-body)" }}>
      {/* HEADER */}
      <header className="flex items-center gap-3 h-14 px-5 border-b border-[rgba(20,184,166,0.10)] flex-shrink-0 print:hidden">
        <FileText className="w-4 h-4 text-[#14b8a6]" />
        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value); onEditorInput(); }}
          placeholder="Untitled Document"
          className="bg-transparent outline-none text-[15px] font-semibold focus:border-b focus:border-[rgba(20,184,166,0.4)] min-w-0 flex-1 max-w-[400px]"
        />
        <span
          className={`text-[10px] text-[rgba(20,184,166,0.7)] transition-opacity duration-500 ${savedFlash ? "opacity-100" : "opacity-0"}`}
        >
          ✓ Saved
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setPreview((p) => !p)}
            className="px-3 h-8 rounded-md text-[12px] text-white/70 hover:bg-white/[0.06]"
          >
            {preview ? "Edit" : "Preview"}
          </button>
          <div className="relative">
            <button
              onClick={() => setExportOpen((o) => !o)}
              className="px-4 h-8 rounded-md text-[12px] font-semibold flex items-center gap-1"
              style={{ background: "#7c3aed", color: "#fff" }}
            >
              Export <ChevronDown className="w-3 h-3" />
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-full mt-1 bg-[#141420] border border-white/[0.07] rounded-lg shadow-xl min-w-[140px] z-10">
                {[
                  ["PDF", () => exportPDF()],
                  ["HTML", () => exportHTML(editorRef.current?.innerHTML ?? "", title)],
                  ["Markdown", () => exportMarkdown(editorRef.current?.innerHTML ?? "", title)],
                ].map(([label, fn]) => (
                  <button
                    key={label as string}
                    onClick={() => { (fn as () => void)(); setExportOpen(false); }}
                    className="block w-full text-left px-3 py-2 text-[12px] text-white/80 hover:bg-white/[0.06]"
                  >
                    {label as string}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => navigate("/chat")} className="p-1.5 rounded-md text-white/60 hover:bg-white/[0.06]">
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* RIBBON */}
      <div className="flex items-center gap-1 h-11 px-3 border-b border-white/[0.05] flex-shrink-0 overflow-x-auto print:hidden">
        <div className="hidden md:flex items-center gap-1">
          <RibbonBtn onClick={() => exec("bold")} icon={<Bold className="w-3.5 h-3.5" />} />
          <RibbonBtn onClick={() => exec("italic")} icon={<Italic className="w-3.5 h-3.5" />} />
          <RibbonBtn onClick={() => exec("underline")} icon={<UIcon className="w-3.5 h-3.5" />} />
          <Sep />
          <RibbonBtn onClick={() => exec("formatBlock", "<h1>")} icon={<Heading1 className="w-3.5 h-3.5" />} />
          <RibbonBtn onClick={() => exec("formatBlock", "<h2>")} icon={<Heading2 className="w-3.5 h-3.5" />} />
          <RibbonBtn onClick={() => exec("formatBlock", "<h3>")} icon={<Heading3 className="w-3.5 h-3.5" />} />
          <Sep />
          <RibbonBtn onClick={() => exec("insertUnorderedList")} icon={<List className="w-3.5 h-3.5" />} />
          <RibbonBtn onClick={() => exec("insertOrderedList")} icon={<ListOrdered className="w-3.5 h-3.5" />} />
          <Sep />
          <RibbonBtn onClick={insertCode} icon={<Code2 className="w-3.5 h-3.5" />} />
          <RibbonBtn onClick={insertTable} icon={<TableIcon className="w-3.5 h-3.5" />} />
          <RibbonBtn onClick={insertSlide} icon={<LayoutTemplate className="w-3.5 h-3.5" />} />
        </div>
        {/* Mobile dropdown */}
        <div className="md:hidden">
          <button onClick={() => setRibbonOpen((o) => !o)} className="px-3 h-8 rounded-md text-[12px] text-white/70 hover:bg-white/[0.06] flex items-center gap-1">
            Format <ChevronDown className="w-3 h-3" />
          </button>
        </div>
        <div className="ml-auto">
          <button
            onClick={() => {
              const sel = window.getSelection()?.toString() || "";
              if (!sel) toast.message("Type a request in the AI panel →");
              else runAI("Improve this passage's clarity, flow and tone. Keep the meaning. Return only the rewritten text.");
            }}
            className="h-8 px-3 rounded-md text-[12px] font-semibold flex items-center gap-1.5"
            style={{
              background: "rgba(20,184,166,0.12)",
              border: "1px solid rgba(20,184,166,0.30)",
              color: "#14b8a6",
            }}
          >
            <Sparkles className="w-3.5 h-3.5" /> AI
          </button>
        </div>
      </div>

      {/* BODY */}
      <div className="flex-1 flex min-h-0 print:block">
        <main className="flex-1 overflow-y-auto print:overflow-visible">
          {preview ? (
            <article
              className="lumina-editor max-w-[760px] mx-auto px-8 py-16 text-[17px] leading-[1.8] text-white/[0.9]"
              style={{ caretColor: "#14b8a6", fontFamily: "var(--font-body)" }}
              dangerouslySetInnerHTML={{ __html: editorRef.current?.innerHTML ?? "" }}
            />
          ) : (
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={onEditorInput}
              data-placeholder="Start writing, or press ✦ AI to generate…"
              className="lumina-editor max-w-[760px] mx-auto px-8 py-16 text-[17px] leading-[1.8] text-white/[0.9] outline-none min-h-full"
              style={{ caretColor: "#14b8a6", fontFamily: "var(--font-body)" }}
            />
          )}
        </main>

        {/* AI side panel */}
        <aside className="w-[260px] flex-shrink-0 border-l border-white/[0.07] bg-[#0a0a0f] flex flex-col print:hidden">
          <div className="px-4 h-9 flex items-center text-[11px] font-semibold text-[#14b8a6] border-b border-white/[0.05] tracking-wide">
            ✦ AI ASSISTANT
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {aiMsgs.length === 0 && (
              <div className="text-[11px] text-white/30 leading-relaxed">
                Highlight text + press ✦ to rewrite, or type a request to generate at the cursor.
              </div>
            )}
            {aiMsgs.map((m, i) => (
              <div
                key={i}
                className={`text-[11px] leading-relaxed rounded-lg px-2.5 py-2 ${
                  m.role === "user"
                    ? "bg-[rgba(20,184,166,0.08)] text-white/85"
                    : "bg-white/[0.04] text-white/70"
                }`}
              >
                {m.content || (aiBusy && i === aiMsgs.length - 1 ? "•••" : "")}
              </div>
            ))}
          </div>
          <div className="p-2 border-t border-white/[0.05] flex items-end gap-1.5">
            <textarea
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAISend();
                }
              }}
              placeholder="Ask Lumina…"
              rows={1}
              className="flex-1 bg-[#141420] border border-white/[0.07] rounded-md px-2 py-1.5 text-[11px] outline-none resize-none focus:border-[rgba(20,184,166,0.3)]"
            />
            <button
              onClick={handleAISend}
              disabled={aiBusy || !aiInput.trim()}
              className="w-7 h-7 rounded-full flex items-center justify-center disabled:opacity-30"
              style={{ background: "#14b8a6", color: "#050508" }}
            >
              <Send className="w-3 h-3" />
            </button>
          </div>
        </aside>
      </div>

      {/* FOOTER */}
      <footer className="flex items-center justify-between h-9 px-4 border-t border-white/[0.04] text-[11px] text-white/40 flex-shrink-0 print:hidden">
        <span>Words: {counts.w} · Chars: {counts.c} · Lines: {counts.l}</span>
        <span className="text-white/30">Autosaved locally</span>
      </footer>

      {/* Editor styles + print styles */}
      <style>{`
        .lumina-editor:empty::before { content: attr(data-placeholder); color: rgba(255,255,255,0.26); pointer-events: none; font-family: var(--font-display); font-style: italic; font-size: 22px; }
        .lumina-editor ::selection { background: rgba(124,58,237,0.32); }
        .lumina-editor h1 { font-family: var(--font-display); font-weight: 400; font-size: 44px; line-height: 1.08; letter-spacing: -0.012em; margin: 1.1em 0 0.45em; color: #fff; }
        .lumina-editor h2 { font-family: var(--font-display); font-weight: 400; font-size: 32px; line-height: 1.15; letter-spacing: -0.008em; margin: 1em 0 0.45em; color: rgba(255,255,255,0.95); }
        .lumina-editor h3 { font-family: var(--font-ui); font-weight: 600; font-size: 19px; letter-spacing: 0.005em; margin: 0.95em 0 0.4em; color: rgba(255,255,255,0.92); }
        .lumina-editor p { margin: 0 0 1.1em; }
        .lumina-editor blockquote { font-family: var(--font-display); font-style: italic; font-size: 22px; line-height: 1.45; border-left: 2px solid #14b8a6; padding: 4px 0 4px 22px; margin: 1.4em 0; color: rgba(255,255,255,0.78); }
        .lumina-editor pre { font-family: var(--font-mono); background: #0e0e18; border: 1px solid rgba(255,255,255,0.06); padding: 16px 18px; border-radius: 10px; overflow:auto; font-size: 13.5px; line-height: 1.65; margin: 1.2em 0; }
        .lumina-editor code { font-family: var(--font-mono); background: rgba(255,255,255,0.05); padding: 1px 6px; border-radius: 4px; font-size: 0.9em; color: #c8a8ff; }
        .lumina-editor .lumina-stream { background: linear-gradient(180deg, transparent 0%, transparent 86%, rgba(20,184,166,0.18) 86%, rgba(20,184,166,0.18) 100%); }
        .lumina-editor .lumina-stream::after { content: ''; display: inline-block; width: 2px; height: 1.05em; vertical-align: text-bottom; margin-left: 1px; background: #14b8a6; animation: lumina-doc-caret 1s steps(2,start) infinite; }
        @keyframes lumina-doc-caret { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }
        @keyframes slide-in-right { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          .lumina-editor, article { color: black !important; max-width: none !important; padding: 0 !important; }
          .lumina-editor h1, .lumina-editor h2, .lumina-editor h3, article h1, article h2, article h3 { color: black !important; }
        }
      `}</style>
    </div>
  );
}

const RibbonBtn = ({ onClick, icon }: { onClick: () => void; icon: React.ReactNode }) => (
  <button
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className="h-8 w-8 flex items-center justify-center rounded-md text-white/60 hover:bg-white/[0.06] hover:text-white/90 transition-colors"
  >
    {icon}
  </button>
);
const Sep = () => <span className="inline-block w-px h-4 bg-white/[0.08] mx-1.5" />;
